from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.promotions_service import promotions_service
from ..services.promotion_engine import apply_promotions_to_items
from ..db.supabase_client import supabase
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


@promotions_bp.route("/public", methods=["GET"])
def list_public_promotions():
    """Devuelve promotions activas con applies_to_all=true para el panel del usuario (sin auth)."""
    try:
        branch_id = request.args.get("branch_id")
        if not branch_id:
            return jsonify([]), 200
        select_cols = "id, name, type, value, description, applicable_products"
        resp_branch = (
            supabase.table("promotions")
            .select(select_cols)
            .eq("active", True)
            .eq("applies_to_all", True)
            .eq("branch_id", branch_id)
            .execute()
        )
        resp_global = (
            supabase.table("promotions")
            .select(select_cols)
            .eq("active", True)
            .eq("applies_to_all", True)
            .is_("branch_id", "null")
            .execute()
        )
        seen = set()
        result = []
        for p in (resp_branch.data or []) + (resp_global.data or []):
            if p["id"] not in seen:
                seen.add(p["id"])
                result.append(p)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error listando promotions públicas: {str(e)}")
        return jsonify([]), 200


@promotions_bp.route("/preview", methods=["POST"])
def preview_promotions():
    """Calcula preview de promociones para items del carrito (sin auth, público)."""
    try:
        payload = request.get_json() or {}
        branch_id = payload.get("branch_id")
        items = payload.get("items", [])
        if not branch_id or not items:
            return jsonify({"items": items, "savings": []}), 200

        # Resolver restaurant_id desde branch_id
        branch_resp = (
            supabase.table("branches")
            .select("restaurant_id")
            .eq("id", branch_id)
            .limit(1)
            .execute()
        )
        branch = (branch_resp.data or [None])[0]
        if not branch:
            return jsonify({"items": items, "savings": []}), 200

        restaurant_id = branch["restaurant_id"]
        logger.info(f"Preview: restaurant_id={restaurant_id}, branch_id={branch_id}, items_count={len(items)}")
        promo_items, savings_summary = apply_promotions_to_items(
            items=items,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
        )
        logger.info(f"Preview result: savings={savings_summary}")
        return jsonify({"items": promo_items, "savings": savings_summary}), 200
    except Exception as e:
        logger.error(f"Error en preview de promociones: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"items": [], "savings": []}), 200


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
