"""
Split Payment Service - Lógica de cobro parcial por items (orders.items JSONB)
"""
from datetime import datetime, timezone
from typing import Dict, List, Tuple
from uuid import uuid4

from ..db.supabase_client import supabase
from ..db.models import OrderStatus
from ..utils.retry import execute_with_retry
from ..utils.logger import setup_logger
from ..utils.supabase_errors import is_missing_relation_error, is_undefined_column_error
from ..socketio import socketio
from .cash_service import cash_service

logger = setup_logger(__name__)

VALID_PAYMENT_METHODS = {"CASH", "CARD", "QR"}


class SplitPaymentService:

    def get_order_payment_summary(
        self, order_id: str, restaurant_id: str, branch_id: str
    ) -> Dict:
        """Return order items with pending/paid quantities and payment history."""
        order = self._get_order(order_id)
        order_items = self._build_order_items_from_json(order.get("items") or [])
        payments = self._fetch_payments(order_id, completed_only=True)
        paid_amount = self._resolve_paid_amount(order, order_items, payments)

        return {
            "order_id": order_id,
            "items": order_items,
            "payments": payments,
            "total_amount": _to_float(order.get("total_amount"), default=0.0),
            "paid_amount": paid_amount,
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

        allocations: [{"order_item_id": "item-id", "quantity": int}, ...]
        """
        payment_method = (payment_method or "").upper()
        if payment_method not in VALID_PAYMENT_METHODS:
            raise ValueError(f"Método de pago inválido: {payment_method}")

        if not allocations:
            raise ValueError("Debe seleccionar al menos un item para cobrar")

        # 1. Validate order status and current items
        order = self._get_order(order_id)
        valid_statuses = {
            OrderStatus.PAYMENT_PENDING.value,
            OrderStatus.PARTIALLY_PAID.value,
        }
        if order.get("status") not in valid_statuses:
            raise ValueError(
                f"No se puede cobrar una orden en estado {order.get('status')}"
            )

        source_items = order.get("items") or []
        order_items = self._build_order_items_from_json(source_items)
        items_by_id = {item["id"]: item for item in order_items}

        # 2. Validate allocations
        total_amount = 0.0
        validated_allocs = []
        for alloc in allocations:
            item_id = alloc.get("order_item_id")
            qty = _to_int(alloc.get("quantity"), default=0)

            if not item_id or qty <= 0:
                raise ValueError("Cada allocation necesita order_item_id y quantity > 0")

            item = items_by_id.get(item_id)
            if not item:
                raise ValueError(f"Item {item_id} no pertenece a esta orden")

            pending_qty = _to_int(item.get("pending_qty"), default=0)
            if qty > pending_qty:
                raise ValueError(
                    f"Item '{item.get('name')}': cantidad solicitada ({qty}) "
                    f"excede pendiente ({pending_qty})"
                )

            unit_price = _to_float(item.get("unit_price"), default=0.0)
            alloc_amount = round(unit_price * qty, 2)
            total_amount += alloc_amount
            validated_allocs.append({
                "order_item_id": item_id,
                "quantity": qty,
                "amount": alloc_amount,
            })

        total_amount = round(total_amount, 2)

        # 3. Persist payment row (fallback if payments table is unavailable)
        payment_data = {
            "order_id": order_id,
            "payment_method": payment_method,
            "amount": total_amount,
            "status": "COMPLETED",
            "created_by_user_id": created_by_user_id,
            "restaurant_id": restaurant_id or order.get("restaurant_id"),
            "branch_id": branch_id or order.get("branch_id"),
        }
        payment, payment_persisted = self._create_payment(payment_data)

        # 4. Apply allocations directly over orders.items JSON
        updated_items, all_paid = self._apply_allocations_to_embedded_items(
            source_items,
            validated_allocs,
        )

        current_paid_amount = self._resolve_paid_amount(order, order_items, [])
        new_paid_amount = round(current_paid_amount + total_amount, 2)
        new_status = OrderStatus.PAID.value if all_paid else OrderStatus.PARTIALLY_PAID.value

        order_update = {
            "items": updated_items,
            "status": new_status,
            "payment_method": payment_method,
            "paid_amount": new_paid_amount,
        }
        self._update_order_with_paid_amount_fallback(order_id, order_update)

        # 5. Record cash movement if payment row exists
        if payment_persisted:
            try:
                cash_service.record_split_payment(
                    payment=payment,
                    created_by_user_id=created_by_user_id,
                )
            except Exception as exc:
                logger.warning(
                    "Error registrando movimiento de caja para pago %s: %s",
                    payment.get("id"),
                    exc,
                )

        # 6. Emit socket event
        try:
            socketio.emit("orders:updated", {
                "branch_id": branch_id or order.get("branch_id"),
                "mesa_id": order.get("mesa_id"),
            })
        except Exception:
            pass

        return {
            "payment": payment,
            "allocations": [
                {
                    "payment_id": payment.get("id"),
                    "order_item_id": alloc["order_item_id"],
                    "quantity": alloc["quantity"],
                    "amount": alloc["amount"],
                }
                for alloc in validated_allocs
            ],
            "order_status": new_status,
            "paid_amount": new_paid_amount,
            "total_amount": _to_float(order.get("total_amount"), default=0.0),
            "fully_paid": all_paid,
        }

    def list_order_payments(self, order_id: str) -> List[Dict]:
        """List all payments made on an order."""
        return self._fetch_payments(order_id, completed_only=False)

    def _fetch_payments(self, order_id: str, completed_only: bool) -> List[Dict]:
        try:
            query = (
                supabase.table("payments")
                .select("*")
                .eq("order_id", order_id)
                .order("created_at", desc=False)
            )
            if completed_only:
                query = query.eq("status", "COMPLETED")
            resp = execute_with_retry(query.execute)
        except Exception as exc:
            if not is_missing_relation_error(exc, "payments"):
                raise
            return []
        payments = resp.data or []
        for payment in payments:
            payment["allocations"] = []
        return payments

    def _get_order(self, order_id: str) -> Dict:
        order_resp = execute_with_retry(
            lambda: supabase.table("orders")
            .select("*")
            .eq("id", order_id)
            .single()
            .execute()
        )
        order = order_resp.data
        if not order:
            raise LookupError("Orden no encontrada")
        return order

    def _resolve_paid_amount(
        self,
        order: Dict,
        order_items: List[Dict],
        payments: List[Dict],
    ) -> float:
        paid_amount_value = order.get("paid_amount")
        if paid_amount_value is not None:
            stored_paid = round(_to_float(paid_amount_value, default=0.0), 2)
            if order_items:
                computed_paid = self._compute_paid_amount_from_items(order_items)
                return max(stored_paid, computed_paid)
            return stored_paid

        if order_items:
            return self._compute_paid_amount_from_items(order_items)

        return round(sum(_to_float(p.get("amount"), default=0.0) for p in payments), 2)

    def _compute_paid_amount_from_items(self, order_items: List[Dict]) -> float:
        paid_total = 0.0
        for item in order_items:
            quantity = _to_int(item.get("quantity"), default=0)
            pending_qty = _to_int(item.get("pending_qty"), default=0)
            paid_qty = max(0, quantity - pending_qty)
            paid_total += _to_float(item.get("unit_price"), default=0.0) * paid_qty
        return round(paid_total, 2)

    def _create_payment(self, payment_data: Dict) -> Tuple[Dict, bool]:
        fallback_payment = dict(payment_data)
        fallback_payment["id"] = str(uuid4())
        fallback_payment["created_at"] = datetime.now(timezone.utc).isoformat()
        try:
            payment_resp = execute_with_retry(
                lambda: supabase.table("payments").insert(payment_data).execute()
            )
            if payment_resp.data:
                return payment_resp.data[0], True
            return fallback_payment, False
        except Exception as exc:
            if not is_missing_relation_error(exc, "payments"):
                raise
            logger.warning(
                "Tabla payments no disponible; se continua con pago virtual para orden %s",
                payment_data.get("order_id"),
            )
            return fallback_payment, False

    def _update_order_with_paid_amount_fallback(self, order_id: str, payload: Dict) -> None:
        try:
            execute_with_retry(
                lambda: supabase.table("orders")
                .update(payload)
                .eq("id", order_id)
                .execute()
            )
        except Exception as exc:
            if not is_undefined_column_error(exc, "paid_amount"):
                raise
            logger.warning(
                "Columna orders.paid_amount no disponible; se actualiza orden %s sin ese campo",
                order_id,
            )
            fallback_payload = dict(payload)
            fallback_payload.pop("paid_amount", None)
            execute_with_retry(
                lambda: supabase.table("orders")
                .update(fallback_payload)
                .eq("id", order_id)
                .execute()
            )

    def _build_order_items_from_json(self, items: List[Dict]) -> List[Dict]:
        normalized: List[Dict] = []
        for index, item in enumerate(items or []):
            quantity = max(0, _to_int(item.get("quantity"), default=1))
            paid_qty = _to_int(
                item.get("paid_qty", item.get("paidQuantity", item.get("split_paid_qty", 0))),
                default=0,
            )
            paid_qty = max(0, min(paid_qty, quantity))
            pending_qty = max(0, quantity - paid_qty)

            line_id = item.get("lineId") or item.get("line_id")
            product_id = str(item.get("id", ""))
            item_id = str(line_id or f"{product_id or 'item'}::{index}")

            unit_price = _to_float(
                item.get("finalPrice", item.get("unit_price", item.get("price", 0))),
                default=0.0,
            )
            normalized.append({
                "id": item_id,
                "product_id": product_id,
                "name": item.get("name", ""),
                "unit_price": unit_price,
                "quantity": quantity,
                "pending_qty": pending_qty,
                "paid_qty": paid_qty,
                "selected_options": item.get("selectedOptions") or item.get("selected_options") or [],
                "line_id": line_id,
                "discount_amount": _to_float(
                    item.get("discountAmount", item.get("discount_amount", 0)),
                    default=0.0,
                ),
            })
        return normalized

    def _apply_allocations_to_embedded_items(
        self,
        source_items: List[Dict],
        validated_allocs: List[Dict],
    ) -> Tuple[List[Dict], bool]:
        updated_items = [dict(item) for item in (source_items or [])]
        normalized = self._build_order_items_from_json(updated_items)
        index_by_item_id = {item["id"]: idx for idx, item in enumerate(normalized)}

        for alloc in validated_allocs:
            item_id = alloc["order_item_id"]
            index = index_by_item_id.get(item_id)
            if index is None:
                raise ValueError(f"Item {item_id} no pertenece a esta orden")

            row = dict(updated_items[index])
            quantity = max(0, _to_int(row.get("quantity"), default=1))
            current_paid = _to_int(
                row.get("paid_qty", row.get("paidQuantity", row.get("split_paid_qty", 0))),
                default=0,
            )
            next_paid = min(quantity, max(0, current_paid + alloc["quantity"]))
            next_pending = max(0, quantity - next_paid)

            row["paid_qty"] = next_paid
            row["paidQuantity"] = next_paid
            row["split_paid_qty"] = next_paid
            row["pending_qty"] = next_pending
            updated_items[index] = row

        normalized_after = self._build_order_items_from_json(updated_items)
        all_paid = all(_to_int(item.get("pending_qty"), default=1) == 0 for item in normalized_after)
        return updated_items, all_paid


def _to_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


split_payment_service = SplitPaymentService()
