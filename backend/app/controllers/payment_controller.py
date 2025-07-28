from flask import Blueprint, request, jsonify, redirect, url_for
from ..db.connection import get_db
from ..db.models import Order, OrderStatus, PaymentStatus
from ..services.mercadopago_service import MercadoPagoService
from ..utils.logger import setup_logger
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import uuid
from ..config import Config

payment_bp = Blueprint("payment", __name__, url_prefix="/payment")
mp_service = MercadoPagoService()
logger = setup_logger(__name__)

@payment_bp.route("/create-preference", methods=["POST"])
def create_payment_preference():
    """Crear una preferencia de pago para un pedido"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ["total_amount", "items", "mesa_id"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Campo requerido: {field}"}), 400
        
        # Validar que el monto sea positivo
        if data["total_amount"] <= 0:
            return jsonify({"error": "El monto debe ser mayor a 0"}), 400
        
        db = get_db()
        
        # Crear el pedido en la base de datos
        order_token = str(uuid.uuid4())
        new_order = Order(
            mesa_id=data["mesa_id"],
            status=OrderStatus.PAYMENT_PENDING,
            token=order_token,
            total_amount=data["total_amount"],
            items=data["items"]
        )
        
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        
        # Crear preferencia en Mercado Pago
        order_data = {
            "order_id": new_order.id,
            "total_amount": data["total_amount"],
            "items": data["items"],
            "mesa_id": data["mesa_id"]
        }
        
        mp_response = mp_service.create_preference(order_data)
        
        if not mp_response["success"]:
            # Si falla la creación de preferencia, eliminar el pedido
            db.delete(new_order)
            db.commit()
            return jsonify({"error": mp_response["error"]}), 500
        
        # Actualizar el pedido con la información de la preferencia
        new_order.payment_preference_id = mp_response["preference_id"]
        new_order.payment_init_point = mp_response["init_point"]
        db.commit()
        
        return jsonify({
            "success": True,
            "order_id": new_order.id,
            "order_token": order_token,
            "init_point": mp_response["init_point"],
            "preference_id": mp_response["preference_id"]
        })
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        return jsonify({"error": "Error en la base de datos"}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@payment_bp.route("/success")
def payment_success():
    """Callback para pagos exitosos"""
    try:
        payment_id = request.args.get("payment_id")
        external_reference = request.args.get("external_reference")
        status = request.args.get("status")
        
        logger.info(f"Payment success callback - payment_id: {payment_id}, external_reference: {external_reference}, status: {status}")
        
        if not payment_id or not external_reference:
            return redirect(f"{Config.FRONTEND_URL}/payment/error?message=missing_parameters")
        
        db = get_db()
        order = db.query(Order).filter(Order.id == external_reference).first()
        
        if not order:
            return redirect(f"{Config.FRONTEND_URL}/payment/error?message=order_not_found")
        
        # Obtener información del pago desde Mercado Pago
        payment_info = mp_service.get_payment_info(payment_id)
        
        if not payment_info["success"]:
            return redirect(f"{Config.FRONTEND_URL}/payment/error?message=payment_info_error")
        
        payment_data = payment_info["payment"]
        
        # Actualizar el pedido con la información del pago
        order.payment_id = payment_id
        order.payment_status = PaymentStatus(payment_data["status"])
        order.payment_approved_at = datetime.utcnow()
        order.status = OrderStatus.PAYMENT_APPROVED
        
        db.commit()
        
        logger.info(f"Order {order.id} payment approved - payment_id: {payment_id}")
        
        # Redirigir al frontend con información del pedido
        return redirect(f"{Config.FRONTEND_URL}/payment/success?order_id={order.id}&token={order.token}")
        
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
        
        logger.info(f"Payment failure callback - payment_id: {payment_id}, external_reference: {external_reference}, status: {status}")
        
        if external_reference:
            db = get_db()
            order = db.query(Order).filter(Order.id == external_reference).first()
            
            if order:
                order.payment_status = PaymentStatus.REJECTED
                order.payment_rejected_at = datetime.utcnow()
                order.status = OrderStatus.PAYMENT_REJECTED
                db.commit()
        
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
        
        logger.info(f"Payment pending callback - payment_id: {payment_id}, external_reference: {external_reference}")
        
        if external_reference:
            db = get_db()
            order = db.query(Order).filter(Order.id == external_reference).first()
            
            if order:
                order.payment_status = PaymentStatus.PENDING
                db.commit()
        
        return redirect(f"{Config.FRONTEND_URL}/payment/pending?order_id={external_reference}")
        
    except Exception as e:
        logger.error(f"Error in payment_pending: {str(e)}")
        return redirect(f"{Config.FRONTEND_URL}/payment/error?message=internal_error")

@payment_bp.route("/accept-order/<int:order_id>", methods=["POST"])
def accept_order(order_id):
    """Aceptar un pedido (cajero)"""
    try:
        db = get_db()
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        
        if order.status != OrderStatus.PAYMENT_APPROVED:
            return jsonify({"error": "El pedido no está en estado de pago aprobado"}), 400
        
        # Cambiar estado a "en preparación"
        order.status = OrderStatus.IN_PREPARATION
        db.commit()
        
        logger.info(f"Order {order_id} accepted by cashier")
        
        return jsonify({
            "success": True,
            "message": "Pedido aceptado correctamente",
            "order_id": order_id,
            "status": order.status.value
        })
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        return jsonify({"error": "Error en la base de datos"}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@payment_bp.route("/reject-order/<int:order_id>", methods=["POST"])
def reject_order(order_id):
    """Rechazar un pedido (cajero) - esto reembolsará el pago"""
    try:
        db = get_db()
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        
        if order.status != OrderStatus.PAYMENT_APPROVED:
            return jsonify({"error": "El pedido no está en estado de pago aprobado"}), 400
        
        if not order.payment_id:
            return jsonify({"error": "No hay información de pago para reembolsar"}), 400
        
        # Reembolsar el pago en Mercado Pago
        refund_response = mp_service.refund_payment(order.payment_id)
        
        if not refund_response["success"]:
            return jsonify({"error": f"Error al reembolsar: {refund_response['error']}"}), 500
        
        # Actualizar el pedido
        order.status = OrderStatus.PAYMENT_REJECTED
        order.payment_rejected_at = datetime.utcnow()
        order.refund_id = refund_response["refund_id"]
        db.commit()
        
        logger.info(f"Order {order_id} rejected and refunded - refund_id: {refund_response['refund_id']}")
        
        return jsonify({
            "success": True,
            "message": "Pedido rechazado y reembolso procesado",
            "order_id": order_id,
            "refund_id": refund_response["refund_id"],
            "status": order.status.value
        })
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        return jsonify({"error": "Error en la base de datos"}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@payment_bp.route("/order-status/<int:order_id>")
def get_order_status(order_id):
    """Obtener el estado de un pedido"""
    try:
        db = get_db()
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        
        return jsonify({
            "order_id": order.id,
            "status": order.status.value,
            "payment_status": order.payment_status.value if order.payment_status else None,
            "total_amount": order.total_amount,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "payment_approved_at": order.payment_approved_at.isoformat() if order.payment_approved_at else None,
            "payment_rejected_at": order.payment_rejected_at.isoformat() if order.payment_rejected_at else None
        })
        
    except Exception as e:
        logger.error(f"Error getting order status: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@payment_bp.route("/webhooks/mercadopago", methods=["POST"])
def mercadopago_webhook():
    """Webhook para recibir notificaciones de Mercado Pago"""
    try:
        data = request.get_json()
        logger.info(f"Webhook received: {data}")
        
        # Validar la firma del webhook (en producción)
        # signature = request.headers.get("X-Signature")
        # if not mp_service.validate_webhook_signature(request.data, signature):
        #     return jsonify({"error": "Invalid signature"}), 400
        
        if data.get("type") == "payment":
            payment_id = data.get("data", {}).get("id")
            
            if payment_id:
                # Obtener información actualizada del pago
                payment_info = mp_service.get_payment_info(payment_id)
                
                if payment_info["success"]:
                    payment_data = payment_info["payment"]
                    external_reference = payment_data.get("external_reference")
                    
                    if external_reference:
                        db = get_db()
                        order = db.query(Order).filter(Order.id == external_reference).first()
                        
                        if order:
                            # Actualizar el pedido con la información del pago
                            order.payment_id = payment_id
                            order.payment_status = PaymentStatus(payment_data["status"])
                            
                            if payment_data["status"] == "approved":
                                order.status = OrderStatus.PAYMENT_APPROVED
                                order.payment_approved_at = datetime.utcnow()
                            elif payment_data["status"] in ["rejected", "cancelled"]:
                                order.status = OrderStatus.PAYMENT_REJECTED
                                order.payment_rejected_at = datetime.utcnow()
                            
                            db.commit()
                            logger.info(f"Order {order.id} updated via webhook - status: {payment_data['status']}")
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        logger.error(f"Error in webhook: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500