from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional
from ..db.supabase_client import supabase

class MetricsService:
    @staticmethod
    def get_sales_monthly(restaurant_id: str, branch_id: Optional[str] = None) -> Dict[str, List]:
        """Obtiene las ventas mensuales del último año"""
        try:
            now = datetime.now(timezone.utc)
            start = now - timedelta(days=365)
            query = supabase.table("orders").select(
                "total_amount, items, creation_date, status, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = query.execute()
            orders = response.data or []

            # Mapear por mes (últimos 12)
            month_labels = []
            month_keys = []
            for i in range(12):
                dt = (now.replace(day=1) - timedelta(days=30 * (11 - i)))
                key = dt.strftime("%Y-%m")
                label = dt.strftime("%b").capitalize()
                month_labels.append(label)
                month_keys.append(key)

            totals = {key: 0.0 for key in month_keys}
            for order in orders:
                status = order.get("status")
                if status != "PAID":
                    continue
                dt = _parse_order_datetime(order.get("creation_date"))
                if not dt:
                    continue
                if dt < start:
                    continue
                key = dt.strftime("%Y-%m")
                if key in totals:
                    totals[key] += _get_order_total(order)

            values = [round(totals[key], 2) for key in month_keys]
            return {"labels": month_labels, "values": values}
        except Exception as e:
            print(f"Error getting monthly sales: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_orders_status(restaurant_id: str, branch_id: Optional[str] = None) -> Dict[str, List]:
        """Obtiene el conteo de pedidos por estado"""
        try:
            query = supabase.table("orders").select(
                "status, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = query.execute()
            orders = response.data or []

            accepted = 0
            rejected = 0
            for order in orders:
                status = order.get("status")
                if status == "PAYMENT_REJECTED":
                    rejected += 1
                elif status == "PAID":
                    accepted += 1

            return {"labels": ["Aceptados", "Rechazados"], "values": [accepted, rejected]}
        except Exception as e:
            print(f"Error getting orders status: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_daily_revenue(restaurant_id: str, branch_id: Optional[str] = None) -> Dict[str, List]:
        """Obtiene los ingresos diarios de la última semana"""
        try:
            now = datetime.now(timezone.utc)
            start = now - timedelta(days=6)
            query = supabase.table("orders").select(
                "total_amount, items, creation_date, status, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = query.execute()
            orders = response.data or []

            labels = []
            keys = []
            for i in range(7):
                dt = (start + timedelta(days=i))
                keys.append(dt.strftime("%Y-%m-%d"))
                labels.append(dt.strftime("%a"))
            totals = {key: 0.0 for key in keys}

            for order in orders:
                status = order.get("status")
                if status != "PAID":
                    continue
                dt = _parse_order_datetime(order.get("creation_date"))
                if not dt:
                    continue
                key = dt.strftime("%Y-%m-%d")
                if key in totals:
                    totals[key] += _get_order_total(order)

            values = [round(totals[key], 2) for key in keys]
            return {"labels": labels, "values": values}
        except Exception as e:
            print(f"Error getting daily revenue: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_payment_methods(restaurant_id: str, branch_id: Optional[str] = None) -> Dict[str, List]:
        """Obtiene el uso de métodos de pago"""
        try:
            query = supabase.table("orders").select(
                "payment_method, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = query.execute()
            orders = response.data or []

            counts = {
                "Billetera": 0,
                "Tarjeta": 0,
                "Efectivo": 0,
                "QR": 0,
            }

            for order in orders:
                method = (order.get("payment_method") or "").upper()
                if method == "BILLETERA":
                    counts["Billetera"] += 1
                elif method == "CARD":
                    counts["Tarjeta"] += 1
                elif method == "CASH":
                    counts["Efectivo"] += 1
                elif method == "QR":
                    counts["QR"] += 1

            labels = list(counts.keys())
            values = [counts[label] for label in labels]
            return {"labels": labels, "values": values}
        except Exception as e:
            print(f"Error getting payment methods: {e}")
            return {"labels": [], "values": []} 


def _parse_order_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _get_order_total(order: Dict[str, Any]) -> float:
    total = order.get("total_amount")
    if total is not None:
        try:
            return float(total)
        except Exception:
            return 0.0
    items = order.get("items") or []
    if not isinstance(items, list):
        return 0.0
    acc = 0.0
    for item in items:
        try:
            price = float(item.get("price") or 0)
            qty = float(item.get("quantity") or item.get("qty") or 0)
            acc += price * qty
        except Exception:
            continue
    return acc
