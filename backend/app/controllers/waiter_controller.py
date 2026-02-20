"""
Controller para manejar llamadas y notificaciones al mozo
Delegado completamente a waiter_service para logica de negocio
"""

from flask import Blueprint, request, jsonify, g
from ..services.waiter_service import waiter_service
from ..services.order_service import order_service
from ..utils.logger import setup_logger
from ..middleware.auth import (
    AuthenticationError,
    get_token_from_request,
    optional_auth,
    require_auth,
    require_roles,
    verify_token,
)

logger = setup_logger(__name__)

waiter_bp = Blueprint('waiter', __name__, url_prefix='/waiter')

@waiter_bp.route('/calls', methods=['POST'])
@optional_auth
def create_waiter_call():
    """Crear una nueva llamada al mozo (endpoint principal de creacion)"""
    try:
        data = request.get_json() or {}
        mesa_id = data.get('mesa_id') if data else None
        branch_id = data.get('branch_id') if data else None
        token = data.get('token') if data else None

        # optional_auth ignora errores por diseño; para el flujo de caja
        # reintentamos validar Authorization si todavía no hay rol cargado.
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
                except AuthenticationError:
                    pass

        user_role = getattr(g, "user_role", None)
        is_staff_user = user_role in {"desarrollador", "admin", "caja"}

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
                    return jsonify({"error": "No autorizado para registrar pagos en otra sucursal"}), 403
                resolved_branch_id = user_branch_id

            if not resolved_branch_id:
                return jsonify({"error": "branch_id requerido"}), 400

            call, already_pending = waiter_service.create_waiter_call(
                data,
                mesa_id=mesa_id,
                branch_id=resolved_branch_id,
                token=None,
                skip_token_validation=True,
            )
        else:
            call, already_pending = waiter_service.create_waiter_call(
                data,
                mesa_id=mesa_id,
                branch_id=branch_id,
                token=token,
            )

        try:
            payment_method = data.get("payment_method")
            call_branch_id = call.get("branch_id") if isinstance(call, dict) else data.get("branch_id")
            if payment_method:
                order_service.set_payment_method_for_latest_order(
                    mesa_id,
                    payment_method,
                    branch_id=call_branch_id,
                )
        except Exception:
            pass
        status_code = 200 if already_pending else 201
        message = 'Llamada al mozo ya estaba pendiente' if already_pending else 'Llamada al mozo creada exitosamente'

        return jsonify({
            'success': True,
            'message': message,
            'already_pending': already_pending,
            'call': call
        }), status_code

    except PermissionError as e:
        return jsonify({'error': str(e)}), 401
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando llamada al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls', methods=['GET'])
@require_auth
@require_roles('desarrollador', 'admin', 'caja')
def get_waiter_calls():
    """Obtener todas las llamadas al mozo"""
    try:
        status = request.args.get('status')
        branch_id = request.args.get('branch_id')
        calls = waiter_service.get_all_calls(status=status, branch_id=branch_id)

        return jsonify({
            'success': True,
            'calls': calls
        }), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error obteniendo llamadas al mozo: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls/<call_id>/status', methods=['PUT'])
@require_auth
@require_roles('desarrollador', 'admin', 'caja')
def update_waiter_call_status(call_id):
    """Actualizar el estado de una llamada al mozo"""
    try:
        data = request.get_json()

        if not data or 'status' not in data:
            return jsonify({'error': 'status es requerido'}), 400

        updated_call = waiter_service.update_call_status_with_effects(call_id, data['status'])

        if not updated_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404

        return jsonify({
            'success': True,
            'message': 'Estado de llamada actualizado exitosamente',
            'call': updated_call
        }), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error actualizando estado de llamada: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@waiter_bp.route('/calls/<call_id>', methods=['DELETE'])
@require_auth
@require_roles('desarrollador', 'admin', 'caja')
def delete_waiter_call(call_id):
    """Eliminar (soft delete) una llamada al mozo - marca como CANCELLED"""
    try:
        deleted_call = waiter_service.delete_call(call_id)

        if not deleted_call:
            return jsonify({'error': 'Llamada no encontrada'}), 404

        return jsonify({
            'success': True,
            'message': 'Llamada cancelada exitosamente',
            'call': deleted_call
        }), 200

    except Exception as e:
        logger.error(f"Error cancelando llamada: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500
