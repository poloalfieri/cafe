from flask import Blueprint, jsonify
from ..db.connection import get_db
from ..db.models import Order

menu_bp = Blueprint("menu", __name__, url_prefix="/menu")

@menu_bp.route("", methods=["GET"])
def get_menu():
    # Simulación, deberías traerlo de la base de datos
    menu = [
        {"id": "1", "name": "Hamburguesa Clásica", "price": 12.99, "available": True, "category": "Hamburguesas"},
        {"id": "2", "name": "Pizza Margherita", "price": 15.5, "available": True, "category": "Pizzas"},
        {"id": "3", "name": "Ensalada César", "price": 9.99, "available": True, "category": "Ensaladas"},
        {"id": "4", "name": "Pasta Carbonara", "price": 13.75, "available": True, "category": "Pastas"},
        {"id": "5", "name": "Tacos de Pollo", "price": 11.25, "available": True, "category": "Mexicana"},
        {"id": "6", "name": "Salmón Grillado", "price": 18.99, "available": True, "category": "Pescados"},
    ]
    return jsonify(menu)

@menu_bp.route("/mesas", methods=["GET"])
def get_mesas():
    db = get_db()
    mesas = db.query(Order.mesa_id).distinct().all()
    mesas_list = [m[0] for m in mesas]
    return jsonify(mesas_list) 