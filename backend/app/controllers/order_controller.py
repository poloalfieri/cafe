from flask import Blueprint, jsonify, request, g

from ..middleware.auth import require_auth, require_roles
from ..services.order_service import order_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

orders_bp = Blueprint("orders", __name__, url_prefix="/orders")


@orders_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja", "cocina")
def list_orders():
    """Listar pedidos (filtrable por branch y status)."""
    try:
        branch_id = request.args.get("branch_id") or getattr(g, "user_branch_id", None)
        status = request.args.get("status")
        orders = order_service.get_all_orders(branch_id=branch_id)
        if status:
            status_normalized = status.strip().upper()
            orders = [order for order in orders if (order.get("status") or "").upper() == status_normalized]
        return jsonify(orders), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error listando pedidos: {str(e)}")
        return jsonify({"error": "Error al listar pedidos"}), 500


@orders_bp.route("/<order_id>", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja", "cocina")
def get_order(order_id):
    """Obtener un pedido por ID."""
    try:
        order = order_service.get_order_by_id(order_id)
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        return jsonify(order), 200
    except Exception as e:
        logger.error(f"Error obteniendo pedido {order_id}: {str(e)}")
        return jsonify({"error": "Error al obtener pedido"}), 500


@orders_bp.route("", methods=["POST"])
def create_order():
    """Crear pedido (público, validado por token de mesa)."""
    try:
        payload = request.get_json() or {}
        mesa_id = payload.get("mesa_id")
        branch_id = payload.get("branch_id")
        items = payload.get("items")
        token = payload.get("token")

        if not mesa_id:
            return jsonify({"error": "mesa_id requerido"}), 400
        if not items:
            return jsonify({"error": "items requeridos"}), 400
        if not token:
            return jsonify({"error": "token requerido"}), 401

        order = order_service.create_order(mesa_id=mesa_id, items=items, token=token, branch_id=branch_id)
        return jsonify(order), 201
    except PermissionError as e:
        return jsonify({"error": str(e)}), 401
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando pedido: {str(e)}")
        return jsonify({"error": "Error al crear pedido"}), 500


@orders_bp.route("/<order_id>/status", methods=["PATCH"])
@require_auth
@require_roles("desarrollador", "admin", "caja", "cocina")
def update_order_status(order_id):
    """Actualizar estado de un pedido."""
    try:
        payload = request.get_json() or {}
        status_key = payload.get("status")
        if not status_key:
            return jsonify({"error": "status requerido"}), 400

        order = order_service.update_order_status_by_key(order_id, status_key)
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        return jsonify(order), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error actualizando estado del pedido {order_id}: {str(e)}")
        return jsonify({"error": "Error al actualizar pedido"}), 500
