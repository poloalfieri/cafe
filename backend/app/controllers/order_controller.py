from flask import Blueprint, jsonify, request, g

from ..middleware.auth import (
    AuthenticationError,
    get_token_from_request,
    optional_auth,
    require_auth,
    require_roles,
    verify_token,
)
from ..services.order_service import order_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

orders_bp = Blueprint("orders", __name__, url_prefix="/orders")


def _resolve_authorized_restaurant():
    restaurant_id = getattr(g, "restaurant_id", None)
    if not restaurant_id:
        return None, (jsonify({"error": "restaurant_id no resuelto"}), 400)

    user_role = getattr(g, "user_role", None)
    user_org_id = getattr(g, "user_org_id", None)
    if user_role != "desarrollador":
        if not user_org_id:
            return None, (jsonify({"error": "Usuario sin restaurante asignado"}), 403)
        if str(user_org_id) != str(restaurant_id):
            return None, (jsonify({"error": "No autorizado para este restaurante"}), 403)

    return restaurant_id, None


@orders_bp.route("", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja", "cocina")
def list_orders():
    """Listar pedidos (filtrable por branch y status)."""
    try:
        branch_id = request.args.get("branch_id") or getattr(g, "user_branch_id", None)
        restaurant_id = getattr(g, "restaurant_id", None)
        if not restaurant_id:
            return jsonify({"error": "restaurant_id no resuelto"}), 400
        status = request.args.get("status")
        orders = order_service.get_all_orders(
            branch_id=branch_id,
            restaurant_id=restaurant_id,
        )
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
        restaurant_id = getattr(g, "restaurant_id", None)
        if not restaurant_id:
            return jsonify({"error": "restaurant_id no resuelto"}), 400
        order = order_service.get_order_by_id(
            order_id,
            restaurant_id=restaurant_id,
            branch_id=getattr(g, "user_branch_id", None),
        )
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        return jsonify(order), 200
    except Exception as e:
        logger.error(f"Error obteniendo pedido {order_id}: {str(e)}")
        return jsonify({"error": "Error al obtener pedido"}), 500


@orders_bp.route("", methods=["POST"])
@optional_auth
def create_order():
    """Crear pedido (público por token o interno por rol caja/admin/desarrollador)."""
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

        # optional_auth ignora errores por diseño; para el flujo de caja
        # reintentamos validar Authorization si todavía no hay rol cargado.
        # Importante: en flujo público puede venir Authorization con token de mesa;
        # si no es un JWT de staff, no bloqueamos acá y dejamos continuar.
        bearer_user = None
        if not getattr(g, "user_role", None):
            bearer_token = get_token_from_request()
            if bearer_token:
                try:
                    user = verify_token(bearer_token)
                    g.current_user = user
                    g.user_id = user.get("id")
                    g.user_role = user.get("role")
                    g.user_org_id = user.get("org_id")
                    g.user_branch_id = user.get("branch_id")
                    bearer_user = user
                except AuthenticationError:
                    bearer_user = None

        user_role = getattr(g, "user_role", None)
        is_staff_user = user_role in {"desarrollador", "admin", "caja"}

        # Fallback: si no llegó Authorization pero token del body es JWT válido
        # de staff, usar flujo interno de caja/admin.
        if not is_staff_user and token:
            try:
                body_user = verify_token(token)
                body_role = body_user.get("role")
                if body_role in {"desarrollador", "admin", "caja"}:
                    g.current_user = body_user
                    g.user_id = body_user.get("id")
                    g.user_role = body_role
                    g.user_org_id = body_user.get("org_id")
                    g.user_branch_id = body_user.get("branch_id")
                    user_role = body_role
                    is_staff_user = True
            except AuthenticationError:
                pass

        if bearer_user and not is_staff_user:
            return jsonify({"error": "Rol no autorizado para crear pedidos"}), 403

        if is_staff_user:
            restaurant_id = getattr(g, "restaurant_id", None)
            if not restaurant_id:
                return jsonify({"error": "restaurant_id no resuelto"}), 400
            user_org_id = getattr(g, "user_org_id", None)
            if user_role != "desarrollador":
                if not user_org_id:
                    return jsonify({"error": "Usuario sin restaurante asignado"}), 403
                if str(user_org_id) != str(restaurant_id):
                    return jsonify({"error": "No autorizado para este restaurante"}), 403

            resolved_branch_id = branch_id or getattr(g, "user_branch_id", None)

            if user_role == "caja":
                user_branch_id = getattr(g, "user_branch_id", None)
                if not user_branch_id:
                    return jsonify({"error": "Usuario caja sin sucursal asignada"}), 403
                if branch_id and str(branch_id) != str(user_branch_id):
                    return jsonify({"error": "No autorizado para crear pedidos en otra sucursal"}), 403
                resolved_branch_id = user_branch_id

            if not resolved_branch_id:
                return jsonify({"error": "branch_id requerido"}), 400

            order = order_service.create_order_by_staff(
                mesa_id=mesa_id,
                items=items,
                branch_id=resolved_branch_id,
                restaurant_id=restaurant_id,
            )
        else:
            if not token:
                return jsonify({"error": "token requerido"}), 401
            order = order_service.create_order(
                mesa_id=mesa_id,
                items=items,
                token=token,
                branch_id=branch_id,
            )

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
        payment_method = payload.get("payment_method")
        if not status_key:
            return jsonify({"error": "status requerido"}), 400

        order = order_service.update_order_status_by_key(
            order_id,
            status_key,
            payment_method=payment_method,
        )
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        return jsonify(order), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error actualizando estado del pedido {order_id}: {str(e)}")
        return jsonify({"error": "Error al actualizar pedido"}), 500


@orders_bp.route("/<order_id>/prebill", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def get_order_prebill(order_id):
    """Obtener datos de orden para imprimir precuenta."""
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error
        branch_id = getattr(g, "user_branch_id", None)
        order = order_service.get_order_prebill(
            order_id,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
        )
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        return jsonify(order), 200
    except Exception as e:
        logger.error(f"Error obteniendo precuenta del pedido {order_id}: {str(e)}")
        return jsonify({"error": "Error al obtener precuenta"}), 500


@orders_bp.route("/<order_id>/prebill/mark-printed", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def mark_order_prebill_printed(order_id):
    """Marcar precuenta como impresa (idempotente)."""
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error
        branch_id = getattr(g, "user_branch_id", None)
        result = order_service.mark_prebill_printed(
            order_id,
            restaurant_id=restaurant_id,
            branch_id=branch_id,
        )
        if not result:
            return jsonify({"error": "Pedido no encontrado"}), 404
        return jsonify(
            {
                "ok": True,
                "updated": result.get("updated", False),
                "prebill_printed_at": result.get("prebill_printed_at"),
            }
        ), 200
    except Exception as e:
        logger.error(f"Error marcando precuenta impresa del pedido {order_id}: {str(e)}")
        return jsonify({"error": "Error al marcar precuenta impresa"}), 500
