from flask import Blueprint, request, jsonify
from datetime import datetime
import uuid
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

waiter_bp = Blueprint('waiter', __name__, url_prefix='/waiter')

# Simulación de base de datos en memoria para las llamadas al mozo
waiter_calls = []

@waiter_bp.route('/calls', methods=['POST'])
def create_waiter_call():
    """Crear una nueva llamada al mozo"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        if not data or 'mesa_id' not in data:
            return jsonify({'error': 'mesa_id es requerido'}), 400
        
        mesa_id = data['mesa_id']
        message = data.get('message', '')  # El mensaje es opcional
        
        # Crear nueva llamada
        new_call = {
            'id': str(uuid.uuid4()),
            'mesa_id': mesa_id,
            'message': message,
            'status': 'PENDING',
            'created_at': datetime.utcnow().isoformat(),
            'attended_at': None
        }
        
        waiter_calls.append(new_call)
        
        logger.info(f"Nueva llamada al mozo creada - mesa_id: {mesa_id}, message: {message}")
        
        return jsonify({
            'success': True,
            'message': 'Llamada al mozo creada exitosamente',
            'call': new_call
        }), 201
        
    except Exception as e:
        logger.error(f"Error creando llamada al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls', methods=['GET'])
def get_waiter_calls():
    """Obtener todas las llamadas al mozo"""
    try:
        # Filtrar por estado si se especifica
        status = request.args.get('status')
        
        if status:
            filtered_calls = [call for call in waiter_calls if call['status'] == status]
        else:
            filtered_calls = waiter_calls
        
        # Ordenar por fecha de creación (más recientes primero)
        filtered_calls.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jsonify({
            'success': True,
            'calls': filtered_calls
        }), 200
        
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
        
        new_status = data['status']
        
        # Validar que el status sea válido
        valid_statuses = ['PENDING', 'ATTENDED']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Status debe ser uno de: {valid_statuses}'}), 400
        
        # Buscar la llamada
        call = None
        for c in waiter_calls:
            if c['id'] == call_id:
                call = c
                break
        
        if not call:
            return jsonify({'error': 'Llamada no encontrada'}), 404
        
        # Actualizar estado
        call['status'] = new_status
        
        # Si se marca como atendida, agregar timestamp
        if new_status == 'ATTENDED':
            call['attended_at'] = datetime.utcnow().isoformat()
        
        logger.info(f"Estado de llamada al mozo actualizado - call_id: {call_id}, status: {new_status}")
        
        return jsonify({
            'success': True,
            'message': 'Estado de llamada actualizado exitosamente',
            'call': call
        }), 200
        
    except Exception as e:
        logger.error(f"Error actualizando estado de llamada al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls/<call_id>', methods=['DELETE'])
def delete_waiter_call(call_id):
    """Eliminar una llamada al mozo"""
    try:
        # Buscar la llamada
        call_index = None
        for i, c in enumerate(waiter_calls):
            if c['id'] == call_id:
                call_index = i
                break
        
        if call_index is None:
            return jsonify({'error': 'Llamada no encontrada'}), 404
        
        # Eliminar la llamada
        deleted_call = waiter_calls.pop(call_index)
        
        logger.info(f"Llamada al mozo eliminada - call_id: {call_id}")
        
        return jsonify({
            'success': True,
            'message': 'Llamada eliminada exitosamente',
            'call': deleted_call
        }), 200
        
    except Exception as e:
        logger.error(f"Error eliminando llamada al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500 

@waiter_bp.route('/notificar-mozo', methods=['POST'])
def notificar_mozo():
    """Notificar al mozo con motivo específico (pago_efectivo, pago_tarjeta, pago_qr)"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        if not data or 'mesa_id' not in data or 'motivo' not in data:
            return jsonify({'error': 'mesa_id y motivo son requeridos'}), 400
        
        mesa_id = data['mesa_id']
        motivo = data['motivo']
        usuario_id = data.get('usuario_id', '')
        message = data.get('message', '')
        
        # Validar que el motivo sea válido
        motivos_validos = ['pago_efectivo', 'pago_tarjeta', 'pago_qr']
        if motivo not in motivos_validos:
            return jsonify({'error': f'motivo debe ser uno de: {motivos_validos}'}), 400
        
        # Crear nueva notificación
        new_notification = {
            'id': str(uuid.uuid4()),
            'mesa_id': mesa_id,
            'usuario_id': usuario_id,
            'motivo': motivo,
            'message': message,
            'status': 'PENDING',
            'created_at': datetime.utcnow().isoformat(),
            'attended_at': None
        }
        
        waiter_calls.append(new_notification)
        
        logger.info(f"Nueva notificación al mozo creada - mesa_id: {mesa_id}, motivo: {motivo}")
        
        return jsonify({
            'success': True,
            'message': 'Notificación al mozo enviada exitosamente',
            'notification': new_notification
        }), 201
        
    except Exception as e:
        logger.error(f"Error notificando al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500 