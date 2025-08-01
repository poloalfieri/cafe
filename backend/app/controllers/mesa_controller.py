from flask import Blueprint, request, jsonify
from ..db.connection import get_db
from ..utils.token_manager import generate_token, validate_token, renew_token

mesa_bp = Blueprint("mesa", __name__, url_prefix="/mesa")

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