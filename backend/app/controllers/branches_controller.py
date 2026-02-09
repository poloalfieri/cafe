from flask import Blueprint, jsonify, g, request
from ..middleware.auth import require_auth, require_roles
from ..db.supabase_client import supabase
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

branches_bp = Blueprint("branches", __name__, url_prefix="/branches")


@branches_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_branches():
    """Listar sucursales del restaurante del usuario"""
    try:
        user_id = g.user_id
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"branches": []}), 200

        restaurant_id = membership.get("restaurant_id")
        branches_resp = (
            supabase.table("branches")
            .select("*")
            .eq("restaurant_id", restaurant_id)
            .order("created_at", desc=False)
            .execute()
        )
        branches = branches_resp.data or []
        return jsonify({"branches": branches}), 200
    except Exception as e:
        logger.error(f"Error listando sucursales: {str(e)}")
        return jsonify({"error": "Error al listar sucursales"}), 500


@branches_bp.route("", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_branch():
    """Crear una sucursal para el restaurante del usuario"""
    try:
        payload = request.get_json() or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name requerido"}), 400

        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"error": "Usuario sin restaurante asociado"}), 404

        insert_data = {
            "restaurant_id": membership.get("restaurant_id"),
            "name": name,
            "address": payload.get("address"),
            "phone": payload.get("phone"),
            "email": payload.get("email"),
            "manager": payload.get("manager"),
            "share_menu": bool(payload.get("share_menu", True)),
            "active": bool(payload.get("active", True)),
            "monthly_sales": payload.get("monthly_sales") or 0,
            "total_orders": payload.get("total_orders") or 0,
        }

        response = supabase.table("branches").insert(insert_data).execute()
        branch = (response.data or [None])[0]
        if not branch:
            return jsonify({"error": "No se pudo crear la sucursal"}), 500
        return jsonify({"branch": branch}), 201
    except Exception as e:
        logger.error(f"Error creando sucursal: {str(e)}")
        return jsonify({"error": "Error al crear sucursal"}), 500


@branches_bp.route("/<branch_id>", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin")
def update_branch(branch_id):
    """Actualizar una sucursal del restaurante del usuario"""
    try:
        payload = request.get_json() or {}
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"error": "Usuario sin restaurante asociado"}), 404

        restaurant_id = membership.get("restaurant_id")
        # Verificar que la sucursal pertenezca al restaurante
        existing = (
            supabase.table("branches")
            .select("id, restaurant_id")
            .eq("id", branch_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            return jsonify({"error": "Sucursal no encontrada"}), 404

        allowed_fields = {
            "name",
            "address",
            "phone",
            "email",
            "manager",
            "share_menu",
            "active",
            "monthly_sales",
            "total_orders",
        }
        update_data = {k: v for k, v in payload.items() if k in allowed_fields}

        if not update_data:
            return jsonify({"error": "No hay datos para actualizar"}), 400

        response = (
            supabase.table("branches")
            .update(update_data)
            .eq("id", branch_id)
            .execute()
        )
        branch = (response.data or [None])[0]
        if not branch:
            return jsonify({"error": "No se pudo actualizar la sucursal"}), 500
        return jsonify({"branch": branch}), 200
    except Exception as e:
        logger.error(f"Error actualizando sucursal: {str(e)}")
        return jsonify({"error": "Error al actualizar sucursal"}), 500


@branches_bp.route("/me", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def get_my_branch():
    """
    Retorna la sucursal asociada al usuario autenticado.
    Si el usuario no tiene branch_id, retorna la primera sucursal del restaurant.
    """
    try:
        user_id = g.user_id
        membership_resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id, branch_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_resp.data or [None])[0]
        if not membership:
            return jsonify({"error": "Usuario sin restaurante asociado"}), 404

        branch_id = membership.get("branch_id")
        restaurant_id = membership.get("restaurant_id")

        if branch_id:
            branch_resp = (
                supabase.table("branches")
                .select("id, name, restaurant_id")
                .eq("id", branch_id)
                .limit(1)
                .execute()
            )
        else:
            branch_resp = (
                supabase.table("branches")
                .select("id, name, restaurant_id")
                .eq("restaurant_id", restaurant_id)
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )

        branch = (branch_resp.data or [None])[0]
        if not branch:
            return jsonify({"error": "Sucursal no encontrada"}), 404

        return jsonify({"branch": branch})
    except Exception as e:
        logger.error(f"Error obteniendo sucursal del usuario: {str(e)}")
        return jsonify({"error": "Error al obtener sucursal"}), 500
