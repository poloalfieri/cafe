"""
Split Payment Service - Lógica de cobro parcial por items
"""
from typing import Dict, List, Optional

from ..db.supabase_client import supabase
from ..db.models import OrderStatus
from ..utils.retry import execute_with_retry
from ..utils.logger import setup_logger
from ..socketio import socketio
from .order_items_service import ensure_order_items_exist
from .cash_service import cash_service

logger = setup_logger(__name__)

VALID_PAYMENT_METHODS = {"CASH", "CARD", "QR"}


class SplitPaymentService:

    def get_order_payment_summary(
        self, order_id: str, restaurant_id: str, branch_id: str
    ) -> Dict:
        """Return order_items with pending/paid quantities and payment history."""
        order_items = ensure_order_items_exist(order_id, restaurant_id, branch_id)

        payments_resp = execute_with_retry(
            lambda: supabase.table("payments")
            .select("*")
            .eq("order_id", order_id)
            .eq("status", "COMPLETED")
            .order("created_at", desc=False)
            .execute()
        )
        payments = payments_resp.data or []

        order_resp = execute_with_retry(
            lambda: supabase.table("orders")
            .select("total_amount, paid_amount, status")
            .eq("id", order_id)
            .single()
            .execute()
        )
        order = order_resp.data or {}

        return {
            "order_id": order_id,
            "items": order_items,
            "payments": payments,
            "total_amount": float(order.get("total_amount") or 0),
            "paid_amount": float(order.get("paid_amount") or 0),
            "status": order.get("status"),
        }

    def allocate_payment(
        self,
        order_id: str,
        allocations: List[Dict],
        payment_method: str,
        restaurant_id: str,
        branch_id: str,
        created_by_user_id: str,
    ) -> Dict:
        """
        Process a partial payment for selected items/quantities.

        allocations: [{"order_item_id": "uuid", "quantity": int}, ...]
        """
        payment_method = (payment_method or "").upper()
        if payment_method not in VALID_PAYMENT_METHODS:
            raise ValueError(f"Método de pago inválido: {payment_method}")

        if not allocations:
            raise ValueError("Debe seleccionar al menos un item para cobrar")

        # 1. Validate order status
        order_resp = execute_with_retry(
            lambda: supabase.table("orders")
            .select("id, status, total_amount, paid_amount, restaurant_id, branch_id, mesa_id")
            .eq("id", order_id)
            .single()
            .execute()
        )
        order = order_resp.data
        if not order:
            raise LookupError("Orden no encontrada")

        valid_statuses = {
            OrderStatus.PAYMENT_PENDING.value,
            OrderStatus.PARTIALLY_PAID.value,
        }
        if order.get("status") not in valid_statuses:
            raise ValueError(
                f"No se puede cobrar una orden en estado {order.get('status')}"
            )

        # 2. Ensure order_items exist (lazy migration)
        order_items = ensure_order_items_exist(order_id, restaurant_id, branch_id)
        items_by_id = {item["id"]: item for item in order_items}

        # 3. Validate allocations
        total_amount = 0.0
        validated_allocs = []
        for alloc in allocations:
            item_id = alloc.get("order_item_id")
            qty = int(alloc.get("quantity", 0))

            if not item_id or qty <= 0:
                raise ValueError("Cada allocation necesita order_item_id y quantity > 0")

            item = items_by_id.get(item_id)
            if not item:
                raise ValueError(f"Item {item_id} no pertenece a esta orden")

            if qty > item.get("pending_qty", 0):
                raise ValueError(
                    f"Item '{item.get('name')}': cantidad solicitada ({qty}) "
                    f"excede pendiente ({item.get('pending_qty')})"
                )

            alloc_amount = round(float(item["unit_price"]) * qty, 2)
            total_amount += alloc_amount
            validated_allocs.append({
                "order_item_id": item_id,
                "quantity": qty,
                "amount": alloc_amount,
                "item": item,
            })

        total_amount = round(total_amount, 2)

        # 4. Insert payment record
        payment_data = {
            "order_id": order_id,
            "payment_method": payment_method,
            "amount": total_amount,
            "status": "COMPLETED",
            "created_by_user_id": created_by_user_id,
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
        }
        payment_resp = execute_with_retry(
            lambda: supabase.table("payments").insert(payment_data).execute()
        )
        payment = payment_resp.data[0]
        payment_id = payment["id"]

        # 5. Insert payment_allocations
        alloc_rows = []
        for va in validated_allocs:
            alloc_rows.append({
                "payment_id": payment_id,
                "order_item_id": va["order_item_id"],
                "quantity": va["quantity"],
                "amount": va["amount"],
            })
        execute_with_retry(
            lambda: supabase.table("payment_allocations").insert(alloc_rows).execute()
        )

        # 6. Update order_items: pending_qty -= qty, paid_qty += qty
        for va in validated_allocs:
            item = va["item"]
            new_pending = item["pending_qty"] - va["quantity"]
            new_paid = item["paid_qty"] + va["quantity"]
            execute_with_retry(
                lambda oi_id=va["order_item_id"], np=new_pending, npd=new_paid: (
                    supabase.table("order_items")
                    .update({"pending_qty": np, "paid_qty": npd})
                    .eq("id", oi_id)
                    .execute()
                )
            )

        # 7. Update orders.paid_amount and status
        new_paid_amount = round(float(order.get("paid_amount") or 0) + total_amount, 2)

        # Check if all items are fully paid
        updated_items_resp = execute_with_retry(
            lambda: supabase.table("order_items")
            .select("pending_qty")
            .eq("order_id", order_id)
            .execute()
        )
        all_paid = all(
            item.get("pending_qty", 1) == 0
            for item in (updated_items_resp.data or [])
        )

        new_status = (
            OrderStatus.PAID.value if all_paid
            else OrderStatus.PARTIALLY_PAID.value
        )

        execute_with_retry(
            lambda: supabase.table("orders")
            .update({
                "paid_amount": new_paid_amount,
                "status": new_status,
                "payment_method": payment_method,
            })
            .eq("id", order_id)
            .execute()
        )

        # 8. Record cash movement
        try:
            cash_service.record_split_payment(
                payment=payment,
                created_by_user_id=created_by_user_id,
            )
        except Exception as e:
            logger.warning(f"Error registrando movimiento de caja para pago {payment_id}: {e}")

        # 9. Emit socket event
        try:
            socketio.emit("orders:updated", {
                "branch_id": branch_id,
                "mesa_id": order.get("mesa_id"),
            })
        except Exception:
            pass

        return {
            "payment": payment,
            "allocations": alloc_rows,
            "order_status": new_status,
            "paid_amount": new_paid_amount,
            "total_amount": float(order.get("total_amount") or 0),
            "fully_paid": all_paid,
        }

    def list_order_payments(self, order_id: str) -> List[Dict]:
        """List all payments for an order with their allocations."""
        payments_resp = execute_with_retry(
            lambda: supabase.table("payments")
            .select("*")
            .eq("order_id", order_id)
            .order("created_at", desc=False)
            .execute()
        )
        payments = payments_resp.data or []

        for payment in payments:
            allocs_resp = execute_with_retry(
                lambda pid=payment["id"]: supabase.table("payment_allocations")
                .select("*, order_items(name, unit_price)")
                .eq("payment_id", pid)
                .execute()
            )
            payment["allocations"] = allocs_resp.data or []

        return payments


split_payment_service = SplitPaymentService()
