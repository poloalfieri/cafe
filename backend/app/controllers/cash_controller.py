from flask import Blueprint, jsonify, request, g

from ..middleware.auth import require_auth, require_roles
from ..services.cash_service import cash_service
from ..utils.logger import setup_logger
from ..utils.tenant import require_restaurant_scope

logger = setup_logger(__name__)

cash_bp = Blueprint("cash", __name__, url_prefix="/cash")


@cash_bp.route("/registers", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def list_registers():
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    branch_id = request.args.get("branch_id") or getattr(g, "user_branch_id", None)
    try:
        registers = cash_service.list_registers(restaurant_id=restaurant_id, branch_id=branch_id)
        return jsonify({"data": registers}), 200
    except Exception as e:
        logger.error(f"Error listando cajas: {str(e)}")
        return jsonify({"error": "Error al listar cajas"}), 500


@cash_bp.route("/registers", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def create_register():
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    payload = request.get_json() or {}
    branch_id = payload.get("branch_id")
    name = payload.get("name")
    try:
        register = cash_service.create_register(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            name=name,
            created_by_user_id=g.user_id,
        )
        return jsonify({"data": register}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando caja: {str(e)}")
        return jsonify({"error": "Error al crear caja"}), 500


@cash_bp.route("/registers/<register_id>/assign", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def assign_cashier(register_id):
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    payload = request.get_json() or {}
    user_id = payload.get("user_id")
    active = payload.get("active", True)
    if not user_id:
        return jsonify({"error": "user_id requerido"}), 400
    try:
        assignment = cash_service.assign_cashier(
            restaurant_id=restaurant_id,
            register_id=register_id,
            user_id=user_id,
            active=bool(active),
        )
        return jsonify({"data": assignment}), 200
    except (ValueError, PermissionError) as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error asignando cajero: {str(e)}")
        return jsonify({"error": "Error al asignar cajero"}), 500


@cash_bp.route("/sessions/open", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def open_session():
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    payload = request.get_json() or {}
    register_id = payload.get("register_id")
    opening_amount = float(payload.get("opening_amount") or 0)
    user_role = getattr(g, "user_role", None)
    cashier_user_id = payload.get("cashier_user_id") if user_role in {"desarrollador", "admin"} else g.user_id
    if not register_id:
        return jsonify({"error": "register_id requerido"}), 400
    try:
        session = cash_service.open_session(
            restaurant_id=restaurant_id,
            register_id=register_id,
            opening_amount=opening_amount,
            opened_by_user_id=g.user_id,
            cashier_user_id=cashier_user_id,
        )
        return jsonify({"data": session}), 201
    except (ValueError, PermissionError) as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error abriendo caja: {str(e)}")
        return jsonify({"error": "Error al abrir caja"}), 500


@cash_bp.route("/sessions", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin")
def list_sessions():
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    branch_id = request.args.get("branch_id")
    register_id = request.args.get("register_id")
    status = request.args.get("status")
    limit = min(int(request.args.get("limit", 50)), 200)
    try:
        sessions = cash_service.list_sessions(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            register_id=register_id,
            status=status,
            limit=limit,
        )
        return jsonify({"data": sessions}), 200
    except Exception as e:
        logger.error(f"Error listando sesiones de caja: {str(e)}")
        return jsonify({"error": "Error al listar sesiones de caja"}), 500


@cash_bp.route("/sessions/current", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def current_session():
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    register_id = request.args.get("register_id")
    branch_id = request.args.get("branch_id") or getattr(g, "user_branch_id", None)
    if not branch_id:
        return jsonify({"error": "branch_id requerido"}), 400
    try:
        session = cash_service.get_current_session(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            register_id=register_id,
        )
        return jsonify({"data": session}), 200
    except Exception as e:
        logger.error(f"Error obteniendo sesión actual de caja: {str(e)}")
        return jsonify({"error": "Error al obtener sesión de caja"}), 500


@cash_bp.route("/sessions/<session_id>/close", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def close_session(session_id):
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    payload = request.get_json() or {}
    closing_counted_amount = float(payload.get("closing_counted_amount") or 0)
    try:
        session = cash_service.close_session(
            restaurant_id=restaurant_id,
            session_id=session_id,
            closing_counted_amount=closing_counted_amount,
            closed_by_user_id=g.user_id,
        )
        return jsonify({"data": session}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error cerrando caja: {str(e)}")
        return jsonify({"error": "Error al cerrar caja"}), 500


@cash_bp.route("/sessions/<session_id>/movements", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def list_movements(session_id):
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    try:
        movements = cash_service.list_movements(session_id=session_id, restaurant_id=restaurant_id)
        return jsonify({"data": movements}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error listando movimientos de caja: {str(e)}")
        return jsonify({"error": "Error al listar movimientos"}), 500


@cash_bp.route("/movements", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def add_movement():
    restaurant_id, err = require_restaurant_scope()
    if err:
        return err
    payload = request.get_json() or {}
    try:
        movement = cash_service.add_manual_movement(
            restaurant_id=restaurant_id,
            session_id=payload.get("session_id"),
            movement_type=payload.get("type"),
            amount=float(payload.get("amount") or 0),
            direction=payload.get("direction"),
            created_by_user_id=g.user_id,
            note=payload.get("note"),
            payment_method=payload.get("payment_method"),
            impacts_cash=bool(payload.get("impacts_cash", True)),
        )
        return jsonify({"data": movement}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error creando movimiento de caja: {str(e)}")
        return jsonify({"error": "Error al crear movimiento de caja"}), 500

