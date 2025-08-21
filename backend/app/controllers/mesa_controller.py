from flask import Blueprint, request, jsonify
from ..db.connection import get_db
from ..utils.token_manager import generate_token, validate_token, renew_token

mesa_bp = Blueprint("mesa", __name__, url_prefix="/mesa")

@mesa_bp.route("/list", methods=["GET"])
def list_mesas():
    """Listar todas las mesas"""
    try:
        # En producción, esto vendría de la base de datos
        # Por ahora, retornamos datos de ejemplo
        mesas = [
            {
                "id": "1",
                "mesa_id": "1",
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            },
            {
                "id": "2",
                "mesa_id": "2",
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            },
            {
                "id": "3",
                "mesa_id": "3",
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            },
            {
                "id": "4",
                "mesa_id": "4",
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            },
            {
                "id": "5",
                "mesa_id": "5",
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            },
            {
                "id": "6",
                "mesa_id": "6",
                "is_active": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
        ]
        
        return jsonify({
            "success": True,
            "mesas": mesas
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mesa_bp.route("/<mesa_id>/status", methods=["PUT"])
def update_mesa_status(mesa_id):
    """Actualizar el estado de una mesa"""
    try:
        data = request.get_json()
        is_active = data.get("is_active", True)
        
        # En producción, aquí actualizarías la base de datos
        # Por ahora, solo retornamos éxito
        
        return jsonify({
            "success": True,
            "mesa_id": mesa_id,
            "is_active": is_active,
            "message": f"Mesa {mesa_id} marcada como {'activa' if is_active else 'inactiva'}"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mesa_bp.route("/generate-token/<mesa_id>", methods=["POST"])
def generate_mesa_token(mesa_id):
    """Generar un nuevo token para una mesa"""
    try:
        new_token = generate_token(mesa_id, expiry_minutes=30)
        return jsonify({
            "success": True,
            "mesa_id": mesa_id,
            "token": new_token,
            "expires_in_minutes": 30
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mesa_bp.route("/validate-token/<mesa_id>", methods=["POST"])
def validate_mesa_token(mesa_id):
    """Validar un token de mesa"""
    try:
        data = request.get_json()
        token = data.get("token")
        
        if not token:
            return jsonify({"error": "Token requerido"}), 400
        
        is_valid = validate_token(mesa_id, token)
        
        return jsonify({
            "success": True,
            "mesa_id": mesa_id,
            "token": token,
            "is_valid": is_valid
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@mesa_bp.route("/renew-token/<mesa_id>", methods=["POST"])
def renew_mesa_token(mesa_id):
    """Renovar el token de una mesa"""
    try:
        new_token = renew_token(mesa_id, expiry_minutes=30)
        return jsonify({
            "success": True,
            "mesa_id": mesa_id,
            "token": new_token,
            "expires_in_minutes": 30
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500 