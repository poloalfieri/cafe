from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.promotions_service import promotions_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

promotions_bp = Blueprint("promotions", __name__, url_prefix="/promotions")


@promotions_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_promotions():
    try:
        branch_id = request.args.get("branch_id")
        promotions = promotions_service.list_promotions(g.user_id, branch_id)
        return jsonify({"promotions": promotions}), 200
    except Exception as e:
        logger.error(f"Error listando promociones: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al listar promociones"}), 500


@promotions_bp.route("", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_promotion():
    try:
        payload = request.get_json() or {}
        promo = promotions_service.create_promotion(g.user_id, payload)
        return jsonify({"promotion": promo}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error creando promoción: {str(e)}")
        return jsonify({"error": "Error al crear promoción"}), 500


@promotions_bp.route("/<promotion_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_promotion(promotion_id):
    try:
        payload = request.get_json() or {}
        promo = promotions_service.update_promotion(g.user_id, promotion_id, payload)
        return jsonify({"promotion": promo}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error actualizando promoción: {str(e)}")
        return jsonify({"error": "Error al actualizar promoción"}), 500


@promotions_bp.route("/<promotion_id>", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_promotion(promotion_id):
    try:
        promotions_service.delete_promotion(g.user_id, promotion_id)
        return jsonify({"success": True}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error eliminando promoción: {str(e)}")
        return jsonify({"error": "Error al eliminar promoción"}), 500
