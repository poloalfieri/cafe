import csv
import io
from datetime import datetime, timedelta, timezone
from flask import Blueprint, Response, g, request
from ..middleware.auth import require_auth, require_roles
from ..services.metrics_access_service import metrics_access_service
from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry
from ..utils.logger import setup_logger

reports_bp = Blueprint("reports", __name__, url_prefix="/reports")
logger = setup_logger(__name__)


def _get_restaurant_id():
    rid = metrics_access_service.get_restaurant_id(g.user_id)
    return rid


@reports_bp.route("/sales.csv", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def export_sales_csv():
    """Exporta ventas de los últimos 30 días en CSV."""
    try:
        restaurant_id = _get_restaurant_id()
        if not restaurant_id:
            return Response("Sin restaurante asociado", status=403)

        branch_id = request.args.get("branch_id")
        days = int(request.args.get("days", 30))
        days = max(1, min(days, 365))

        start = datetime.now(timezone.utc) - timedelta(days=days)
        start_iso = start.isoformat()

        def _run():
            q = (
                supabase.table("orders")
                .select("id, creation_date, total_amount, status, payment_method, branch_id")
                .eq("restaurant_id", restaurant_id)
                .gte("creation_date", start_iso)
                .order("creation_date", desc=True)
            )
            if branch_id:
                q = q.eq("branch_id", branch_id)
            return q.execute()

        resp = execute_with_retry(_run)
        orders = resp.data or []

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["fecha", "order_id", "total", "estado", "metodo_pago", "sucursal_id"])
        for o in orders:
            raw_date = o.get("creation_date") or ""
            try:
                dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                fecha = dt.strftime("%Y-%m-%d %H:%M")
            except Exception:
                fecha = raw_date
            writer.writerow([
                fecha,
                o.get("id", ""),
                o.get("total_amount", ""),
                o.get("status", ""),
                o.get("payment_method", ""),
                o.get("branch_id", ""),
            ])

        csv_bytes = output.getvalue().encode("utf-8-sig")  # BOM for Excel
        filename = f"ventas_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
        return Response(
            csv_bytes,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        logger.error(f"Error exportando sales CSV: {e}")
        return Response("Error interno", status=500)


@reports_bp.route("/stock.csv", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def export_stock_csv():
    """Exporta el stock actual de ingredientes en CSV."""
    try:
        restaurant_id = _get_restaurant_id()
        if not restaurant_id:
            return Response("Sin restaurante asociado", status=403)

        branch_id = request.args.get("branch_id")

        def _run():
            q = (
                supabase.table("ingredients")
                .select("name, unit, current_stock, min_stock, unit_cost, track_stock, branch_id")
                .eq("restaurant_id", restaurant_id)
                .order("name")
            )
            if branch_id:
                q = q.eq("branch_id", branch_id)
            return q.execute()

        resp = execute_with_retry(_run)
        ingredients = resp.data or []

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "nombre", "unidad", "stock_actual", "stock_minimo",
            "costo_unitario", "valor_total", "estado", "seguimiento_stock", "sucursal_id"
        ])
        for ing in ingredients:
            current = float(ing.get("current_stock") or 0)
            minimum = float(ing.get("min_stock") or 0)
            unit_cost = ing.get("unit_cost")
            valor_total = round(current * float(unit_cost), 2) if unit_cost is not None else ""
            costo = round(float(unit_cost), 2) if unit_cost is not None else ""
            track = ing.get("track_stock", True)
            if not track:
                estado = "sin_seguimiento"
            elif current <= 0:
                estado = "sin_stock"
            elif current <= minimum:
                estado = "critico"
            elif current < minimum * 2:
                estado = "bajo"
            else:
                estado = "ok"
            writer.writerow([
                ing.get("name", ""),
                ing.get("unit", ""),
                round(current, 2),
                round(minimum, 2),
                costo,
                valor_total,
                estado,
                "si" if track else "no",
                ing.get("branch_id", ""),
            ])

        csv_bytes = output.getvalue().encode("utf-8-sig")
        filename = f"stock_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
        return Response(
            csv_bytes,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        logger.error(f"Error exportando stock CSV: {e}")
        return Response("Error interno", status=500)
