"""
Controller de webhooks para proveedores de delivery (Rappi, PedidosYa).

Las URLs de webhook se registran en el portal de cada proveedor apuntando a:
  POST /providers/webhooks/rappi?restaurantId={uuid}&branchId={uuid}
  POST /providers/webhooks/pedidosya?restaurantId={uuid}&branchId={uuid}

Estas rutas están en GLOBAL_PATHS (exentas de X-Restaurant-Slug) porque
los proveedores no pueden agregar headers internos.

Flujo:
  1. Verificar firma/token
  2. Guardar raw event en inbox (responde 200 inmediatamente)
  3. Procesar en background via eventlet.spawn
"""

import uuid as uuid_module
from flask import Blueprint, request, jsonify

import eventlet

from ..utils.logger import setup_logger
from ..integrations.registry import get_adapter
from ..integrations.inbox_service import (
    save_inbox_event,
    process_inbox_event,
    _get_integration_account,
)

logger = setup_logger(__name__)

provider_webhooks_bp = Blueprint(
    "provider_webhooks", __name__, url_prefix="/providers/webhooks"
)


@provider_webhooks_bp.route("/rappi", methods=["POST"])
def rappi_webhook():
    """
    Recibir webhook de Rappi.

    Query params requeridos:
      - restaurantId: UUID del restaurante
      - branchId: UUID de la sucursal (opcional)

    Headers esperados (Rappi):
      - X-Rappi-Hmac-Signature: firma HMAC-SHA256
      - X-Rappi-Request-Id: ID único del request (usado para dedup)
    """
    return _handle_provider_webhook("rappi")


@provider_webhooks_bp.route("/pedidosya", methods=["POST"])
def pedidosya_webhook():
    """
    Recibir webhook de PedidosYa.

    Query params requeridos:
      - restaurantId: UUID del restaurante
      - branchId: UUID de la sucursal (opcional)

    Headers esperados (PedidosYa):
      - X-PY-Integration-Token: token de integración
    """
    return _handle_provider_webhook("pedidosya")


@provider_webhooks_bp.route("/rappi/ping", methods=["GET", "POST"])
def rappi_ping():
    """Health check para registro de webhook en portal de Rappi."""
    logger.info("[rappi] ping recibido")
    return jsonify({"status": "ok", "provider": "rappi"}), 200


@provider_webhooks_bp.route("/pedidosya/ping", methods=["GET", "POST"])
def pedidosya_ping():
    """Health check para registro de webhook en portal de PedidosYa."""
    logger.info("[pedidosya] ping recibido")
    return jsonify({"status": "ok", "provider": "pedidosya"}), 200


# ---------------------------------------------------------------------------
# Handler principal
# ---------------------------------------------------------------------------

def _handle_provider_webhook(provider: str):
    """
    Handler genérico para webhooks de proveedores.
    Verifica firma, guarda en inbox, procesa async.
    """
    restaurant_id = request.args.get("restaurantId")
    branch_id = request.args.get("branchId") or None

    if not restaurant_id:
        logger.warning(
            "[%s] Webhook sin restaurantId en query params — IP=%s",
            provider,
            request.remote_addr,
        )
        return jsonify({"error": "restaurantId requerido"}), 400

    # Leer body crudo (antes del parse) para verificar firma
    raw_body_bytes = request.get_data()
    try:
        body = request.get_json(force=True, silent=True) or {}
    except Exception:
        body = {}

    if not body:
        logger.warning(
            "[%s] Webhook con body vacío o inválido: restaurant=%s", provider, restaurant_id
        )
        return jsonify({"error": "Body JSON requerido"}), 400

    # Obtener credenciales para verificación de firma
    account = _get_integration_account(restaurant_id, branch_id, provider)
    credentials = (account or {}).get("credentials") or {}

    # Preparar headers para el adapter (inyectar secrets)
    headers_for_adapter = dict(request.headers)
    if provider == "rappi":
        headers_for_adapter["_webhook_secret"] = credentials.get("webhook_secret", "")
    elif provider == "pedidosya":
        headers_for_adapter["_integration_token"] = credentials.get("integration_token", "")

    # Verificar firma
    try:
        adapter = get_adapter(provider)
        is_valid = adapter.verify_webhook_signature(raw_body_bytes, headers_for_adapter)
    except ValueError as e:
        logger.error("[%s] Adapter no registrado: %s", provider, str(e))
        return jsonify({"error": "Proveedor no soportado"}), 400

    if not is_valid:
        logger.warning(
            "[%s] Firma inválida: restaurant=%s branch=%s IP=%s",
            provider,
            restaurant_id,
            branch_id,
            request.remote_addr,
        )
        return jsonify({"error": "Firma inválida"}), 401

    # Generar dedupe_key
    dedupe_key = _build_dedupe_key(provider, body, request.headers)

    # Limpiar headers sensibles antes de guardar en DB
    safe_headers = _safe_headers(request.headers)

    # Guardar en inbox
    inbox_id, is_duplicate = save_inbox_event(
        provider=provider,
        event_type=_guess_event_type(provider, body),
        dedupe_key=dedupe_key,
        raw_headers=safe_headers,
        raw_body=body,
        restaurant_id=restaurant_id,
        branch_id=branch_id,
    )

    if is_duplicate:
        logger.info(
            "[%s] Webhook duplicado ignorado: dedupe_key=%s", provider, dedupe_key
        )
        return jsonify({"status": "ok", "duplicate": True}), 200

    # Procesar en background (el webhook ya respondió 200)
    if inbox_id:
        eventlet.spawn(process_inbox_event, inbox_id)

    return jsonify({"status": "ok", "inbox_id": inbox_id}), 200


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_dedupe_key(provider: str, body: dict, headers) -> str:
    """
    Construir una clave única para deduplicación del evento.

    Rappi: usa X-Rappi-Request-Id si está disponible, sino order id
    PedidosYa: usa el campo 'id' del body
    Fallback: uuid4 (no permite dedup pero evita pérdida)
    """
    if provider == "rappi":
        request_id = headers.get("X-Rappi-Request-Id", "")
        order_id = str(body.get("id", body.get("order_id", "")))
        key = request_id or order_id
    elif provider == "pedidosya":
        key = str(body.get("id", body.get("order_id", "")))
    else:
        key = ""

    if key:
        return f"{provider}:{key}"

    # Fallback: no hay forma de deduplicar, usar uuid
    fallback = str(uuid_module.uuid4())
    logger.warning(
        "[%s] No se pudo construir dedupe_key desde body/headers — usando uuid fallback: %s",
        provider,
        fallback,
    )
    return f"{provider}:{fallback}"


def _guess_event_type(provider: str, body: dict) -> str:
    """Inferir tipo de evento del webhook para logging y routing."""
    status = body.get("status", "").upper() if provider == "pedidosya" else body.get("status", "").lower()

    if provider == "rappi":
        if status == "created":
            return "order_created"
        elif status in ("cancelled", "rejected"):
            return "order_cancelled"
        return "order_updated"
    elif provider == "pedidosya":
        if status == "RECEIVED":
            return "order_created"
        elif status in ("CANCELLED", "REJECTED"):
            return "order_cancelled"
        return "order_updated"

    return "unknown"


def _safe_headers(headers) -> dict:
    """
    Convertir headers a dict, omitiendo headers sensibles (Authorization, tokens).
    """
    sensitive = {"authorization", "x-rappi-hmac-signature", "x-py-integration-token"}
    return {
        k: v
        for k, v in dict(headers).items()
        if k.lower() not in sensitive
    }
