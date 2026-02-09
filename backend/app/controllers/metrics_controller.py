from flask import Blueprint, jsonify, request, g
from ..services.metrics_service import MetricsService
from ..utils.logger import setup_logger
from ..middleware.auth import require_auth, require_roles
from ..db.supabase_client import supabase

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")
logger = setup_logger(__name__)

@metrics_bp.route("/summary", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_dashboard_summary():
    """Resumen de métricas para el dashboard"""
    try:
        branch_id = request.args.get("branch_id")
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({
                "dailySales": 0,
                "weeklySales": 0,
                "monthlySales": 0,
                "totalOrders": 0,
                "averageOrderValue": 0,
                "totalIngredients": 0,
                "lowStockItems": 0,
                "topProducts": [],
            })
        restaurant_id = membership.get("restaurant_id")
        data = MetricsService.get_dashboard_summary(restaurant_id, branch_id)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo summary: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/sales-monthly", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_sales_monthly():
    """Endpoint para obtener ventas mensuales"""
    logger.info("Iniciando petición para obtener ventas mensuales")
    try:
        branch_id = request.args.get("branch_id")
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"labels": [], "values": []})
        restaurant_id = membership.get("restaurant_id")
        data = MetricsService.get_sales_monthly(restaurant_id, branch_id)
        logger.info(f"Ventas mensuales obtenidas exitosamente: {len(data['values'])} meses")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo ventas mensuales: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/orders-status", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_orders_status():
    """Endpoint para obtener estado de pedidos (aceptados vs rechazados)"""
    logger.info("Iniciando petición para obtener estado de pedidos")
    try:
        branch_id = request.args.get("branch_id")
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"labels": [], "values": []})
        restaurant_id = membership.get("restaurant_id")
        data = MetricsService.get_orders_status(restaurant_id, branch_id)
        logger.info(f"Estado de pedidos obtenido exitosamente: {data['values']}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo estado de pedidos: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/daily-revenue", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_daily_revenue():
    """Endpoint para obtener ingresos diarios de la última semana"""
    logger.info("Iniciando petición para obtener ingresos diarios")
    try:
        branch_id = request.args.get("branch_id")
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"labels": [], "values": []})
        restaurant_id = membership.get("restaurant_id")
        data = MetricsService.get_daily_revenue(restaurant_id, branch_id)
        logger.info(f"Ingresos diarios obtenidos exitosamente: {len(data['values'])} días")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo ingresos diarios: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/payment-methods", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_payment_methods():
    """Endpoint para obtener métodos de pago más usados"""
    logger.info("Iniciando petición para obtener métodos de pago")
    try:
        branch_id = request.args.get("branch_id")
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"labels": [], "values": []})
        restaurant_id = membership.get("restaurant_id")
        data = MetricsService.get_payment_methods(restaurant_id, branch_id)
        logger.info(f"Métodos de pago obtenidos exitosamente: {data['values']}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo métodos de pago: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500 
