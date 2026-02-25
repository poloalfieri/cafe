"""
Endpoint /discounts — devuelve las promociones marcadas como is_manual=true.
Son las que el cajero puede aplicar manualmente por ítem al crear un pedido.
No hay tabla separada: son registros de la tabla promotions con is_manual=true.
"""
from flask import Blueprint, jsonify, g, request
import traceback
from ..middleware.auth import require_auth, require_roles
from ..services.promotions_service import promotions_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

discounts_bp = Blueprint("discounts", __name__, url_prefix="/discounts")


@discounts_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def list_manual_discounts():
    """Lista promociones manuales (is_manual=true) disponibles para el cajero."""
    try:
        branch_id = request.args.get("branch_id")
        promos = promotions_service.list_promotions(
            user_id=g.user_id,
            branch_id=branch_id,
            is_manual=True,
        )
        return jsonify({"data": promos}), 200
    except Exception as e:
        logger.error(f"Error listando descuentos manuales: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Error al listar descuentos"}), 500
