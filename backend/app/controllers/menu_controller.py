"""
Controller de Menú - Solo maneja HTTP, delega lógica al servicio
"""
from flask import Blueprint, request, jsonify, g
from ..services.menu_service import menu_service
from ..middleware.auth import require_auth, require_roles, optional_auth

menu_bp = Blueprint("menu", __name__, url_prefix="/menu")


@menu_bp.route("", methods=["GET"])
@optional_auth
def get_menu():
    """Obtener lista de productos del menú (público)"""
    try:
        category = request.args.get("category")
        available = request.args.get("available")
        mesa_id = request.args.get("mesa_id")
        branch_id = request.args.get("branch_id")
        user_id = getattr(g, "user_id", None)
        items = menu_service.list_items(
            category=category,
            available=available,
            user_id=user_id,
            mesa_id=mesa_id,
            branch_id=branch_id,
        )
        return jsonify(items), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@menu_bp.route("", methods=["POST"])
@require_auth
@require_roles('desarrollador', 'admin')
def create_menu_item_protected():
    """Crear un nuevo producto en el menú (solo admin)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Datos requeridos"}), 400
        
        # Delegar toda la lógica al servicio
        new_item = menu_service.create_item(data, g.user_id)
        return jsonify(new_item), 201
        
    except ValueError as e:
        # Error de validación
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


@menu_bp.route("/<int:item_id>", methods=["GET"])
@optional_auth
def get_menu_item(item_id):
    """Obtener un producto específico del menú por ID (público)"""
    try:
        mesa_id = request.args.get("mesa_id")
        branch_id = request.args.get("branch_id")
        user_id = getattr(g, "user_id", None)
        item = menu_service.get_item_by_id(
            item_id,
            user_id=user_id,
            mesa_id=mesa_id,
            branch_id=branch_id,
        )
        
        if not item:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify(item), 200
        
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


@menu_bp.route("/<int:item_id>", methods=["PATCH"])
@require_auth
@require_roles('desarrollador', 'admin')
def update_menu_item_protected(item_id):
    """Actualizar un producto existente del menú (solo admin)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Datos requeridos"}), 400
        
        # Delegar toda la lógica al servicio
        updated_item = menu_service.update_item(item_id, data, g.user_id)
        
        if not updated_item:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify(updated_item), 200
        
    except ValueError as e:
        # Error de validación
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


@menu_bp.route("/<int:item_id>", methods=["DELETE"])
@require_auth
@require_roles('desarrollador', 'admin')
def delete_menu_item_protected(item_id):
    """Eliminar un producto del menú (solo admin)"""
    try:
        # Delegar al servicio
        deleted = menu_service.delete_item(item_id, g.user_id)
        
        if not deleted:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify({"message": "Producto eliminado correctamente"}), 200
        
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500
