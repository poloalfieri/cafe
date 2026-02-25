from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.import_service import import_service
from ..services.ingredients_service import ingredients_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

import_bp = Blueprint("import", __name__, url_prefix="/import")


def _get_restaurant_id():
    return getattr(g, "restaurant_id", None) or ingredients_service.resolve_restaurant_id(g.user_id)


@import_bp.route("/ingredients", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def import_ingredients():
    """Importa ingredientes desde un CSV (multipart/form-data, campo 'file')."""
    try:
        if "file" not in request.files:
            return jsonify({"error": "Se requiere el campo 'file' con el CSV"}), 400
        file = request.files["file"]
        if not file.filename or not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "El archivo debe ser .csv"}), 400

        restaurant_id = _get_restaurant_id()
        branch_id = request.form.get("branch_id") or request.args.get("branch_id")
        file_bytes = file.read()

        result = import_service.import_ingredients(
            user_id=g.user_id,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            file_bytes=file_bytes,
        )
        return jsonify({"data": result}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        logger.error(f"Error importando ingredientes: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al importar ingredientes"}), 500


@import_bp.route("/products", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def import_products():
    """Importa productos del menú desde un CSV (multipart/form-data, campo 'file')."""
    try:
        if "file" not in request.files:
            return jsonify({"error": "Se requiere el campo 'file' con el CSV"}), 400
        file = request.files["file"]
        if not file.filename or not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "El archivo debe ser .csv"}), 400

        restaurant_id = _get_restaurant_id()
        branch_id = request.form.get("branch_id") or request.args.get("branch_id")
        file_bytes = file.read()

        result = import_service.import_products(
            user_id=g.user_id,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            file_bytes=file_bytes,
        )
        return jsonify({"data": result}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        logger.error(f"Error importando productos: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al importar productos"}), 500
