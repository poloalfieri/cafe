from flask import Blueprint, request, jsonify
from ..utils.token_manager import validate_token, renew_token
from ..db.connection import get_db
from ..db.models import Order

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

@order_bp.route("", methods=["GET"])
def list_orders():
    db = get_db()
    orders = db.query(Order).all()
    def serialize_order(order):
        # Add sample items data for demonstration
        sample_items = [
            {
                "id": "1",
                "name": "Café Americano",
                "quantity": 2,
                "price": 3.50
            },
            {
                "id": "2", 
                "name": "Croissant",
                "quantity": 1,
                "price": 2.50
            }
        ]
        
        return {
            "id": order.id,
            "mesa_id": order.mesa_id,
            "status": order.status.value if hasattr(order.status, 'value') else order.status,
            "token": order.token,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": sample_items,  # Add sample items
            "total": sum(item["price"] * item["quantity"] for item in sample_items),  # Calculate total
            "paid_at": None  # Add paid_at field
        }
    return jsonify([serialize_order(order) for order in orders]) 