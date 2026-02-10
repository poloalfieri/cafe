from flask import Blueprint, jsonify, g, request
from ..middleware.auth import require_auth, require_roles
from ..services.branches_service import branches_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

branches_bp = Blueprint("branches", __name__, url_prefix="/branches")


@branches_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_branches():
    """Listar sucursales del restaurante del usuario"""
    try:
        branches = branches_service.list_branches(g.user_id)
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
        branch = branches_service.create_branch(g.user_id, payload)
        return jsonify({"branch": branch}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
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
        branch = branches_service.update_branch(g.user_id, branch_id, payload)
        return jsonify({"branch": branch}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
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
        branch = branches_service.get_my_branch(g.user_id)
        return jsonify({"branch": branch})
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error obteniendo sucursal del usuario: {str(e)}")
        return jsonify({"error": "Error al obtener sucursal"}), 500
