from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.recipes_service import recipes_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

recipes_bp = Blueprint("recipes", __name__, url_prefix="/recipes")


@recipes_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def list_recipes():
    try:
        product_id = request.args.get("productId")
        if not product_id:
            return jsonify({"error": "productId es requerido"}), 400

        restaurant_id = getattr(g, "restaurant_id", None) or recipes_service.resolve_restaurant_id(g.user_id)
        data = recipes_service.list_recipes(restaurant_id, product_id)
        return jsonify({"data": data}), 200
    except Exception as e:
        logger.error(f"Error listando recetas: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al listar recetas"}), 500


@recipes_bp.route("", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_recipe():
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or recipes_service.resolve_restaurant_id(g.user_id)
        recipe = recipes_service.add_recipe(restaurant_id, payload)
        return jsonify({"data": recipe}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando receta: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al crear receta"}), 500


@recipes_bp.route("", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_recipe():
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or recipes_service.resolve_restaurant_id(g.user_id)
        recipe = recipes_service.update_recipe(restaurant_id, payload)
        return jsonify({"data": recipe}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error actualizando receta: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al actualizar receta"}), 500


@recipes_bp.route("", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_recipe():
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or recipes_service.resolve_restaurant_id(g.user_id)
        recipes_service.delete_recipe(restaurant_id, payload)
        return jsonify({"success": True}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error eliminando receta: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al eliminar receta"}), 500
