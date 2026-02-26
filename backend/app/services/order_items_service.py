from typing import Dict, List

from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


def ensure_order_items_exist(
    order_id: str, restaurant_id: str, branch_id: str
) -> List[Dict]:
    """
    Lazy migration: if order_items don't exist for this order,
    create them from the JSONB items column. Returns all order_items.
    """
    existing = execute_with_retry(
        lambda: supabase.table("order_items")
        .select("*")
        .eq("order_id", order_id)
        .execute()
    )
    if existing.data:
        return existing.data

    order_resp = execute_with_retry(
        lambda: supabase.table("orders")
        .select("items")
        .eq("id", order_id)
        .single()
        .execute()
    )
    if not order_resp.data:
        raise LookupError(f"Orden {order_id} no encontrada")

    items = order_resp.data.get("items") or []
    rows = []
    for item in items:
        qty = int(item.get("quantity", 1))
        unit_price = float(item.get("finalPrice") or item.get("price") or 0)
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
            "discount_amount": float(item.get("discountAmount") or 0),
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
        })

    if not rows:
        return []

    resp = execute_with_retry(
        lambda: supabase.table("order_items").insert(rows).execute()
    )
    return resp.data or []


def insert_order_items_from_json(
    order_id: str,
    items: List[Dict],
    restaurant_id: str,
    branch_id: str,
) -> List[Dict]:
    """Insert order_items rows from the items list at order creation time."""
    rows = []
    for item in items:
        qty = int(item.get("quantity", 1))
        unit_price = float(item.get("finalPrice") or item.get("price") or 0)
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
            "discount_amount": float(item.get("discountAmount") or 0),
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
        })

    if not rows:
        return []

    resp = execute_with_retry(
        lambda: supabase.table("order_items").insert(rows).execute()
    )
    return resp.data or []
