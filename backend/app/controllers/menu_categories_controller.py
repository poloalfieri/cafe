from flask import Blueprint, jsonify, g, request
from ..middleware.auth import require_auth, require_roles
from ..services.menu_categories_service import menu_categories_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

menu_categories_bp = Blueprint("menu_categories", __name__, url_prefix="/menu-categories")


@menu_categories_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_categories():
    try:
        branch_id = request.args.get("branch_id")
        if not branch_id:
            return jsonify({"error": "branch_id requerido"}), 400
        categories = menu_categories_service.list_categories(g.user_id, branch_id)
        return jsonify({"categories": categories}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error listando categorías: {str(e)}")
        return jsonify({"error": "Error al listar categorías"}), 500


@menu_categories_bp.route("", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_category():
    try:
        payload = request.get_json() or {}
        category = menu_categories_service.create_category(g.user_id, payload)
        return jsonify({"category": category}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error creando categoría: {str(e)}")
        return jsonify({"error": "Error al crear categoría"}), 500


@menu_categories_bp.route("/<category_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_category(category_id):
    try:
        payload = request.get_json() or {}
        category = menu_categories_service.update_category(g.user_id, category_id, payload)
        return jsonify({"category": category}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error actualizando categoría: {str(e)}")
        return jsonify({"error": "Error al actualizar categoría"}), 500


@menu_categories_bp.route("/<category_id>", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_category(category_id):
    try:
        payload = request.get_json() or {}
        branch_id = payload.get("branch_id")
        if not branch_id:
            return jsonify({"error": "branch_id requerido"}), 400
        menu_categories_service.delete_category(g.user_id, category_id, branch_id)
        return jsonify({"success": True}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error eliminando categoría: {str(e)}")
        return jsonify({"error": "Error al eliminar categoría"}), 500
