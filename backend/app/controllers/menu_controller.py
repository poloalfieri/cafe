"""
Controller de Menú - Solo maneja HTTP, delega lógica al servicio
"""
from flask import Blueprint, request, jsonify
from ..services.menu_service import menu_service

menu_bp = Blueprint("menu", __name__, url_prefix="/menu")


@menu_bp.route("/", methods=["GET", "POST"])
def menu_items():
    """Manejar GET y POST para productos del menú"""
    if request.method == "GET":
        return get_menu()
    elif request.method == "POST":
        return create_menu_item()


def get_menu():
    """Obtener lista de todos los productos del menú"""
    try:
        items = menu_service.get_all_items()
        return jsonify(items), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def create_menu_item():
    """Crear un nuevo producto en el menú"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Datos requeridos"}), 400
        
        # Delegar toda la lógica al servicio
        new_item = menu_service.create_item(data)
        return jsonify(new_item), 201
        
    except ValueError as e:
        # Error de validación
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


@menu_bp.route("/<int:item_id>", methods=["GET", "PUT", "DELETE"])
def menu_item(item_id):
    """Manejar GET, PUT y DELETE para un producto específico"""
    if request.method == "GET":
        return get_menu_item(item_id)
    elif request.method == "PUT":
        return update_menu_item(item_id)
    elif request.method == "DELETE":
        return delete_menu_item(item_id)


def get_menu_item(item_id):
    """Obtener un producto específico del menú por ID"""
    try:
        item = menu_service.get_item_by_id(item_id)
        
        if not item:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify(item), 200
        
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


def update_menu_item(item_id):
    """Actualizar un producto existente del menú"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Datos requeridos"}), 400
        
        # Delegar toda la lógica al servicio
        updated_item = menu_service.update_item(item_id, data)
        
        if not updated_item:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify(updated_item), 200
        
    except ValueError as e:
        # Error de validación
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


def delete_menu_item(item_id):
    """Eliminar un producto del menú"""
    try:
        # Delegar al servicio
        deleted = menu_service.delete_item(item_id)
        
        if not deleted:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify({"message": "Producto eliminado correctamente"}), 200
        
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


@menu_bp.route("/<int:item_id>/toggle", methods=["PATCH"])
def toggle_menu_item_availability(item_id):
    """Cambiar la disponibilidad de un producto del menú"""
    try:
        # Delegar al servicio
        updated_item = menu_service.toggle_availability(item_id)
        
        if not updated_item:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        status = "activado" if updated_item["available"] else "desactivado"
        
        return jsonify({
            "id": updated_item["id"],
            "name": updated_item["name"],
            "available": updated_item["available"],
            "message": f"Producto {status} correctamente"
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


@menu_bp.route("/category/<string:category>", methods=["GET"])
def get_menu_by_category(category):
    """Obtener productos por categoría"""
    try:
        items = menu_service.get_items_by_category(category)
        return jsonify(items), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@menu_bp.route("/available", methods=["GET"])
def get_available_items():
    """Obtener solo productos disponibles"""
    try:
        items = menu_service.get_available_items()
        return jsonify(items), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
