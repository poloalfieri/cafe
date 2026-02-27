from typing import Dict, List, Tuple

from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry
from ..utils.logger import setup_logger
from ..utils.supabase_errors import is_missing_relation_error

logger = setup_logger(__name__)


def ensure_order_items_exist(
    order_id: str, restaurant_id: str, branch_id: str
) -> List[Dict]:
    """
    Lazy migration: if order_items don't exist for this order,
    create them from the JSONB items column. Returns all order_items.
    """
    items, _ = get_order_items_for_split(order_id, restaurant_id, branch_id)
    return items


def get_order_items_for_split(
    order_id: str, restaurant_id: str, branch_id: str
) -> Tuple[List[Dict], bool]:
    """
    Return normalized items for split payments.
    bool flag indicates whether data is backed by order_items table.
    """
    order_payload = None
    try:
        existing = execute_with_retry(
            lambda: supabase.table("order_items")
            .select("*")
            .eq("order_id", order_id)
            .execute()
        )
    except Exception as exc:
        if not is_missing_relation_error(exc, "order_items"):
            raise
        logger.warning(
            "Tabla order_items no disponible; usando fallback en orders.items para orden %s",
            order_id,
        )
        order_payload = _get_order_payload(order_id)
        return build_virtual_order_items(order_payload.get("items") or []), False

    if existing.data:
        return existing.data, True

    order_payload = _get_order_payload(order_id)
    source_items = order_payload.get("items") or []
    rows = _build_db_rows(
        order_id=order_id,
        items=source_items,
        restaurant_id=restaurant_id or order_payload.get("restaurant_id"),
        branch_id=branch_id or order_payload.get("branch_id"),
    )

    if not rows:
        return [], True

    try:
        inserted = execute_with_retry(
            lambda: supabase.table("order_items").insert(rows).execute()
        )
        if inserted.data:
            return inserted.data, True

        refreshed = execute_with_retry(
            lambda: supabase.table("order_items")
            .select("*")
            .eq("order_id", order_id)
            .execute()
        )
        return refreshed.data or [], True
    except Exception as exc:
        if not is_missing_relation_error(exc, "order_items"):
            raise
        logger.warning(
            "Tabla order_items no disponible al insertar; usando fallback en orders.items para orden %s",
            order_id,
        )
        return build_virtual_order_items(source_items), False


def insert_order_items_from_json(
    order_id: str,
    items: List[Dict],
    restaurant_id: str,
    branch_id: str,
) -> List[Dict]:
    """Insert order_items rows from the items list at order creation time."""
    rows = _build_db_rows(
        order_id=order_id,
        items=items,
        restaurant_id=restaurant_id,
        branch_id=branch_id,
    )

    if not rows:
        return []

    try:
        resp = execute_with_retry(
            lambda: supabase.table("order_items").insert(rows).execute()
        )
        return resp.data or []
    except Exception as exc:
        if not is_missing_relation_error(exc, "order_items"):
            raise
        logger.info(
            "Tabla order_items no disponible; se omite inserción para orden %s",
            order_id,
        )
        return []


def build_virtual_order_items(items: List[Dict]) -> List[Dict]:
    virtual_items: List[Dict] = []
    for index, item in enumerate(items):
        quantity = max(0, _safe_int(item.get("quantity"), default=1))
        paid_qty = _safe_int(
            item.get("paid_qty", item.get("paidQuantity", item.get("split_paid_qty", 0))),
            default=0,
        )
        paid_qty = max(0, min(paid_qty, quantity))
        pending_qty = max(0, quantity - paid_qty)

        line_id = item.get("lineId") or item.get("line_id")
        product_id = str(item.get("id", ""))
        virtual_id = str(line_id or f"{product_id or 'item'}::{index}")

        unit_price = _safe_float(
            item.get("finalPrice", item.get("unit_price", item.get("price", 0))),
            default=0.0,
        )
        virtual_items.append({
            "id": virtual_id,
            "product_id": product_id,
            "name": item.get("name", ""),
            "unit_price": unit_price,
            "quantity": quantity,
            "pending_qty": pending_qty,
            "paid_qty": paid_qty,
            "selected_options": item.get("selectedOptions") or item.get("selected_options") or [],
            "line_id": line_id,
            "discount_amount": _safe_float(
                item.get("discountAmount", item.get("discount_amount", 0)),
                default=0.0,
            ),
        })
    return virtual_items


def _get_order_payload(order_id: str) -> Dict:
    order_resp = execute_with_retry(
        lambda: supabase.table("orders")
        .select("items, restaurant_id, branch_id")
        .eq("id", order_id)
        .single()
        .execute()
    )
    if not order_resp.data:
        raise LookupError(f"Orden {order_id} no encontrada")
    return order_resp.data


def _build_db_rows(
    order_id: str,
    items: List[Dict],
    restaurant_id: str,
    branch_id: str,
) -> List[Dict]:
    rows: List[Dict] = []
    for item in items:
        qty = max(0, _safe_int(item.get("quantity"), default=1))
        unit_price = _safe_float(item.get("finalPrice", item.get("price", 0)), default=0.0)
        rows.append({
            "order_id": order_id,
            "product_id": str(item.get("id", "")),
            "name": item.get("name", ""),
            "unit_price": unit_price,
            "quantity": qty,
            "pending_qty": qty,
            "paid_qty": 0,
            "selected_options": item.get("selectedOptions") or [],
            "line_id": item.get("lineId"),
            "discount_amount": _safe_float(item.get("discountAmount"), default=0.0),
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
        })
    return rows


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
