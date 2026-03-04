from flask import Blueprint, jsonify, request, g
from ..services.metrics_service import MetricsService
from ..services.ai_insights_service import AIInsightsService
from ..utils.logger import setup_logger
from ..middleware.auth import require_auth, require_roles
from ..services.metrics_access_service import metrics_access_service

metrics_bp = Blueprint("metrics", __name__, url_prefix="/metrics")
logger = setup_logger(__name__)


def _parse_tz_offset_minutes():
    tz_offset = request.args.get("tzOffset")
    if tz_offset is None:
        return None
    try:
        return int(tz_offset)
    except Exception:
        return None


def _is_force_refresh_requested() -> bool:
    raw = request.args.get("refresh")
    if raw is None:
        raw = request.args.get("force_refresh")
    if raw is None:
        return False
    return str(raw).strip().lower() in {"1", "true", "yes", "si", "sí", "on"}

@metrics_bp.route("/summary", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_dashboard_summary():
    """Resumen de métricas para el dashboard"""
    try:
        branch_id = request.args.get("branch_id")
        tz_offset_minutes = _parse_tz_offset_minutes()
        force_refresh = _is_force_refresh_requested()
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
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
        data = MetricsService.get_dashboard_summary(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
            force_refresh=force_refresh,
        )
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
        tz_offset_minutes = _parse_tz_offset_minutes()
        force_refresh = _is_force_refresh_requested()
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
            return jsonify({"labels": [], "values": []})
        data = MetricsService.get_sales_monthly(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
            force_refresh=force_refresh,
        )
        logger.info(f"Ventas mensuales obtenidas exitosamente: {len(data['values'])} meses")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo ventas mensuales: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/orders-status", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_orders_status():
    """Endpoint para obtener estado de pedidos (aceptados vs cancelados)"""
    logger.info("Iniciando petición para obtener estado de pedidos")
    try:
        branch_id = request.args.get("branch_id")
        tz_offset_minutes = _parse_tz_offset_minutes()
        force_refresh = _is_force_refresh_requested()
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
            return jsonify({"labels": [], "values": []})
        data = MetricsService.get_orders_status(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
            force_refresh=force_refresh,
        )
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
        tz_offset_minutes = _parse_tz_offset_minutes()
        force_refresh = _is_force_refresh_requested()
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
            return jsonify({"labels": [], "values": []})
        data = MetricsService.get_daily_revenue(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
            force_refresh=force_refresh,
        )
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
        tz_offset_minutes = _parse_tz_offset_minutes()
        force_refresh = _is_force_refresh_requested()
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
            return jsonify({"labels": [], "values": []})
        data = MetricsService.get_payment_methods(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
            force_refresh=force_refresh,
        )
        logger.info(f"Métodos de pago obtenidos exitosamente: {data['values']}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo métodos de pago: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500 

@metrics_bp.route("/top-products", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_top_products():
    """Endpoint para obtener productos más vendidos"""
    logger.info("Iniciando petición para obtener productos más vendidos")
    try:
        branch_id = request.args.get("branch_id")
        tz_offset_minutes = _parse_tz_offset_minutes()
        force_refresh = _is_force_refresh_requested()
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
            return jsonify({"items": []})
        data = MetricsService.get_top_products(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
            force_refresh=force_refresh,
        )
        logger.info(f"Productos top obtenidos: {len(data.get('items', []))}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo productos top: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/peak-hours", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_peak_hours():
    """Endpoint para obtener picos por horario"""
    logger.info("Iniciando petición para obtener picos por horario")
    try:
        branch_id = request.args.get("branch_id")
        tz_offset = request.args.get("tzOffset")
        tz_offset_minutes = None
        if tz_offset is not None:
            try:
                tz_offset_minutes = int(tz_offset)
            except Exception:
                tz_offset_minutes = None
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
            return jsonify({"labels": [], "values": []})
        data = MetricsService.get_peak_hours(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
        )
        logger.info(f"Picos por horario obtenidos: {len(data.get('values', []))}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo picos por horario: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@metrics_bp.route("/ai-insights", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin')
def get_ai_insights():
    """Genera un análisis IA del negocio en lenguaje natural usando Claude."""
    logger.info("Iniciando petición para obtener análisis IA")
    try:
        branch_id = request.args.get("branch_id")
        tz_offset_minutes = _parse_tz_offset_minutes()
        force_refresh = _is_force_refresh_requested()
        restaurant_id = metrics_access_service.get_restaurant_id(g.user_id)
        if not restaurant_id:
            return jsonify({"error": "Restaurante no encontrado"}), 404
        data = AIInsightsService.get_insights(
            restaurant_id,
            branch_id,
            tz_offset_minutes,
            force_refresh=force_refresh,
        )
        logger.info("Análisis IA obtenido exitosamente")
        return jsonify(data)
    except RuntimeError as e:
        # API key no configurada o paquete no instalado
        logger.warning(f"AI insights no disponible: {str(e)}")
        return jsonify({"error": str(e), "unavailable": True}), 503
    except Exception as e:
        logger.error(f"Error obteniendo análisis IA: {str(e)}")
        return jsonify({"error": "Error al generar el análisis"}), 502
