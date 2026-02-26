"""
Controller de admin para proveedores de delivery.

Endpoints para:
  - Ver estado del outbox y inbox (jobs fallidos, conteos)
  - Gestionar cuentas de integración (CRUD)
  - Gestionar mapeos de productos
"""

from flask import Blueprint, request, jsonify, g

from ..middleware.auth import require_auth, require_roles
from ..db.supabase_client import supabase
from ..utils.logger import setup_logger
from ..utils.retry import execute_with_retry
from ..integrations.registry import get_all_providers

logger = setup_logger(__name__)

provider_admin_bp = Blueprint("provider_admin", __name__, url_prefix="/providers")


# ---------------------------------------------------------------------------
# Estado del sistema (observabilidad)
# ---------------------------------------------------------------------------

@provider_admin_bp.route("/status", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def get_provider_status():
    """
    Retorna estado del outbox e inbox:
      - Conteo de jobs por status
      - Últimos 10 jobs fallidos con last_error
      - Conteo de inbox events por status
    """
    try:
        restaurant_id = g.get("restaurant_id")

        # Conteo de outbox jobs por status
        outbox_query = supabase.table("provider_outbox_jobs").select(
            "status", count="exact"
        )
        if restaurant_id:
            outbox_query = outbox_query.eq("restaurant_id", restaurant_id)

        outbox_counts = _count_by_status(
            "provider_outbox_jobs",
            ["pending", "running", "completed", "failed"],
            restaurant_id,
        )

        # Últimos jobs fallidos
        failed_q = (
            supabase.table("provider_outbox_jobs")
            .select("id, provider, action, last_error, updated_at, provider_order_id, order_id")
            .eq("status", "failed")
            .order("updated_at", desc=True)
            .limit(10)
        )
        if restaurant_id:
            failed_q = failed_q.eq("restaurant_id", restaurant_id)
        failed_resp = execute_with_retry(failed_q.execute)
        recent_failures = failed_resp.data or []

        # Conteo de inbox events por status
        inbox_counts = _count_by_status(
            "order_events_inbox",
            ["pending", "processing", "processed", "skipped", "failed"],
            restaurant_id,
        )

        # Últimos inbox fallidos
        inbox_failed_q = (
            supabase.table("order_events_inbox")
            .select("id, provider, event_type, dedupe_key, error_message, received_at")
            .eq("status", "failed")
            .order("received_at", desc=True)
            .limit(5)
        )
        if restaurant_id:
            inbox_failed_q = inbox_failed_q.eq("restaurant_id", restaurant_id)
        inbox_failed_resp = execute_with_retry(inbox_failed_q.execute)
        inbox_recent_failures = inbox_failed_resp.data or []

        return jsonify({
            "outbox": outbox_counts,
            "inbox": inbox_counts,
            "recent_failures": recent_failures,
            "inbox_recent_failures": inbox_recent_failures,
        }), 200

    except Exception as e:
        logger.error("[provider_admin] Error en /providers/status: %s", str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


# ---------------------------------------------------------------------------
# Cuentas de integración
# ---------------------------------------------------------------------------

@provider_admin_bp.route("/accounts", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_integration_accounts():
    """Listar cuentas de integración del restaurante actual."""
    try:
        restaurant_id = g.get("restaurant_id")
        if not restaurant_id:
            return jsonify({"error": "restaurant_id requerido"}), 400

        resp = execute_with_retry(
            lambda: supabase.table("provider_integration_accounts")
            .select("id, restaurant_id, branch_id, provider, enabled, settings, created_at, updated_at")
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        accounts = resp.data or []

        # No retornar credentials (contienen secrets)
        return jsonify({"accounts": accounts}), 200

    except Exception as e:
        logger.error("[provider_admin] Error listando accounts: %s", str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


@provider_admin_bp.route("/accounts", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_integration_account():
    """
    Crear o actualizar cuenta de integración.

    Body:
      {
        "branch_id": "<uuid>|null",
        "provider": "rappi|pedidosya",
        "enabled": false,
        "credentials": {"client_id": "...", "webhook_secret": "..."},
        "settings": {}
      }
    """
    try:
        restaurant_id = g.get("restaurant_id")
        if not restaurant_id:
            return jsonify({"error": "restaurant_id requerido"}), 400

        data = request.get_json()
        if not data:
            return jsonify({"error": "Body JSON requerido"}), 400

        provider = data.get("provider", "").lower()
        valid_providers = get_all_providers()
        if provider not in valid_providers:
            return jsonify({
                "error": f"Proveedor inválido. Disponibles: {valid_providers}"
            }), 400

        upsert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": data.get("branch_id"),
            "provider": provider,
            "enabled": bool(data.get("enabled", False)),
            "credentials": data.get("credentials", {}),
            "settings": data.get("settings", {}),
        }

        resp = execute_with_retry(
            lambda: supabase.table("provider_integration_accounts")
            .upsert(upsert_data, on_conflict="restaurant_id,branch_id,provider")
            .execute()
        )
        rows = resp.data or []

        if not rows:
            return jsonify({"error": "No se pudo crear la cuenta"}), 500

        # No retornar credentials
        result = {k: v for k, v in rows[0].items() if k != "credentials"}
        return jsonify({"account": result}), 201

    except Exception as e:
        logger.error("[provider_admin] Error creando account: %s", str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


@provider_admin_bp.route("/accounts/<string:account_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_integration_account(account_id: str):
    """
    Actualizar cuenta de integración (habilitarla, actualizar credenciales, etc.)
    """
    try:
        restaurant_id = g.get("restaurant_id")
        data = request.get_json()
        if not data:
            return jsonify({"error": "Body JSON requerido"}), 400

        # Solo permitir actualizar campos específicos
        allowed_fields = {"enabled", "credentials", "settings"}
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        if not update_data:
            return jsonify({"error": "No hay campos válidos para actualizar"}), 400

        query = (
            supabase.table("provider_integration_accounts")
            .update(update_data)
            .eq("id", account_id)
        )
        if restaurant_id:
            query = query.eq("restaurant_id", restaurant_id)

        resp = execute_with_retry(lambda: query.execute())
        rows = resp.data or []

        if not rows:
            return jsonify({"error": "Cuenta no encontrada"}), 404

        result = {k: v for k, v in rows[0].items() if k != "credentials"}
        return jsonify({"account": result}), 200

    except Exception as e:
        logger.error("[provider_admin] Error actualizando account %s: %s", account_id, str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


# ---------------------------------------------------------------------------
# Mapeos de productos
# ---------------------------------------------------------------------------

@provider_admin_bp.route("/product-mappings", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_product_mappings():
    """Listar mapeos de productos del restaurante actual."""
    try:
        restaurant_id = g.get("restaurant_id")
        if not restaurant_id:
            return jsonify({"error": "restaurant_id requerido"}), 400

        provider = request.args.get("provider")

        query = (
            supabase.table("provider_product_mappings")
            .select("*")
            .eq("restaurant_id", restaurant_id)
        )
        if provider:
            query = query.eq("provider", provider)

        resp = execute_with_retry(lambda: query.execute())
        return jsonify({"mappings": resp.data or []}), 200

    except Exception as e:
        logger.error("[provider_admin] Error listando product mappings: %s", str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


@provider_admin_bp.route("/product-mappings", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_product_mapping():
    """
    Crear o actualizar mapeo de producto proveedor → menú interno.

    Body:
      {
        "branch_id": "<uuid>|null",
        "provider": "rappi|pedidosya",
        "provider_product_id": "12345",
        "menu_product_id": 42
      }
    """
    try:
        restaurant_id = g.get("restaurant_id")
        if not restaurant_id:
            return jsonify({"error": "restaurant_id requerido"}), 400

        data = request.get_json()
        if not data:
            return jsonify({"error": "Body JSON requerido"}), 400

        required = ["provider", "provider_product_id", "menu_product_id"]
        for field in required:
            if field not in data:
                return jsonify({"error": f"Campo requerido: {field}"}), 400

        upsert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": data.get("branch_id"),
            "provider": data["provider"].lower(),
            "provider_product_id": str(data["provider_product_id"]),
            "menu_product_id": int(data["menu_product_id"]),
        }

        resp = execute_with_retry(
            lambda: supabase.table("provider_product_mappings")
            .upsert(
                upsert_data,
                on_conflict="restaurant_id,branch_id,provider,provider_product_id",
            )
            .execute()
        )
        rows = resp.data or []

        if not rows:
            return jsonify({"error": "No se pudo crear el mapeo"}), 500

        return jsonify({"mapping": rows[0]}), 201

    except Exception as e:
        logger.error("[provider_admin] Error creando product mapping: %s", str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


@provider_admin_bp.route("/product-mappings/<string:mapping_id>", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_product_mapping(mapping_id: str):
    """Eliminar un mapeo de producto."""
    try:
        restaurant_id = g.get("restaurant_id")

        query = (
            supabase.table("provider_product_mappings")
            .delete()
            .eq("id", mapping_id)
        )
        if restaurant_id:
            query = query.eq("restaurant_id", restaurant_id)

        execute_with_retry(lambda: query.execute())
        return jsonify({"success": True}), 200

    except Exception as e:
        logger.error("[provider_admin] Error eliminando mapping %s: %s", mapping_id, str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


# ---------------------------------------------------------------------------
# Reintento manual de jobs fallidos
# ---------------------------------------------------------------------------

@provider_admin_bp.route("/jobs/<string:job_id>/retry", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def retry_failed_job(job_id: str):
    """Reencolar un job fallido para reintento manual."""
    try:
        from datetime import datetime, timezone

        restaurant_id = g.get("restaurant_id")

        query = (
            supabase.table("provider_outbox_jobs")
            .update({
                "status": "pending",
                "attempt_count": 0,
                "last_error": None,
                "next_retry_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", job_id)
            .eq("status", "failed")
        )
        if restaurant_id:
            query = query.eq("restaurant_id", restaurant_id)

        resp = execute_with_retry(lambda: query.execute())
        rows = resp.data or []

        if not rows:
            return jsonify({"error": "Job no encontrado o no está en estado failed"}), 404

        logger.info("[provider_admin] Job %s reencolado para reintento", job_id)
        return jsonify({"success": True, "job_id": job_id}), 200

    except Exception as e:
        logger.error("[provider_admin] Error retrying job %s: %s", job_id, str(e))
        return jsonify({"error": "Error interno del servidor"}), 500


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _count_by_status(table: str, statuses: list, restaurant_id=None) -> dict:
    """Contar registros de una tabla agrupados por status."""
    counts = {s: 0 for s in statuses}
    try:
        for status in statuses:
            q = supabase.table(table).select("id", count="exact").eq("status", status)
            if restaurant_id and table == "provider_outbox_jobs":
                q = q.eq("restaurant_id", restaurant_id)
            elif restaurant_id and table == "order_events_inbox":
                q = q.eq("restaurant_id", restaurant_id)
            resp = execute_with_retry(lambda: q.execute())
            counts[status] = resp.count or 0
    except Exception as e:
        logger.warning("[provider_admin] Error contando %s: %s", table, e)
    return counts
