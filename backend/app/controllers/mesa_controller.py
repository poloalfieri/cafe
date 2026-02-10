"""
Controller para manejar mesas y sus tokens de acceso
Delegado completamente a mesa_service para lógica de negocio
"""

from flask import Blueprint, request, jsonify
from ..services.mesa_service import mesa_service
from ..utils.logger import setup_logger
from ..middleware.auth import require_auth, require_roles

logger = setup_logger(__name__)

mesa_bp = Blueprint("mesas", __name__, url_prefix="/mesas")

@mesa_bp.route("", methods=["GET"])
@require_auth
@require_roles('desarrollador', 'admin', 'caja')
def list_mesas():
    """Listar todas las mesas"""
    try:
        branch_id = request.args.get("branch_id")
        mesas = mesa_service.get_all_mesas(branch_id=branch_id)
        
        return jsonify({
            "success": True,
            "mesas": mesas
        }), 200
        
    except Exception as e:
        logger.error(f"Error listando mesas: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@mesa_bp.route("/<mesa_id>", methods=["PATCH"])
@require_auth
@require_roles('desarrollador', 'admin')
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

@mesa_bp.route("/<mesa_id>/token", methods=["POST"])
@require_auth
@require_roles('desarrollador', 'admin')
def generate_mesa_token(mesa_id):
    """Generar un nuevo token para una mesa"""
    try:
        data = request.get_json() or {}
        branch_id = data.get("branch_id")
        if not branch_id:
            return jsonify({"error": "branch_id requerido"}), 400
        result = mesa_service.generate_token_for_mesa(mesa_id, branch_id, expiry_minutes=30)
        
        return jsonify({
            "success": True,
            **result
        }), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error generando token: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@mesa_bp.route("/<mesa_id>/token/validate", methods=["POST"])
@require_auth
@require_roles('desarrollador', 'admin')
def validate_mesa_token(mesa_id):
    """Validar un token de mesa"""
    try:
        data = request.get_json()
        token = data.get("token")
        branch_id = data.get("branch_id")
        if not branch_id:
            return jsonify({"error": "branch_id requerido"}), 400
        
        result = mesa_service.validate_mesa_token(mesa_id, token, branch_id)
        
        return jsonify({
            "success": True,
            **result
        }), 200
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error validando token: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

@mesa_bp.route("/<mesa_id>/token/renew", methods=["POST"])
@require_auth
@require_roles('desarrollador', 'admin')
def renew_mesa_token(mesa_id):
    """Renovar el token de una mesa"""
    try:
        data = request.get_json() or {}
        branch_id = data.get("branch_id")
        if not branch_id:
            return jsonify({"error": "branch_id requerido"}), 400
        result = mesa_service.renew_mesa_token(mesa_id, branch_id, expiry_minutes=30)
        
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

@mesa_bp.route("/session", methods=["POST"])
def start_mesa_session():
    """Obtener o crear un token de sesión para una mesa (clientes)"""
    try:
        data = request.get_json() or {}
        mesa_id = data.get("mesa_id")
        branch_id = data.get("branch_id")
        if not mesa_id:
            return jsonify({"error": "mesa_id requerido"}), 400

        result = mesa_service.get_or_create_session(mesa_id, branch_id, expiry_minutes=30)
        return jsonify({"success": True, **result}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error iniciando sesión de mesa: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500
