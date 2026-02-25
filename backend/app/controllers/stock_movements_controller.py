from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.ingredients_service import ingredients_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

stock_movements_bp = Blueprint("stock_movements", __name__, url_prefix="/stock-movements")


@stock_movements_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_movements():
    """Listar movimientos de stock con filtros opcionales."""
    try:
        restaurant_id = (
            getattr(g, "restaurant_id", None)
            or ingredients_service.resolve_restaurant_id(g.user_id)
        )
        branch_id = request.args.get("branch_id")
        ingredient_id = request.args.get("ingredient_id")
        movement_type = request.args.get("type")
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("pageSize", 30))

        data = ingredients_service.list_movements(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            ingredient_id=ingredient_id,
            movement_type=movement_type,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
        return jsonify({"data": data}), 200
    except Exception as e:
        logger.error(f"Error listando movimientos: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al listar movimientos de stock"}), 500
