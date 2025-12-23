"""
Controller para manejar llamadas y notificaciones al mozo
Delegado completamente a waiter_service para lógica de negocio
"""

from flask import Blueprint, request, jsonify
from ..services.waiter_service import waiter_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

waiter_bp = Blueprint('waiter', __name__, url_prefix='/waiter')

@waiter_bp.route('/calls', methods=['POST'])
def create_waiter_call():
    """Crear una nueva llamada al mozo"""
    try:
        data = request.get_json()
        call = waiter_service.create_waiter_call(data)
        
        return jsonify({
            'success': True,
            'message': 'Llamada al mozo creada exitosamente',
            'call': call
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando llamada al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls', methods=['GET'])
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
def update_waiter_call_status(call_id):
    """Actualizar el estado de una llamada al mozo"""
    try:
        data = request.get_json()
        
        if not data or 'status' not in data:
            return jsonify({'error': 'status es requerido'}), 400
        
        updated_call = waiter_service.update_call_status(call_id, data['status'])
        
        if not updated_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404
        
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
def delete_waiter_call(call_id):
    """Eliminar una llamada al mozo"""
    try:
        deleted_call = waiter_service.delete_call(call_id)
        
        if not deleted_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Llamada eliminada exitosamente',
            'call': deleted_call
        }), 200
        
    except Exception as e:
        logger.error(f"Error eliminando llamada: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500 

@waiter_bp.route('/notificar-mozo', methods=['POST'])
def notificar_mozo():
    """Notificar al mozo con motivo específico (pago_efectivo, pago_tarjeta, pago_qr)"""
    try:
        data = request.get_json()
        notification = waiter_service.create_notification(data)
        
        return jsonify({
            'success': True,
            'message': 'Notificación al mozo enviada exitosamente',
            'notification': notification
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error notificando al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500 