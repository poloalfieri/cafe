from flask import Blueprint, jsonify
from ..services.metrics_service import MetricsService
from ..utils.logger import setup_logger

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")
logger = setup_logger(__name__)

@metrics_bp.route("/sales-monthly", methods=["GET"])
def get_sales_monthly():
    """Endpoint para obtener ventas mensuales"""
    logger.info("Iniciando petición para obtener ventas mensuales")
    try:
        data = MetricsService.get_sales_monthly()
        logger.info(f"Ventas mensuales obtenidas exitosamente: {len(data['values'])} meses")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo ventas mensuales: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/orders-status", methods=["GET"])
def get_orders_status():
    """Endpoint para obtener estado de pedidos (aceptados vs rechazados)"""
    logger.info("Iniciando petición para obtener estado de pedidos")
    try:
        data = MetricsService.get_orders_status()
        logger.info(f"Estado de pedidos obtenido exitosamente: {data['values']}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo estado de pedidos: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/daily-revenue", methods=["GET"])
def get_daily_revenue():
    """Endpoint para obtener ingresos diarios de la última semana"""
    logger.info("Iniciando petición para obtener ingresos diarios")
    try:
        data = MetricsService.get_daily_revenue()
        logger.info(f"Ingresos diarios obtenidos exitosamente: {len(data['values'])} días")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo ingresos diarios: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@metrics_bp.route("/payment-methods", methods=["GET"])
def get_payment_methods():
    """Endpoint para obtener métodos de pago más usados"""
    logger.info("Iniciando petición para obtener métodos de pago")
    try:
        data = MetricsService.get_payment_methods()
        logger.info(f"Métodos de pago obtenidos exitosamente: {data['values']}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error obteniendo métodos de pago: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500 