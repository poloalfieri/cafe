from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.ingredients_service import ingredients_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

ingredients_bp = Blueprint("ingredients", __name__, url_prefix="/ingredients")


@ingredients_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def list_ingredients():
    try:
        page = request.args.get("page", "1")
        page_size = request.args.get("pageSize", "20")
        search = request.args.get("search", "").strip() or None
        branch_id = request.args.get("branch_id")
        restaurant_id = getattr(g, "restaurant_id", None) or ingredients_service.resolve_restaurant_id(g.user_id)

        data = ingredients_service.list_ingredients(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            page=int(page),
            page_size=int(page_size),
            search=search,
        )
        return jsonify({"data": data}), 200
    except Exception as e:
        logger.error(f"Error listando ingredientes: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al listar ingredientes"}), 500


@ingredients_bp.route("", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_ingredient():
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or ingredients_service.resolve_restaurant_id(g.user_id)
        ingredient = ingredients_service.create_ingredient(
            g.user_id, restaurant_id, payload
        )
        return jsonify({"data": ingredient}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando ingrediente: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al crear ingrediente"}), 500


@ingredients_bp.route("/<ingredient_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_ingredient(ingredient_id):
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or ingredients_service.resolve_restaurant_id(g.user_id)
        ingredient = ingredients_service.update_ingredient(
            g.user_id, restaurant_id, ingredient_id, payload
        )
        return jsonify({"data": ingredient}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error actualizando ingrediente: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al actualizar ingrediente"}), 500


@ingredients_bp.route("/<ingredient_id>", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_ingredient(ingredient_id):
    try:
        restaurant_id = getattr(g, "restaurant_id", None) or ingredients_service.resolve_restaurant_id(g.user_id)
        ingredients_service.delete_ingredient(g.user_id, restaurant_id, ingredient_id)
        return jsonify({"success": True}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        logger.error(f"Error eliminando ingrediente: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al eliminar ingrediente"}), 500
