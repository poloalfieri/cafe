"""
Controller para manejar pagos con Mercado Pago
Delegado completamente a payment_service para lógica de negocio
"""

from flask import Blueprint, request, jsonify, redirect
from ..services.payment_service import payment_service
from ..utils.logger import setup_logger
from ..config import Config

payment_bp = Blueprint("payment", __name__, url_prefix="/payment")
logger = setup_logger(__name__)


@payment_bp.route("/init", methods=["POST"])
def init_payment():
    """Inicializar pago con Mercado Pago Checkout Pro"""
    try:
        data = request.get_json()
        
        result = payment_service.init_payment(
            monto=data.get("monto"),
            mesa_id=data.get("mesa_id"),
            descripcion=data.get("descripcion"),
            items=data.get("items")
        )
        
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error inicializando pago: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@payment_bp.route("/create-preference", methods=["POST"])
def create_payment_preference():
    """Crear una preferencia de pago para un pedido"""
    try:
        data = request.get_json()
        
        result = payment_service.create_preference(
            total_amount=data.get("total_amount"),
            items=data.get("items"),
            mesa_id=data.get("mesa_id")
        )
        
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando preferencia: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@payment_bp.route("/success")
def payment_success():
    """Callback para pagos exitosos"""
    try:
        payment_id = request.args.get("payment_id")
        external_reference = request.args.get("external_reference")
        status = request.args.get("status")
        
        logger.info(f"Payment success callback - payment_id: {payment_id}, status: {status}")
        
        result = payment_service.handle_payment_success(payment_id, external_reference)
        
        # Redirigir al frontend con información del pedido
        return redirect(
            f"{Config.FRONTEND_URL}/payment/success?order_id={result['order_id']}"
        )
        
    except ValueError as e:
        logger.error(f"Validation error in payment_success: {str(e)}")
        return redirect(f"{Config.FRONTEND_URL}/payment/error?message={str(e)}")
    except Exception as e:
        logger.error(f"Error in payment_success: {str(e)}")
        return redirect(f"{Config.FRONTEND_URL}/payment/error?message=internal_error")


@payment_bp.route("/failure")
def payment_failure():
    """Callback para pagos fallidos"""
    try:
        payment_id = request.args.get("payment_id")
        external_reference = request.args.get("external_reference")
        status = request.args.get("status")
        
        logger.info(f"Payment failure callback - payment_id: {payment_id}, status: {status}")
        
        payment_service.handle_payment_failure(payment_id, external_reference)
        
        return redirect(f"{Config.FRONTEND_URL}/payment/error?message=payment_failed")
        
    except Exception as e:
        logger.error(f"Error in payment_failure: {str(e)}")
        return redirect(f"{Config.FRONTEND_URL}/payment/error?message=internal_error")


@payment_bp.route("/pending")
def payment_pending():
    """Callback para pagos pendientes"""
    try:
        payment_id = request.args.get("payment_id")
        external_reference = request.args.get("external_reference")
        
        logger.info(f"Payment pending callback - payment_id: {payment_id}")
        
        order_id = payment_service.handle_payment_pending(payment_id, external_reference)
        
        if order_id:
            return redirect(f"{Config.FRONTEND_URL}/payment/pending?order_id={order_id}")
        else:
            return redirect(f"{Config.FRONTEND_URL}/payment/error?message=order_not_found")
        
    except Exception as e:
        logger.error(f"Error in payment_pending: {str(e)}")
        return redirect(f"{Config.FRONTEND_URL}/payment/error?message=internal_error")
