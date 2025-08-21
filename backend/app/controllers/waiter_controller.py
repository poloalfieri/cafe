from flask import Blueprint, request, jsonify
from datetime import datetime
import uuid
from ..utils.logger import setup_logger
from ..db.connection import get_db
from sqlalchemy import text

logger = setup_logger(__name__)

waiter_bp = Blueprint('waiter', __name__, url_prefix='/waiter')

@waiter_bp.route('/calls', methods=['POST'])
def create_waiter_call():
    """Crear una nueva llamada al mozo"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        if not data or 'mesa_id' not in data or 'payment_method' not in data:
            return jsonify({'error': 'mesa_id y payment_method son requeridos'}), 400
        
        mesa_id = data['mesa_id']
        payment_method = data['payment_method']
        message = data.get('message', '')
        
        # Validar método de pago
        valid_payment_methods = ['CARD', 'CASH', 'QR']
        if payment_method not in valid_payment_methods:
            return jsonify({'error': f'payment_method debe ser uno de: {valid_payment_methods}'}), 400
        
        db = get_db()
        
        # Crear nueva llamada en la base de datos
        query = text("""
            INSERT INTO waiter_calls (mesa_id, payment_method, status)
            VALUES (:mesa_id, :payment_method, 'PENDING')
            RETURNING id, mesa_id, payment_method, status, created_at
        """)
        
        result = db.execute(query, {
            'mesa_id': mesa_id,
            'payment_method': payment_method
        })
        
        new_call = dict(result.fetchone())
        db.commit()
        
        logger.info(f"Nueva llamada al mozo creada - mesa_id: {mesa_id}, payment_method: {payment_method}")
        
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
        
        db = get_db()
        
        if status:
            query = text("""
                SELECT * FROM waiter_calls 
                WHERE status = :status 
                ORDER BY created_at DESC
            """)
            result = db.execute(query, {'status': status})
        else:
            query = text("""
                SELECT * FROM waiter_calls 
                ORDER BY created_at DESC
            """)
            result = db.execute(query)
        
        calls = [dict(row) for row in result]
        
        return jsonify({
            'success': True,
            'calls': calls
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
        
        db = get_db()
        
        # Actualizar estado
        query = text("""
            UPDATE waiter_calls 
            SET status = :status,
                updated_at = timezone('utc'::text, now())
            WHERE id = :call_id
            RETURNING *
        """)
        
        result = db.execute(query, {
            'status': new_status,
            'call_id': call_id
        })
        
        updated_call = result.fetchone()
        
        if not updated_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404
            
        db.commit()
        
        logger.info(f"Estado de llamada al mozo actualizado - call_id: {call_id}, status: {new_status}")
        
        return jsonify({
            'success': True,
            'message': 'Estado de llamada actualizado exitosamente',
            'call': dict(updated_call)
        }), 200
        
    except Exception as e:
        logger.error(f"Error actualizando estado de llamada al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls/<call_id>', methods=['DELETE'])
def delete_waiter_call(call_id):
    """Eliminar una llamada al mozo"""
    try:
        db = get_db()
        
        # Eliminar la llamada
        query = text("""
            DELETE FROM waiter_calls 
            WHERE id = :call_id
            RETURNING *
        """)
        
        result = db.execute(query, {'call_id': call_id})
        deleted_call = result.fetchone()
        
        if not deleted_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404
            
        db.commit()
        
        logger.info(f"Llamada al mozo eliminada - call_id: {call_id}")
        
        return jsonify({
            'success': True,
            'message': 'Llamada eliminada exitosamente',
            'call': dict(deleted_call)
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