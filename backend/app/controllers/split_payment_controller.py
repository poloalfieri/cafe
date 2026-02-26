from flask import Blueprint, jsonify, request, g

from ..middleware.auth import require_auth, require_roles
from ..services.split_payment_service import split_payment_service
from ..utils.logger import setup_logger
from ..utils.tenant import require_restaurant_scope

logger = setup_logger(__name__)

split_payment_bp = Blueprint("split_payment", __name__, url_prefix="/orders")


def _resolve_scope():
    restaurant_id, err = require_restaurant_scope()
    if err:
        return None, None, err
    branch_id = request.args.get("branch_id") or getattr(g, "user_branch_id", None)
    return restaurant_id, branch_id, None


@split_payment_bp.route("/<order_id>/items", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def get_order_items(order_id):
    """Get order items with pending/paid quantities for split payment UI."""
    try:
        restaurant_id, branch_id, err = _resolve_scope()
        if err:
            return err
        summary = split_payment_service.get_order_payment_summary(
            order_id=order_id,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
        )
        return jsonify(summary), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error obteniendo items de orden {order_id}: {e}")
        return jsonify({"error": "Error interno"}), 500


@split_payment_bp.route("/<order_id>/payments/allocate", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def allocate_payment(order_id):
    """Register a partial payment for selected items/quantities."""
    try:
        restaurant_id, branch_id, err = _resolve_scope()
        if err:
            return err

        data = request.get_json(force=True)
        allocations = data.get("allocations", [])
        payment_method = data.get("payment_method", "")

        user_id = getattr(g, "user_id", "") or ""

        result = split_payment_service.allocate_payment(
            order_id=order_id,
            allocations=allocations,
            payment_method=payment_method,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            created_by_user_id=user_id,
        )
        return jsonify(result), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error procesando pago parcial para orden {order_id}: {e}")
        return jsonify({"error": "Error interno"}), 500


@split_payment_bp.route("/<order_id>/payments", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def list_order_payments(order_id):
    """List all payments made on an order."""
    try:
        restaurant_id, _, err = _resolve_scope()
        if err:
            return err
        payments = split_payment_service.list_order_payments(order_id=order_id)
        return jsonify({"payments": payments}), 200
    except Exception as e:
        logger.error(f"Error listando pagos de orden {order_id}: {e}")
        return jsonify({"error": "Error interno"}), 500
