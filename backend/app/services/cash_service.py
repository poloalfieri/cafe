from typing import Dict, List, Optional
from datetime import datetime, timezone

from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class CashService:
    VALID_MOVEMENT_TYPES = {
        "SALE_IN",
        "REFUND_OUT",
        "EXPENSE_OUT",
        "MANUAL_IN",
        "MANUAL_OUT",
        "TIP_IN",
    }
    VALID_DIRECTIONS = {"IN", "OUT"}
    VALID_SESSION_STATUSES = {"OPEN", "CLOSED"}

    def list_registers(self, restaurant_id: str, branch_id: Optional[str] = None) -> List[Dict]:
        query = supabase.table("cash_registers").select("*").eq("restaurant_id", restaurant_id)
        if branch_id:
            query = query.eq("branch_id", branch_id)
        response = execute_with_retry(query.execute)
        return response.data or []

    def create_register(
        self,
        restaurant_id: str,
        branch_id: str,
        name: str,
        created_by_user_id: str,
    ) -> Dict:
        if not branch_id:
            raise ValueError("branch_id requerido")
        if not name or not name.strip():
            raise ValueError("name requerido")

        insert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
            "name": name.strip(),
            "active": True,
            "created_by_user_id": created_by_user_id,
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        response = execute_with_retry(lambda: supabase.table("cash_registers").insert(insert_data).execute())
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo crear la caja")
        return row

    def assign_cashier(
        self,
        restaurant_id: str,
        register_id: str,
        user_id: str,
        active: bool = True,
    ) -> Dict:
        register = self._get_register(register_id)
        if not register or register.get("restaurant_id") != restaurant_id:
            raise LookupError("Caja no encontrada")

        now_iso = self._now_iso()
        if active:
            current = (
                supabase.table("cash_register_assignments")
                .select("*")
                .eq("register_id", register_id)
                .eq("user_id", user_id)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            existing = (current.data or [None])[0]
            if existing:
                return existing
            response = (
                supabase.table("cash_register_assignments")
                .insert(
                    {
                        "register_id": register_id,
                        "restaurant_id": restaurant_id,
                        "branch_id": register.get("branch_id"),
                        "user_id": user_id,
                        "active": True,
                        "assigned_at": now_iso,
                    }
                )
                .execute()
            )
            row = (response.data or [None])[0]
            if not row:
                raise Exception("No se pudo asignar cajero a caja")
            return row

        response = (
            supabase.table("cash_register_assignments")
            .update({"active": False, "unassigned_at": now_iso})
            .eq("register_id", register_id)
            .eq("user_id", user_id)
            .eq("active", True)
            .execute()
        )
        row = (response.data or [None])[0]
        if not row:
            raise LookupError("Asignación activa no encontrada")
        return row

    def open_session(
        self,
        restaurant_id: str,
        register_id: str,
        opening_amount: float,
        opened_by_user_id: str,
        cashier_user_id: str,
    ) -> Dict:
        register = self._get_register(register_id)
        if not register or register.get("restaurant_id") != restaurant_id:
            raise LookupError("Caja no encontrada")
        if not register.get("active", True):
            raise ValueError("La caja está inactiva")
        if opening_amount < 0:
            raise ValueError("opening_amount debe ser >= 0")

        self._ensure_user_assigned(register_id, cashier_user_id)

        current = self._get_open_session_for_register(register_id)
        if current:
            raise ValueError("Ya existe una sesión abierta para esta caja")

        now_iso = self._now_iso()
        insert_data = {
            "register_id": register_id,
            "restaurant_id": restaurant_id,
            "branch_id": register.get("branch_id"),
            "cashier_user_id": cashier_user_id,
            "opened_by_user_id": opened_by_user_id,
            "opening_amount": float(opening_amount),
            "status": "OPEN",
            "opened_at": now_iso,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        response = execute_with_retry(lambda: supabase.table("cash_sessions").insert(insert_data).execute())
        session = (response.data or [None])[0]
        if not session:
            raise Exception("No se pudo abrir la caja")
        return self._attach_expected_amount(session)

    def list_sessions(
        self,
        restaurant_id: str,
        branch_id: Optional[str] = None,
        register_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict]:
        query = supabase.table("cash_sessions").select("*").eq("restaurant_id", restaurant_id)
        if branch_id:
            query = query.eq("branch_id", branch_id)
        if register_id:
            query = query.eq("register_id", register_id)
        if status and status in self.VALID_SESSION_STATUSES:
            query = query.eq("status", status)
        response = execute_with_retry(
            lambda: query.order("opened_at", desc=True).limit(limit).execute()
        )
        sessions = response.data or []
        return [self._attach_expected_amount(s) if s.get("status") == "OPEN" else s for s in sessions]

    def get_current_session(
        self,
        restaurant_id: str,
        branch_id: str,
        register_id: Optional[str] = None,
    ) -> Optional[Dict]:
        query = supabase.table("cash_sessions").select("*").eq("restaurant_id", restaurant_id).eq("status", "OPEN")
        if register_id:
            query = query.eq("register_id", register_id)
        if branch_id:
            query = query.eq("branch_id", branch_id)
        response = execute_with_retry(lambda: query.order("opened_at", desc=True).limit(1).execute())
        row = (response.data or [None])[0]
        if not row:
            return None
        return self._attach_expected_amount(row)

    def list_movements(self, session_id: str, restaurant_id: str) -> List[Dict]:
        session = self._get_session(session_id)
        if not session or session.get("restaurant_id") != restaurant_id:
            raise LookupError("Sesión no encontrada")
        response = (
            supabase.table("cash_movements")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    def add_manual_movement(
        self,
        restaurant_id: str,
        session_id: str,
        movement_type: str,
        amount: float,
        direction: str,
        created_by_user_id: str,
        note: Optional[str] = None,
        payment_method: Optional[str] = None,
        impacts_cash: bool = True,
    ) -> Dict:
        session = self._get_session(session_id)
        if not session or session.get("restaurant_id") != restaurant_id:
            raise LookupError("Sesión no encontrada")
        if session.get("status") != "OPEN":
            raise ValueError("La sesión de caja no está abierta")
        if movement_type not in self.VALID_MOVEMENT_TYPES:
            raise ValueError("movement_type inválido")
        if direction not in self.VALID_DIRECTIONS:
            raise ValueError("direction inválido")
        if amount <= 0:
            raise ValueError("amount debe ser > 0")

        insert_data = {
            "session_id": session_id,
            "register_id": session.get("register_id"),
            "restaurant_id": session.get("restaurant_id"),
            "branch_id": session.get("branch_id"),
            "type": movement_type,
            "amount": float(amount),
            "direction": direction,
            "payment_method": payment_method,
            "impacts_cash": bool(impacts_cash),
            "note": (note or "").strip(),
            "created_by_user_id": created_by_user_id,
            "created_at": self._now_iso(),
        }
        response = execute_with_retry(lambda: supabase.table("cash_movements").insert(insert_data).execute())
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo registrar movimiento de caja")
        return row

    def close_session(
        self,
        restaurant_id: str,
        session_id: str,
        closing_counted_amount: float,
        closed_by_user_id: str,
    ) -> Dict:
        session = self._get_session(session_id)
        if not session or session.get("restaurant_id") != restaurant_id:
            raise LookupError("Sesión no encontrada")
        if session.get("status") != "OPEN":
            raise ValueError("La sesión ya está cerrada")
        if closing_counted_amount < 0:
            raise ValueError("closing_counted_amount debe ser >= 0")

        expected_amount = self._calculate_expected_amount(session)
        difference_amount = float(closing_counted_amount) - float(expected_amount)

        update_data = {
            "status": "CLOSED",
            "closed_at": self._now_iso(),
            "closed_by_user_id": closed_by_user_id,
            "closing_counted_amount": float(closing_counted_amount),
            "expected_amount": float(expected_amount),
            "difference_amount": float(difference_amount),
            "updated_at": self._now_iso(),
        }
        response = (
            supabase.table("cash_sessions")
            .update(update_data)
            .eq("id", session_id)
            .eq("restaurant_id", restaurant_id)
            .eq("status", "OPEN")
            .execute()
        )
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo cerrar la sesión de caja")
        return row

    def record_order_payment(self, order: Dict, created_by_user_id: Optional[str] = None) -> Optional[Dict]:
        order_id = order.get("id")
        restaurant_id = order.get("restaurant_id")
        branch_id = order.get("branch_id")
        total_amount = float(order.get("total_amount") or 0)
        payment_method = (order.get("payment_method") or "").upper()
        if not order_id or not restaurant_id or not branch_id:
            raise ValueError("Faltan datos de orden para registrar movimiento de caja")
        if total_amount <= 0:
            return None

        existing = (
            supabase.table("cash_movements")
            .select("id")
            .eq("source_type", "ORDER")
            .eq("source_id", str(order_id))
            .eq("type", "SALE_IN")
            .limit(1)
            .execute()
        )
        already = (existing.data or [None])[0]
        if already:
            return already

        session = self.get_current_session(restaurant_id=restaurant_id, branch_id=branch_id)
        if not session:
            raise ValueError("No hay caja abierta en la sucursal para registrar el cobro")

        impacts_cash = payment_method == "CASH"
        movement = self.add_manual_movement(
            restaurant_id=restaurant_id,
            session_id=session["id"],
            movement_type="SALE_IN",
            amount=total_amount,
            direction="IN",
            created_by_user_id=created_by_user_id or "",
            note=f"Cobro de pedido {order_id}",
            payment_method=payment_method or None,
            impacts_cash=impacts_cash,
        )

        execute_with_retry(
            lambda: supabase.table("cash_movements")
            .update({"source_type": "ORDER", "source_id": str(order_id)})
            .eq("id", movement["id"])
            .execute()
        )
        movement["source_type"] = "ORDER"
        movement["source_id"] = str(order_id)
        return movement

    def record_split_payment(self, payment: Dict, created_by_user_id: str) -> Optional[Dict]:
        """Record a SALE_IN cash movement for a split payment."""
        payment_id = payment.get("id")
        restaurant_id = payment.get("restaurant_id")
        branch_id = payment.get("branch_id")
        amount = float(payment.get("amount") or 0)
        payment_method = (payment.get("payment_method") or "").upper()

        if not payment_id or not restaurant_id or not branch_id:
            raise ValueError("Faltan datos del pago para registrar movimiento de caja")
        if amount <= 0:
            return None

        # Idempotencia
        existing = (
            supabase.table("cash_movements")
            .select("id")
            .eq("source_type", "PAYMENT")
            .eq("source_id", str(payment_id))
            .eq("type", "SALE_IN")
            .limit(1)
            .execute()
        )
        already = (existing.data or [None])[0]
        if already:
            return already

        session = self.get_current_session(restaurant_id=restaurant_id, branch_id=branch_id)
        if not session:
            raise ValueError("No hay caja abierta en la sucursal para registrar el cobro")

        impacts_cash = payment_method == "CASH"
        movement = self.add_manual_movement(
            restaurant_id=restaurant_id,
            session_id=session["id"],
            movement_type="SALE_IN",
            amount=amount,
            direction="IN",
            created_by_user_id=created_by_user_id or "",
            note=f"Cobro parcial - pago {payment_id}",
            payment_method=payment_method or None,
            impacts_cash=impacts_cash,
        )

        execute_with_retry(
            lambda: supabase.table("cash_movements")
            .update({"source_type": "PAYMENT", "source_id": str(payment_id)})
            .eq("id", movement["id"])
            .execute()
        )
        movement["source_type"] = "PAYMENT"
        movement["source_id"] = str(payment_id)
        return movement

    def _attach_expected_amount(self, session: Dict) -> Dict:
        enriched = dict(session)
        enriched["expected_amount_live"] = self._calculate_expected_amount(session)
        return enriched

    def _calculate_expected_amount(self, session: Dict) -> float:
        opening = float(session.get("opening_amount") or 0)
        response = (
            supabase.table("cash_movements")
            .select("amount, direction, impacts_cash")
            .eq("session_id", session["id"])
            .execute()
        )
        movements = response.data or []
        running = opening
        for m in movements:
            if not m.get("impacts_cash", True):
                continue
            amount = float(m.get("amount") or 0)
            direction = (m.get("direction") or "").upper()
            if direction == "IN":
                running += amount
            elif direction == "OUT":
                running -= amount
        return round(running, 2)

    def _ensure_user_assigned(self, register_id: str, user_id: str) -> None:
        response = (
            supabase.table("cash_register_assignments")
            .select("id")
            .eq("register_id", register_id)
            .eq("user_id", user_id)
            .eq("active", True)
            .limit(1)
            .execute()
        )
        row = (response.data or [None])[0]
        if not row:
            raise PermissionError("El cajero no está asignado a esta caja")

    def _get_open_session_for_register(self, register_id: str) -> Optional[Dict]:
        response = (
            supabase.table("cash_sessions")
            .select("*")
            .eq("register_id", register_id)
            .eq("status", "OPEN")
            .limit(1)
            .execute()
        )
        return (response.data or [None])[0]

    def _get_register(self, register_id: str) -> Optional[Dict]:
        response = (
            supabase.table("cash_registers")
            .select("*")
            .eq("id", register_id)
            .limit(1)
            .execute()
        )
        return (response.data or [None])[0]

    def _get_session(self, session_id: str) -> Optional[Dict]:
        response = (
            supabase.table("cash_sessions")
            .select("*")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        return (response.data or [None])[0]

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


cash_service = CashService()

