"""
Controller para datos del restaurante asociado al usuario autenticado
"""

from flask import Blueprint, jsonify, g
from ..middleware.auth import require_auth, require_roles
from ..db.supabase_client import supabase
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

restaurants_bp = Blueprint("restaurants", __name__, url_prefix="/restaurants")


@restaurants_bp.route("/me", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def get_my_restaurant():
    """
    Devuelve el restaurante asociado al usuario autenticado.
    """
    try:
        membership = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        row = (membership.data or [None])[0]
        if not row:
            return jsonify({"error": "Usuario sin restaurante asignado"}), 404

        restaurant_id = row.get("restaurant_id")
        restaurant = (
            supabase.table("restaurants")
            .select("id, name, slug")
            .eq("id", restaurant_id)
            .limit(1)
            .execute()
        )
        restaurant_row = (restaurant.data or [None])[0]
        if not restaurant_row:
            return jsonify({"error": "Restaurante no encontrado"}), 404

        return jsonify({"restaurant": restaurant_row}), 200
    except Exception as e:
        logger.error(f"Error obteniendo restaurante del usuario: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500
