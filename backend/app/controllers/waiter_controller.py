"""
Controller para manejar llamadas y notificaciones al mozo
Delegado completamente a waiter_service para logica de negocio
"""

from flask import Blueprint, request, jsonify
from ..services.waiter_service import waiter_service
from ..services.order_service import order_service
from ..utils.logger import setup_logger
from ..middleware.auth import require_auth, require_roles
from ..utils.token_manager import validate_token

logger = setup_logger(__name__)

waiter_bp = Blueprint('waiter', __name__, url_prefix='/waiter')

@waiter_bp.route('/calls', methods=['POST'])
def create_waiter_call():
    """Crear una nueva llamada al mozo (endpoint principal de creacion)"""
    try:
        data = request.get_json()
        mesa_id = data.get('mesa_id') if data else None
        token = data.get('token') if data else None
        if not mesa_id or not token or not validate_token(mesa_id, token):
            return jsonify({'error': 'Token de mesa invalido o requerido'}), 401
        call, already_pending = waiter_service.create_waiter_call(data)
        try:
            payment_method = data.get("payment_method")
            if payment_method:
                order_service.set_payment_method_for_latest_order(mesa_id, payment_method)
        except Exception:
            pass
        status_code = 200 if already_pending else 201
        message = 'Llamada al mozo ya estaba pendiente' if already_pending else 'Llamada al mozo creada exitosamente'

        return jsonify({
            'success': True,
            'message': message,
            'already_pending': already_pending,
            'call': call
        }), status_code

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando llamada al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls', methods=['GET'])
@require_auth
@require_roles('desarrollador', 'admin', 'caja')
def get_waiter_calls():
    """Obtener todas las llamadas al mozo"""
    try:
        status = request.args.get('status')
        calls = waiter_service.get_all_calls(status)

        return jsonify({
            'success': True,
            'calls': calls
        }), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error obteniendo llamadas al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls/<call_id>/status', methods=['PUT'])
@require_auth
@require_roles('desarrollador', 'admin', 'caja')
def update_waiter_call_status(call_id):
    """Actualizar el estado de una llamada al mozo"""
    try:
        data = request.get_json()

        if not data or 'status' not in data:
            return jsonify({'error': 'status es requerido'}), 400

        updated_call = waiter_service.update_call_status(call_id, data['status'])

        if not updated_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404

        if data['status'] == 'COMPLETED':
            try:
                mesa_id = updated_call.get('mesa_id')
                if mesa_id:
                    order_service.mark_latest_order_paid_for_mesa(mesa_id)
            except Exception:
                pass

        return jsonify({
            'success': True,
            'message': 'Estado de llamada actualizado exitosamente',
            'call': updated_call
        }), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error actualizando estado de llamada: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls/<call_id>', methods=['DELETE'])
@require_auth
@require_roles('desarrollador', 'admin', 'caja')
def delete_waiter_call(call_id):
    """Eliminar (soft delete) una llamada al mozo - marca como CANCELLED"""
    try:
        deleted_call = waiter_service.delete_call(call_id)

        if not deleted_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404

        return jsonify({
            'success': True,
            'message': 'Llamada cancelada exitosamente',
            'call': deleted_call
        }), 200

    except Exception as e:
        logger.error(f"Error cancelando llamada: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/notificar-mozo', methods=['POST'])
def notificar_mozo():
    """
    Notificar al mozo con motivo especifico (pago_efectivo, pago_tarjeta, pago_qr).
    Delega a la misma logica de creacion que /waiter/calls.
    """
    try:
        data = request.get_json()
        mesa_id = data.get('mesa_id') if data else None
        token = data.get('token') if data else None
        if not mesa_id or not token or not validate_token(mesa_id, token):
            return jsonify({'error': 'Token de mesa invalido o requerido'}), 401
        notification, already_pending = waiter_service.create_notification(data)
        status_code = 200 if already_pending else 201
        message = 'Llamada al mozo ya estaba pendiente' if already_pending else 'Notificacion al mozo enviada exitosamente'

        return jsonify({
            'success': True,
            'message': message,
            'already_pending': already_pending,
            'notification': notification
        }), status_code

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error notificando al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500
