"""
Controller para manejar productos
Delegado completamente a product_service para lógica de negocio
"""

from flask import Blueprint, request, jsonify
from ..services.product_service import product_service
from ..utils.logger import setup_logger
from ..middleware.auth import require_auth, require_roles

product_bp = Blueprint("product", __name__, url_prefix="/product")
products_bp = Blueprint("products", __name__, url_prefix="/products")
logger = setup_logger(__name__)


@product_bp.route("", methods=["GET"])
@products_bp.route("", methods=["GET"])
def list_products():
    """Obtener lista de todos los productos"""
    try:
        products = product_service.get_all_products()
        return jsonify(products), 200
        
    except Exception as e:
        logger.error(f"Error listando productos: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@product_bp.route("", methods=["POST"])
@require_auth
@require_roles('desarrollador', 'admin')
def create_product():
    """Crear un nuevo producto"""
    try:
        data = request.get_json()
        
        product = product_service.create_product(data)
        return jsonify(product), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creando producto: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@product_bp.route("/<int:product_id>", methods=["GET"])
def get_product(product_id):
    """Obtener un producto específico por ID"""
    try:
        product = product_service.get_product_by_id(product_id)
        
        if not product:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify(product), 200
        
    except Exception as e:
        logger.error(f"Error obteniendo producto {product_id}: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@product_bp.route("/<int:product_id>", methods=["PUT"])
@require_auth
@require_roles('desarrollador', 'admin')
def update_product(product_id):
    """Actualizar un producto existente"""
    try:
        data = request.get_json()
        
        product = product_service.update_product(product_id, data)
        
        if not product:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify(product), 200
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error actualizando producto {product_id}: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@product_bp.route("/<int:product_id>", methods=["DELETE"])
@require_auth
@require_roles('desarrollador', 'admin')
def delete_product(product_id):
    """Eliminar un producto"""
    try:
        deleted = product_service.delete_product(product_id)
        
        if not deleted:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify({"message": "Producto eliminado correctamente"}), 200
        
    except Exception as e:
        logger.error(f"Error eliminando producto {product_id}: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500


@product_bp.route("/<int:product_id>/toggle", methods=["PATCH"])
@require_auth
@require_roles('desarrollador', 'admin')
def toggle_product_availability(product_id):
    """Cambiar la disponibilidad de un producto"""
    try:
        result = product_service.toggle_availability(product_id)
        
        if not result:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error cambiando disponibilidad {product_id}: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500
