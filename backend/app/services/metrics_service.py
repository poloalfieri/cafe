from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional
from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry

class MetricsService:
    @staticmethod
    def get_dashboard_summary(
        restaurant_id: str,
        branch_id: Optional[str] = None,
        tz_offset_minutes: Optional[int] = None
    ) -> Dict[str, Any]:
        """Resumen de métricas para el dashboard"""
        try:
            offset_minutes = tz_offset_minutes or 0
            now_utc = datetime.now(timezone.utc)
            now_local = _apply_tz_offset(now_utc, offset_minutes)
            day_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = now_local - timedelta(days=6)
            month_start = now_local - timedelta(days=30)

            query = supabase.table("orders").select(
                "total_amount, items, creation_date, status, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = execute_with_retry(query.execute)
            orders = response.data or []

            daily_sales = 0.0
            weekly_sales = 0.0
            monthly_sales = 0.0
            paid_orders_month = 0
            total_orders_month = 0
            top_products: Dict[str, Dict[str, float]] = {}

            for order in orders:
                dt = _parse_order_datetime(order.get("creation_date"))
                if not dt:
                    continue
                local_dt = _apply_tz_offset(dt, offset_minutes)
                if local_dt >= month_start:
                    total_orders_month += 1

                if order.get("status") != "PAID":
                    continue
                total = _get_order_total(order)
                if local_dt >= day_start:
                    daily_sales += total
                if local_dt >= week_start:
                    weekly_sales += total
                if local_dt >= month_start:
                    monthly_sales += total
                    paid_orders_month += 1
                    _accumulate_top_products(top_products, order.get("items"))

            avg_order_value = monthly_sales / paid_orders_month if paid_orders_month else 0.0

            top_list = list(top_products.values())
            top_list.sort(key=lambda x: (-x["quantity"], -x["revenue"], x["name"]))
            top_list = top_list[:5]

            def _run_ingredients():
                return (
                    supabase.table("ingredients")
                    .select("current_stock, min_stock, track_stock, restaurant_id")
                    .eq("restaurant_id", restaurant_id)
                    .execute()
                )
            ingredients_resp = execute_with_retry(_run_ingredients)
            ingredients = ingredients_resp.data or []
            total_ingredients = len(ingredients)
            low_stock_items = 0
            for ing in ingredients:
                track = ing.get("track_stock", True)
                if not track:
                    continue
                current = _safe_float(ing.get("current_stock"))
                minimum = _safe_float(ing.get("min_stock"))
                if current <= minimum:
                    low_stock_items += 1

            return {
                "dailySales": round(daily_sales, 2),
                "weeklySales": round(weekly_sales, 2),
                "monthlySales": round(monthly_sales, 2),
                "totalOrders": total_orders_month,
                "averageOrderValue": round(avg_order_value, 2),
                "totalIngredients": total_ingredients,
                "lowStockItems": low_stock_items,
                "topProducts": top_list,
            }
        except Exception as e:
            print(f"Error getting dashboard summary: {e}")
            return {
                "dailySales": 0,
                "weeklySales": 0,
                "monthlySales": 0,
                "totalOrders": 0,
                "averageOrderValue": 0,
                "totalIngredients": 0,
                "lowStockItems": 0,
                "topProducts": [],
            }
    @staticmethod
    def get_sales_monthly(
        restaurant_id: str,
        branch_id: Optional[str] = None,
        tz_offset_minutes: Optional[int] = None
    ) -> Dict[str, List]:
        """Obtiene las ventas mensuales del último año"""
        try:
            offset_minutes = tz_offset_minutes or 0
            now_utc = datetime.now(timezone.utc)
            now_local = _apply_tz_offset(now_utc, offset_minutes)
            start = now_local - timedelta(days=365)
            query = supabase.table("orders").select(
                "total_amount, items, creation_date, status, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = execute_with_retry(query.execute)
            orders = response.data or []

            # Mapear por mes (últimos 12)
            month_labels = []
            month_keys = []
            for i in range(12):
                dt = (now_local.replace(day=1) - timedelta(days=30 * (11 - i)))
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
                local_dt = _apply_tz_offset(dt, offset_minutes)
                if local_dt < start:
                    continue
                key = local_dt.strftime("%Y-%m")
                if key in totals:
                    totals[key] += _get_order_total(order)

            values = [round(totals[key], 2) for key in month_keys]
            return {"labels": month_labels, "values": values}
        except Exception as e:
            print(f"Error getting monthly sales: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_orders_status(
        restaurant_id: str,
        branch_id: Optional[str] = None,
        tz_offset_minutes: Optional[int] = None
    ) -> Dict[str, List]:
        """Obtiene el conteo de pedidos por estado"""
        try:
            query = supabase.table("orders").select(
                "status, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = execute_with_retry(query.execute)
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
    def get_daily_revenue(
        restaurant_id: str,
        branch_id: Optional[str] = None,
        tz_offset_minutes: Optional[int] = None
    ) -> Dict[str, List]:
        """Obtiene los ingresos diarios de la última semana"""
        try:
            offset_minutes = tz_offset_minutes or 0
            now_utc = datetime.now(timezone.utc)
            now_local = _apply_tz_offset(now_utc, offset_minutes)
            start = now_local - timedelta(days=6)
            query = supabase.table("orders").select(
                "total_amount, items, creation_date, status, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = execute_with_retry(query.execute)
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
                local_dt = _apply_tz_offset(dt, offset_minutes)
                key = local_dt.strftime("%Y-%m-%d")
                if key in totals:
                    totals[key] += _get_order_total(order)

            values = [round(totals[key], 2) for key in keys]
            return {"labels": labels, "values": values}
        except Exception as e:
            print(f"Error getting daily revenue: {e}")
            return {"labels": [], "values": []}

    @staticmethod
    def get_payment_methods(
        restaurant_id: str,
        branch_id: Optional[str] = None,
        tz_offset_minutes: Optional[int] = None
    ) -> Dict[str, List]:
        """Obtiene el uso de métodos de pago"""
        try:
            query = supabase.table("orders").select(
                "payment_method, restaurant_id, branch_id"
            ).eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = execute_with_retry(query.execute)
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


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _apply_tz_offset(dt: datetime, offset_minutes: int) -> datetime:
    utc_dt = _ensure_utc(dt)
    return utc_dt + timedelta(minutes=offset_minutes)


def _safe_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def _accumulate_top_products(bucket: Dict[str, Dict[str, float]], items: Any) -> None:
    if not isinstance(items, list):
        return
    for item in items:
        if not isinstance(item, dict):
            continue
        name = (
            item.get("name")
            or item.get("title")
            or item.get("product_name")
            or item.get("producto")
        )
        if not name:
            pid = item.get("product_id") or item.get("item_id") or item.get("id")
            name = f"Producto {pid}" if pid is not None else "Producto"

        qty = _safe_float(item.get("quantity") or item.get("qty") or 0)
        price = _safe_float(item.get("price") or item.get("unit_price") or 0)
        revenue = price * qty

        key = str(name)
        if key not in bucket:
            bucket[key] = {"name": str(name), "quantity": 0.0, "revenue": 0.0}
        bucket[key]["quantity"] += qty
        bucket[key]["revenue"] += revenue
