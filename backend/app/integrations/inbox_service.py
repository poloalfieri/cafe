"""
Servicio de Inbox para webhooks de proveedores de delivery.

Garantiza idempotencia: cada evento se guarda una sola vez (dedupe_key UNIQUE).
El procesamiento es async; el webhook responde 200 inmediatamente.

Flujo:
  1. save_inbox_event() → INSERT con ON CONFLICT DO NOTHING → retorna (id, is_duplicate)
  2. process_inbox_event() → verifica enabled, mapea, crea orden, emite socket
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from ..db.supabase_client import supabase
from ..utils.logger import setup_logger
from ..utils.retry import execute_with_retry

logger = setup_logger(__name__)


def save_inbox_event(
    provider: str,
    event_type: Optional[str],
    dedupe_key: str,
    raw_headers: dict,
    raw_body: dict,
    restaurant_id: Optional[str],
    branch_id: Optional[str],
) -> Tuple[Optional[str], bool]:
    """
    Guardar evento en el inbox.

    Retorna:
        (inbox_id, is_duplicate)
        Si es duplicado, inbox_id es None y is_duplicate=True.
    """
    try:
        data = {
            "provider": provider,
            "event_type": event_type,
            "dedupe_key": dedupe_key,
            "raw_headers": raw_headers,
            "raw_body": raw_body,
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
            "status": "pending",
        }

        # ON CONFLICT DO NOTHING via upsert con ignoreDuplicates
        response = execute_with_retry(
            lambda: supabase.table("order_events_inbox")
            .upsert(data, on_conflict="dedupe_key", ignore_duplicates=True)
            .execute()
        )

        rows = response.data or []
        if not rows:
            # Nada fue insertado → es duplicado
            logger.info(
                "[inbox] Evento duplicado ignorado: provider=%s dedupe_key=%s",
                provider,
                dedupe_key,
            )
            return None, True

        inbox_id = rows[0].get("id")
        logger.info(
            "[inbox] Evento guardado: provider=%s event_type=%s inbox_id=%s",
            provider,
            event_type,
            inbox_id,
        )
        return inbox_id, False

    except Exception as e:
        logger.error(
            "[inbox] Error guardando evento: provider=%s dedupe_key=%s error=%s",
            provider,
            dedupe_key,
            str(e),
        )
        return None, False


def process_inbox_event(inbox_id: str) -> None:
    """
    Procesar un evento del inbox en background (via eventlet.spawn).

    Pasos:
      1. Leer el evento
      2. Verificar que el provider esté habilitado para el restaurante/sucursal
      3. Parsear + mapear la orden
      4. Dedup secundario: verificar que no exista ya por provider_order_id
      5. Crear orden interna
      6. Emitir orders:updated via socket
      7. Marcar inbox como processed o failed
    """
    try:
        # Imports tardíos para evitar circular imports
        from .registry import get_adapter

        # 1. Leer el evento
        response = execute_with_retry(
            lambda: supabase.table("order_events_inbox")
            .select("*")
            .eq("id", inbox_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            logger.error("[inbox] Evento no encontrado: inbox_id=%s", inbox_id)
            return

        event = rows[0]
        provider = event.get("provider")
        restaurant_id = event.get("restaurant_id")
        branch_id = event.get("branch_id")
        raw_body = event.get("raw_body") or {}
        raw_headers = event.get("raw_headers") or {}

        # Marcar como processing
        execute_with_retry(
            lambda: supabase.table("order_events_inbox")
            .update({"status": "processing"})
            .eq("id", inbox_id)
            .execute()
        )

        # 2. Verificar que el provider esté habilitado
        account = _get_integration_account(restaurant_id, branch_id, provider)
        if not account or not account.get("enabled"):
            logger.info(
                "[inbox] Provider deshabilitado para restaurant=%s branch=%s provider=%s — marcando skipped",
                restaurant_id,
                branch_id,
                provider,
            )
            _mark_inbox_status(inbox_id, "skipped", "Provider deshabilitado o no configurado")
            return

        # 3. Obtener adapter y parsear evento
        adapter = get_adapter(provider)
        normalized_event = adapter.parse_webhook_event(raw_body, raw_headers)
        provider_order_id = normalized_event.provider_order_id
        event_type = normalized_event.event_type

        if not provider_order_id:
            _mark_inbox_status(inbox_id, "failed", "provider_order_id no encontrado en payload")
            logger.warning(
                "[inbox] provider_order_id vacío: provider=%s inbox_id=%s", provider, inbox_id
            )
            return

        # Solo procesamos order_created (los order_updated vienen por webhook de estado)
        if event_type == "order_cancelled":
            # Cancelar la orden si existe
            _handle_order_cancellation(provider_order_id, restaurant_id, branch_id, provider)
            _mark_inbox_status(inbox_id, "processed")
            return

        if event_type not in ("order_created", "order_updated"):
            logger.info(
                "[inbox] Evento tipo '%s' no requiere acción: inbox_id=%s",
                event_type,
                inbox_id,
            )
            _mark_inbox_status(inbox_id, "skipped", f"Tipo de evento no procesado: {event_type}")
            return

        # 4. Dedup secundario: verificar que no exista ya la orden
        existing = _get_existing_order(provider_order_id, restaurant_id)
        if existing:
            logger.info(
                "[inbox] Orden ya existe: provider_order_id=%s order_id=%s",
                provider_order_id,
                existing.get("id"),
            )
            _mark_inbox_status(inbox_id, "skipped", f"Orden ya existente: {existing.get('id')}")
            return

        # 5. Obtener product mappings para este branch/restaurant
        product_mappings = _get_product_mappings(restaurant_id, branch_id, provider)

        # 6. Mapear orden del proveedor al formato interno
        internal_order = adapter.map_provider_order_to_internal(
            provider_order=normalized_event.raw_order,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            product_mappings=product_mappings,
        )

        # 7. Crear orden interna (bypass de validación de mesa y token)
        created_order = _create_provider_order(internal_order)
        if not created_order:
            _mark_inbox_status(inbox_id, "failed", "Error al crear la orden en la base de datos")
            return

        order_id = created_order.get("id")
        logger.info(
            "[inbox] Orden creada: provider=%s provider_order_id=%s order_id=%s",
            provider,
            provider_order_id,
            order_id,
        )

        # 8. Emitir actualización en tiempo real al cajero
        try:
            from ..socketio import socketio
            socketio.emit(
                "orders:updated",
                {
                    "branch_id": created_order.get("branch_id"),
                    "mesa_id": created_order.get("mesa_id"),
                },
            )
        except Exception as socket_err:
            logger.warning("[inbox] Error emitiendo socket: %s", str(socket_err))

        _mark_inbox_status(inbox_id, "processed")

    except Exception as e:
        logger.error(
            "[inbox] Error procesando inbox_id=%s: %s", inbox_id, str(e), exc_info=True
        )
        _mark_inbox_status(inbox_id, "failed", str(e))


# ---------------------------------------------------------------------------
# Helpers privados
# ---------------------------------------------------------------------------

def _get_integration_account(
    restaurant_id: Optional[str],
    branch_id: Optional[str],
    provider: str,
) -> Optional[dict]:
    """
    Obtener cuenta de integración del proveedor con fallback branch → restaurant.
    Mismo patrón de lookup que getMpConfig en el webhook de MercadoPago.
    """
    if not restaurant_id:
        return None

    # 1. Intento branch-level
    if branch_id:
        try:
            resp = execute_with_retry(
                lambda: supabase.table("provider_integration_accounts")
                .select("*")
                .eq("restaurant_id", restaurant_id)
                .eq("branch_id", branch_id)
                .eq("provider", provider)
                .limit(1)
                .execute()
            )
            rows = resp.data or []
            if rows:
                return rows[0]
        except Exception as e:
            logger.warning("[inbox] Error buscando account branch-level: %s", e)

    # 2. Fallback restaurant-level
    try:
        resp = execute_with_retry(
            lambda: supabase.table("provider_integration_accounts")
            .select("*")
            .eq("restaurant_id", restaurant_id)
            .is_("branch_id", "null")
            .eq("provider", provider)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None
    except Exception as e:
        logger.warning("[inbox] Error buscando account restaurant-level: %s", e)
        return None


def _get_existing_order(
    provider_order_id: str,
    restaurant_id: Optional[str],
) -> Optional[dict]:
    """Verificar si ya existe una orden con este provider_order_id."""
    try:
        q = (
            supabase.table("orders")
            .select("id, status")
            .eq("provider_order_id", provider_order_id)
        )
        if restaurant_id:
            q = q.eq("restaurant_id", restaurant_id)
        resp = execute_with_retry(lambda: q.limit(1).execute())
        rows = resp.data or []
        return rows[0] if rows else None
    except Exception as e:
        logger.warning("[inbox] Error buscando orden existente: %s", e)
        return None


def _get_product_mappings(
    restaurant_id: Optional[str],
    branch_id: Optional[str],
    provider: str,
) -> list:
    """
    Obtener mapeos de productos para este restaurante/sucursal/proveedor.
    Fallback: branch → restaurant-level mappings.
    """
    if not restaurant_id:
        return []

    try:
        q = (
            supabase.table("provider_product_mappings")
            .select("provider_product_id, menu_product_id")
            .eq("restaurant_id", restaurant_id)
            .eq("provider", provider)
        )
        if branch_id:
            # Buscar tanto branch-level como restaurant-level en una sola query
            # y deduplicar (branch tiene prioridad)
            resp = execute_with_retry(lambda: q.execute())
            all_mappings = resp.data or []
            # Priorizar branch-level sobre restaurant-level
            by_pid: dict = {}
            branch_rows = [m for m in all_mappings if m.get("branch_id") == branch_id]
            rest_rows = [m for m in all_mappings if not m.get("branch_id")]
            for m in rest_rows:
                by_pid[m["provider_product_id"]] = m
            for m in branch_rows:  # sobreescribe con branch-level
                by_pid[m["provider_product_id"]] = m
            return list(by_pid.values())
        else:
            resp = execute_with_retry(lambda: q.is_("branch_id", "null").execute())
            return resp.data or []
    except Exception as e:
        logger.warning("[inbox] Error obteniendo product mappings: %s", e)
        return []


def _create_provider_order(order_data: dict) -> Optional[dict]:
    """
    Insertar una orden de proveedor directamente en la tabla orders.
    Bypass completo de validación de mesa/token/stock (el proveedor ya manejó eso).
    Solo hace consumo de stock para items con stock_tracked=True (mapeados explícitamente).
    """
    import uuid as uuid_module
    from datetime import datetime, timezone

    try:
        items = order_data.get("items", [])
        mesa_id = order_data.get("mesa_id", "")
        restaurant_id = order_data.get("restaurant_id")
        branch_id = order_data.get("branch_id")
        total = float(order_data.get("total_amount", 0))
        provider_order_id = order_data.get("provider_order_id")
        source = order_data.get("source", "app")
        source_data = order_data.get("source_data")

        now_iso = datetime.now(timezone.utc).isoformat()

        insert_data = {
            "mesa_id": mesa_id,
            "status": "PAYMENT_APPROVED",
            "token": str(uuid_module.uuid4()),
            "items": items,
            "total_amount": total,
            "creation_date": now_iso,
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
            "source": source,
            "provider_order_id": provider_order_id,
            "source_data": source_data,
        }

        resp = supabase.table("orders").insert(insert_data).execute()
        rows = resp.data or []
        if not rows:
            logger.error("[inbox] INSERT de orden no retornó datos")
            return None

        new_order = rows[0]
        order_id = new_order.get("id")

        # Consumir stock solo para items con mapeo explícito (stock_tracked=True)
        _consume_stock_for_mapped_items(items, restaurant_id, branch_id, order_id, source)

        return new_order

    except Exception as e:
        logger.error("[inbox] Error creando orden de proveedor: %s", str(e), exc_info=True)
        return None


def _consume_stock_for_mapped_items(
    items: list,
    restaurant_id: Optional[str],
    branch_id: Optional[str],
    order_id: Optional[str],
    source: str,
) -> None:
    """
    Consumir stock solo para items con id (menu_product_id) y stock_tracked=True.
    Los items opacos (sin mapeo) no descuentan stock.
    """
    from ..services.ingredients_service import ingredients_service

    if not restaurant_id or not branch_id:
        return

    for item in items:
        if not item.get("stock_tracked") or not item.get("id"):
            continue

        product_id = item["id"]
        quantity = int(item.get("quantity", 1))

        try:
            recipes_resp = (
                supabase.table("recipes")
                .select("ingredient_id, quantity")
                .eq("product_id", str(product_id))
                .eq("restaurant_id", restaurant_id)
                .execute()
            )
            recipes = recipes_resp.data or []
            for recipe in recipes:
                ing_id = recipe.get("ingredient_id")
                recipe_qty = float(recipe.get("quantity", 0))
                if not ing_id or recipe_qty <= 0:
                    continue
                consumed = round(recipe_qty * quantity, 4)
                try:
                    ingredients_service.record_movement(
                        ingredient_id=str(ing_id),
                        qty=-consumed,
                        movement_type="sale",
                        restaurant_id=restaurant_id,
                        reason=f"Venta delivery {source}: {item.get('name', product_id)}",
                        source=f"order:{order_id}",
                        branch_id=branch_id,
                    )
                except Exception as e:
                    logger.warning(
                        "[inbox] No se pudo descontar stock ingrediente %s para orden %s: %s",
                        ing_id,
                        order_id,
                        e,
                    )
        except Exception as e:
            logger.warning(
                "[inbox] Error consumiendo stock producto %s: %s", product_id, e
            )


def _handle_order_cancellation(
    provider_order_id: str,
    restaurant_id: Optional[str],
    branch_id: Optional[str],
    provider: str,
) -> None:
    """Cancelar la orden interna si existe y está en un estado cancelable."""
    try:
        existing = _get_existing_order(provider_order_id, restaurant_id)
        if not existing:
            logger.info(
                "[inbox] Cancelación para orden inexistente: provider_order_id=%s", provider_order_id
            )
            return

        order_id = existing.get("id")
        current_status = existing.get("status", "")

        terminal_statuses = {"DELIVERED", "CANCELLED", "PAYMENT_REJECTED"}
        if current_status in terminal_statuses:
            logger.info(
                "[inbox] Orden %s ya está en estado terminal %s — sin cambios",
                order_id,
                current_status,
            )
            return

        execute_with_retry(
            lambda: supabase.table("orders")
            .update({"status": "CANCELLED"})
            .eq("id", order_id)
            .execute()
        )
        logger.info(
            "[inbox] Orden %s cancelada por evento del proveedor %s",
            order_id,
            provider,
        )

        # Emitir socket
        from ..socketio import socketio
        try:
            socketio.emit("orders:updated", {"branch_id": branch_id, "mesa_id": None})
        except Exception:
            pass

    except Exception as e:
        logger.error(
            "[inbox] Error cancelando orden provider_order_id=%s: %s", provider_order_id, e
        )


def _mark_inbox_status(
    inbox_id: str, status: str, error_message: Optional[str] = None
) -> None:
    """Actualizar el status del evento en el inbox."""
    from datetime import datetime, timezone

    update_data: dict = {"status": status}
    if status in ("processed", "skipped", "failed"):
        update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
    if error_message:
        update_data["error_message"] = error_message[:1000]  # truncar

    try:
        execute_with_retry(
            lambda: supabase.table("order_events_inbox")
            .update(update_data)
            .eq("id", inbox_id)
            .execute()
        )
    except Exception as e:
        logger.warning("[inbox] Error actualizando status inbox_id=%s: %s", inbox_id, e)
