from flask import Blueprint, g, jsonify, request

from ..middleware.auth import require_auth, require_roles
from ..services.afip import AfipError
from ..services.afip_service import afip_service
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

afip_bp = Blueprint("afip", __name__)


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


def _afip_error_response(exc: AfipError):
    payload = {
        "error": exc.code,
        "message": exc.message,
    }
    if exc.details:
        payload["details"] = exc.details
    return jsonify(payload), exc.status_code


@afip_bp.route("/api/admin/afip/config", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def get_afip_config():
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error
        config = afip_service.get_admin_config(restaurant_id)
        return jsonify(config), 200
    except Exception as exc:
        logger.error(f"Error obteniendo configuración AFIP: {str(exc)}")
        return jsonify({"error": "No se pudo obtener configuración AFIP"}), 500


@afip_bp.route("/api/admin/afip/config", methods=["PUT"])
@require_auth
@require_roles("desarrollador", "admin")
def put_afip_config():
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error

        content_type = (request.content_type or "").lower()
        payload = {}
        cert_pem = None
        key_pem = None

        if "multipart/form-data" in content_type:
            payload = request.form.to_dict()
            cert_file = request.files.get("cert_file") or request.files.get("cert")
            key_file = request.files.get("key_file") or request.files.get("key")
            if cert_file:
                cert_pem = cert_file.read().decode("utf-8", errors="ignore")
            if key_file:
                key_pem = key_file.read().decode("utf-8", errors="ignore")
        else:
            payload = request.get_json(silent=True) or {}

        cert_pem = cert_pem or payload.get("cert_pem") or payload.get("cert")
        key_pem = key_pem or payload.get("key_pem") or payload.get("key")
        key_passphrase = payload.get("key_passphrase") or payload.get("passphrase")

        updated = afip_service.upsert_admin_config(
            restaurant_id=restaurant_id,
            payload=payload,
            cert_pem=cert_pem,
            key_pem=key_pem,
            key_passphrase=key_passphrase,
        )
        return jsonify(updated), 200
    except AfipError as exc:
        return _afip_error_response(exc)
    except ValueError as exc:
        return jsonify({"error": "AFIP_INVALID_CONFIG", "message": str(exc)}), 400
    except Exception as exc:
        logger.error(f"Error guardando configuración AFIP: {str(exc)}")
        return jsonify({"error": "No se pudo guardar configuración AFIP"}), 500


@afip_bp.route("/api/admin/afip/test-connection", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin")
def test_afip_connection():
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error
        payload = request.get_json(silent=True) or {}
        result = afip_service.test_connection(
            restaurant_id=restaurant_id,
            branch_id=payload.get("branch_id"),
        )
        return jsonify(result), 200
    except AfipError as exc:
        return _afip_error_response(exc)
    except Exception as exc:
        logger.error(f"Error en test AFIP: {str(exc)}")
        return jsonify({"error": "No se pudo probar conexión AFIP"}), 500


@afip_bp.route("/api/admin/branches/<branch_id>/afip-pto-vta", methods=["PUT"])
@require_auth
@require_roles("desarrollador", "admin")
def update_branch_afip_pto_vta(branch_id):
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error
        payload = request.get_json(silent=True) or {}
        updated = afip_service.update_branch_pto_vta(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            payload=payload,
        )
        return jsonify({"branch": updated}), 200
    except AfipError as exc:
        return _afip_error_response(exc)
    except ValueError as exc:
        return jsonify({"error": "AFIP_INVALID_BRANCH_CONFIG", "message": str(exc)}), 400
    except Exception as exc:
        logger.error(f"Error actualizando pto_vta AFIP en sucursal {branch_id}: {str(exc)}")
        return jsonify({"error": "No se pudo actualizar configuración AFIP de sucursal"}), 500


@afip_bp.route("/api/invoices/authorize", methods=["POST"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def authorize_invoice():
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error

        payload = request.get_json(silent=True) or {}
        user_role = getattr(g, "user_role", None)
        user_branch_id = getattr(g, "user_branch_id", None)
        if user_role == "caja":
            if not user_branch_id:
                return jsonify({"error": "Caja sin sucursal asignada"}), 403
            requested_branch_id = payload.get("branch_id") or payload.get("branchId")
            if requested_branch_id and str(requested_branch_id) != str(user_branch_id):
                return jsonify({"error": "No autorizado para facturar en otra sucursal"}), 403
            payload["branch_id"] = user_branch_id

        result = afip_service.authorize_invoice(
            restaurant_id=restaurant_id,
            payload=payload,
            user_branch_id=user_branch_id,
        )
        return jsonify(result), 200
    except AfipError as exc:
        return _afip_error_response(exc)
    except Exception as exc:
        logger.error(f"Error autorizando factura AFIP: {str(exc)}")
        return jsonify({"error": "No se pudo autorizar comprobante AFIP"}), 500


@afip_bp.route("/api/invoices/<invoice_id>", methods=["GET"])
@require_auth
@require_roles("desarrollador", "admin", "caja")
def get_invoice(invoice_id):
    try:
        restaurant_id, auth_error = _resolve_authorized_restaurant()
        if auth_error:
            return auth_error

        invoice = afip_service.get_invoice_for_print(
            restaurant_id=restaurant_id,
            invoice_id=invoice_id,
            branch_scope_id=getattr(g, "user_branch_id", None),
        )
        if not invoice:
            return jsonify({"error": "Factura no encontrada"}), 404
        return jsonify(invoice), 200
    except Exception as exc:
        logger.error(f"Error obteniendo factura {invoice_id}: {str(exc)}")
        return jsonify({"error": "No se pudo obtener factura"}), 500
