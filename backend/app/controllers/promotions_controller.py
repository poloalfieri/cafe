from flask import Blueprint, jsonify, g, request
from ..middleware.auth import require_auth, require_roles
from ..db.supabase_client import supabase
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

promotions_bp = Blueprint("promotions", __name__, url_prefix="/promotions")


def _get_restaurant_id():
    membership_resp = (
        supabase.table("restaurant_users")
        .select("restaurant_id")
        .eq("user_id", g.user_id)
        .limit(1)
        .execute()
    )
    membership = (membership_resp.data or [None])[0]
    return membership.get("restaurant_id") if membership else None


@promotions_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_promotions():
    try:
        restaurant_id = _get_restaurant_id()
        if not restaurant_id:
            return jsonify({"promotions": []}), 200
        branch_id = request.args.get("branch_id")
        query = supabase.table("promotions").select("*").eq("restaurant_id", restaurant_id)
        if branch_id:
            query = query.eq("branch_id", branch_id)
        response = query.order("created_at", desc=False).execute()
        return jsonify({"promotions": response.data or []}), 200
    except Exception as e:
        logger.error(f"Error listando promociones: {str(e)}")
        return jsonify({"error": "Error al listar promociones"}), 500


@promotions_bp.route("", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_promotion():
    try:
        restaurant_id = _get_restaurant_id()
        if not restaurant_id:
            return jsonify({"error": "Usuario sin restaurante asociado"}), 404
        payload = request.get_json() or {}
        name = (payload.get("name") or "").strip()
        promo_type = (payload.get("type") or "").strip()
        if not name or not promo_type:
            return jsonify({"error": "name y type requeridos"}), 400

        def _clean_time(value):
            if value is None:
                return None
            if isinstance(value, str) and value.strip() == "":
                return None
            return value

        insert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": payload.get("branch_id"),
            "name": name,
            "type": promo_type,
            "value": payload.get("value"),
            "description": payload.get("description"),
            "start_date": payload.get("start_date"),
            "end_date": payload.get("end_date"),
            "start_time": _clean_time(payload.get("start_time")),
            "end_time": _clean_time(payload.get("end_time")),
            "active": bool(payload.get("active", True)),
            "applicable_products": payload.get("applicable_products"),
        }
        response = supabase.table("promotions").insert(insert_data).execute()
        promo = (response.data or [None])[0]
        if not promo:
            return jsonify({"error": "No se pudo crear la promoción"}), 500
        return jsonify({"promotion": promo}), 201
    except Exception as e:
        logger.error(f"Error creando promoción: {str(e)}")
        return jsonify({"error": "Error al crear promoción"}), 500


@promotions_bp.route("/<promotion_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_promotion(promotion_id):
    try:
        restaurant_id = _get_restaurant_id()
        if not restaurant_id:
            return jsonify({"error": "Usuario sin restaurante asociado"}), 404
        payload = request.get_json() or {}
        # Verificar pertenencia
        existing = (
            supabase.table("promotions")
            .select("id, restaurant_id")
            .eq("id", promotion_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            return jsonify({"error": "Promoción no encontrada"}), 404

        allowed_fields = {
            "name",
            "type",
            "value",
            "description",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "active",
            "applicable_products",
            "branch_id",
        }
        update_data = {k: v for k, v in payload.items() if k in allowed_fields}
        if "start_time" in update_data:
            update_data["start_time"] = _clean_time(update_data.get("start_time"))
        if "end_time" in update_data:
            update_data["end_time"] = _clean_time(update_data.get("end_time"))
        if not update_data:
            return jsonify({"error": "No hay datos para actualizar"}), 400

        response = (
            supabase.table("promotions")
            .update(update_data)
            .eq("id", promotion_id)
            .execute()
        )
        promo = (response.data or [None])[0]
        if not promo:
            return jsonify({"error": "No se pudo actualizar la promoción"}), 500
        return jsonify({"promotion": promo}), 200
    except Exception as e:
        logger.error(f"Error actualizando promoción: {str(e)}")
        return jsonify({"error": "Error al actualizar promoción"}), 500


@promotions_bp.route("/<promotion_id>", methods=["DELETE"])
@require_auth
@require_roles("desarrollador", "admin")
def delete_promotion(promotion_id):
    try:
        restaurant_id = _get_restaurant_id()
        if not restaurant_id:
            return jsonify({"error": "Usuario sin restaurante asociado"}), 404
        existing = (
            supabase.table("promotions")
            .select("id, restaurant_id")
            .eq("id", promotion_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            return jsonify({"error": "Promoción no encontrada"}), 404

        response = supabase.table("promotions").delete().eq("id", promotion_id).execute()
        if not response.data:
            return jsonify({"error": "No se pudo eliminar la promoción"}), 500
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error(f"Error eliminando promoción: {str(e)}")
        return jsonify({"error": "Error al eliminar promoción"}), 500
