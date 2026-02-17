from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.product_options_service import product_options_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

product_options_bp = Blueprint("product_options", __name__, url_prefix="/product-options")


# ── Groups ──────────────────────────────────────────────────

@product_options_bp.route("/groups", methods=["GET"])
def list_groups():
    try:
        product_id = request.args.get("productId")
        if not product_id:
            return jsonify({"error": "productId es requerido"}), 400

        restaurant_id = getattr(g, "restaurant_id", None)
        if not restaurant_id:
            user_id = getattr(g, "user_id", None)
            if not user_id:
                return jsonify({"error": "No se pudo resolver el restaurante"}), 400
            restaurant_id = product_options_service.resolve_restaurant_id(user_id)
        data = product_options_service.list_groups(restaurant_id, product_id)
        return jsonify({"data": data}), 200
    except Exception as e:
        logger.error(f"Error listando grupos de opciones: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al listar grupos de opciones"}), 500


@product_options_bp.route("/groups", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_group():
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or product_options_service.resolve_restaurant_id(g.user_id)
        group = product_options_service.create_group(restaurant_id, payload)
        return jsonify({"data": group}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando grupo de opciones: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al crear grupo de opciones"}), 500


@product_options_bp.route("/groups/<group_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_group(group_id):
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or product_options_service.resolve_restaurant_id(g.user_id)
        group = product_options_service.update_group(restaurant_id, group_id, payload)
        return jsonify({"data": group}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error actualizando grupo de opciones: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al actualizar grupo de opciones"}), 500


@product_options_bp.route("/groups/<group_id>", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_group(group_id):
    try:
        restaurant_id = getattr(g, "restaurant_id", None) or product_options_service.resolve_restaurant_id(g.user_id)
        product_options_service.delete_group(restaurant_id, group_id)
        return jsonify({"success": True}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error eliminando grupo de opciones: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al eliminar grupo de opciones"}), 500


# ── Items ───────────────────────────────────────────────────

@product_options_bp.route("/items", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def add_item():
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or product_options_service.resolve_restaurant_id(g.user_id)
        item = product_options_service.add_item(restaurant_id, payload)
        return jsonify({"data": item}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error agregando opción: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al agregar opción"}), 500


@product_options_bp.route("/items/<item_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_item(item_id):
    try:
        payload = request.get_json() or {}
        restaurant_id = getattr(g, "restaurant_id", None) or product_options_service.resolve_restaurant_id(g.user_id)
        item = product_options_service.update_item(restaurant_id, item_id, payload)
        return jsonify({"data": item}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error actualizando opción: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al actualizar opción"}), 500


@product_options_bp.route("/items/<item_id>", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_item(item_id):
    try:
        restaurant_id = getattr(g, "restaurant_id", None) or product_options_service.resolve_restaurant_id(g.user_id)
        product_options_service.delete_item(restaurant_id, item_id)
        return jsonify({"success": True}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error eliminando opción: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al eliminar opción"}), 500
