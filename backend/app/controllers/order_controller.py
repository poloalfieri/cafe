from flask import Blueprint, request, jsonify
from ..utils.token_manager import validate_token, renew_token
from ..db.connection import get_db

order_bp = Blueprint("order", __name__, url_prefix="/order")

@order_bp.route("/create/<mesa_id>", methods=["POST"])
def create_order(mesa_id):
    token = request.args.get("token")
    if not validate_token(mesa_id, token):
        return jsonify({"error": "Invalid or expired token"}), 401
    data = request.json
    # Guardar pedido en DB con estado PAYMENT_PENDING
    # ...
    return jsonify({"message": "Order created", "order_id": 123})

@order_bp.route("/renew_token/<mesa_id>", methods=["POST"])
def renew_token_route(mesa_id):
    new_token = renew_token(mesa_id)
    return jsonify({"token": new_token}) 