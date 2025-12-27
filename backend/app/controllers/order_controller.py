"""
Controller de Pedidos - Solo maneja HTTP, delega lógica al servicio
"""
from flask import Blueprint, request, jsonify
from ..services.order_service import order_service
from ..db.models import OrderStatus

order_bp = Blueprint("order", __name__, url_prefix="/order")


@order_bp.route("", methods=["GET"])
def list_orders():
    """Listar todos los pedidos"""
    try:
        orders = order_service.get_all_orders()
        return jsonify(orders), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@order_bp.route("/<int:order_id>", methods=["GET"])
def get_order(order_id):
    """Obtener un pedido específico"""
    try:
        order = order_service.get_order_by_id(order_id)
        
        if not order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        
        return jsonify(order), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@order_bp.route("/create/<mesa_id>", methods=["POST"])
def create_order(mesa_id):
    """Crear un nuevo pedido para una mesa"""
    try:
        # Obtener token de autenticación
        # Prioridad: 1) Header Authorization (Bearer token), 2) Body, 3) Query string (deprecated)
        token = None
        
        # Intentar obtener del header Authorization (formato: "Bearer <token>")
        auth_header = request.headers.get('Authorization', '')
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
        
        # Obtener datos del pedido (una sola vez)
        data = request.get_json() or {}
        
        # Si no está en el header, intentar del body
        if not token:
            token = data.get("token")
        
        # Si aún no está, intentar del query string (deprecated - solo para compatibilidad)
        if not token:
            token = request.args.get("token")
        
        if not data or "items" not in data:
            return jsonify({"error": "Items requeridos"}), 400
        
        items = data["items"]
        
        # Delegar al servicio
        new_order = order_service.create_order(mesa_id, items, token)
        
        return jsonify({
            "message": "Pedido creado exitosamente",
            "order": new_order
        }), 201
        
    except PermissionError as e:
        # Token inválido
        return jsonify({"error": str(e)}), 401
    except ValueError as e:
        # Datos inválidos
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


@order_bp.route("/<int:order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    """Actualizar el estado de un pedido"""
    try:
        data = request.get_json()
        
        if not data or "status" not in data:
            return jsonify({"error": "Estado requerido"}), 400
        
        # Convertir string a enum
        try:
            new_status = OrderStatus[data["status"].upper()]
        except KeyError:
            return jsonify({"error": "Estado inválido"}), 400
        
        # Delegar al servicio
        updated_order = order_service.update_order_status(order_id, new_status)
        
        if not updated_order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        
        return jsonify({
            "message": "Estado actualizado",
            "order": updated_order
        }), 200
        
    except ValueError as e:
        # Transición inválida
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


@order_bp.route("/<int:order_id>/items", methods=["POST"])
def add_items_to_order(order_id):
    """Agregar items a un pedido existente"""
    try:
        data = request.get_json()
        
        if not data or "items" not in data:
            return jsonify({"error": "Items requeridos"}), 400
        
        new_items = data["items"]
        
        # Delegar al servicio
        updated_order = order_service.add_items_to_order(order_id, new_items)
        
        if not updated_order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        
        return jsonify({
            "message": "Items agregados",
            "order": updated_order
        }), 200
        
    except ValueError as e:
        # Pedido ya pagado
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


@order_bp.route("/<int:order_id>/cancel", methods=["POST"])
def cancel_order(order_id):
    """Cancelar un pedido"""
    try:
        data = request.get_json() or {}
        reason = data.get("reason", "No especificada")
        
        # Delegar al servicio
        cancelled_order = order_service.cancel_order(order_id, reason)
        
        if not cancelled_order:
            return jsonify({"error": "Pedido no encontrado"}), 404
        
        return jsonify({
            "message": "Pedido cancelado",
            "order": cancelled_order
        }), 200
        
    except ValueError as e:
        # No se puede cancelar
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Error interno
        return jsonify({"error": "Error interno del servidor"}), 500


@order_bp.route("/mesa/<mesa_id>", methods=["GET"])
def get_orders_by_mesa(mesa_id):
    """Obtener todos los pedidos de una mesa"""
    try:
        orders = order_service.get_orders_by_mesa(mesa_id)
        return jsonify(orders), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@order_bp.route("/status/<string:status>", methods=["GET"])
def get_orders_by_status(status):
    """Obtener pedidos por estado"""
    try:
        # Convertir string a enum
        try:
            order_status = OrderStatus[status.upper()]
        except KeyError:
            return jsonify({"error": "Estado inválido"}), 400
        
        orders = order_service.get_orders_by_status(order_status)
        return jsonify(orders), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@order_bp.route("/renew_token/<mesa_id>", methods=["POST"])
def renew_token_route(mesa_id):
    """Renovar token de acceso de una mesa"""
    try:
        new_token = order_service.renew_order_token(mesa_id)
        return jsonify({"token": new_token}), 200
    except Exception as e:
        return jsonify({"error": "Error al renovar token"}), 500
