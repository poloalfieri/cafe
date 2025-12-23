"""
Controller para manejar mesas y sus tokens de acceso
Delegado completamente a mesa_service para lógica de negocio
"""

from flask import Blueprint, request, jsonify
from ..services.mesa_service import mesa_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

mesa_bp = Blueprint("mesa", __name__, url_prefix="/mesa")

@mesa_bp.route("/list", methods=["GET"])
def list_mesas():
    """Listar todas las mesas"""
    try:
        mesas = mesa_service.get_all_mesas()
        
        return jsonify({
            "success": True,
            "mesas": mesas
        }), 200
        
    except Exception as e:
        logger.error(f"Error listando mesas: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@mesa_bp.route("/<mesa_id>/status", methods=["PUT"])
def update_mesa_status(mesa_id):
    """Actualizar el estado de una mesa"""
    try:
        data = request.get_json()
        is_active = data.get("is_active", True)
        
        updated_mesa = mesa_service.update_mesa_status(mesa_id, is_active)
        
        if not updated_mesa:
            return jsonify({"error": "Mesa no encontrada"}), 404
        
        return jsonify({
            "success": True,
            "mesa": updated_mesa,
            "message": f"Mesa {mesa_id} marcada como {'activa' if is_active else 'inactiva'}"
        }), 200
        
    except Exception as e:
        logger.error(f"Error actualizando estado de mesa: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@mesa_bp.route("/generate-token/<mesa_id>", methods=["POST"])
def generate_mesa_token(mesa_id):
    """Generar un nuevo token para una mesa"""
    try:
        result = mesa_service.generate_token_for_mesa(mesa_id, expiry_minutes=30)
        
        return jsonify({
            "success": True,
            **result
        }), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error generando token: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@mesa_bp.route("/validate-token/<mesa_id>", methods=["POST"])
def validate_mesa_token(mesa_id):
    """Validar un token de mesa"""
    try:
        data = request.get_json()
        token = data.get("token")
        
        result = mesa_service.validate_mesa_token(mesa_id, token)
        
        return jsonify({
            "success": True,
            **result
        }), 200
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error validando token: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@mesa_bp.route("/renew-token/<mesa_id>", methods=["POST"])
def renew_mesa_token(mesa_id):
    """Renovar el token de una mesa"""
    try:
        result = mesa_service.renew_mesa_token(mesa_id, expiry_minutes=30)
        
        return jsonify({
            "success": True,
            **result
        }), 200
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error renovando token: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500
        return jsonify({"error": str(e)}), 500 