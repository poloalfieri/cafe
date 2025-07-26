from flask import Blueprint, request, jsonify
from ..db.connection import get_db
from ..db.models import Product
from sqlalchemy.exc import SQLAlchemyError

product_bp = Blueprint("product", __name__, url_prefix="/product")

@product_bp.route("", methods=["GET"])
def list_products():
    """Obtener lista de todos los productos"""
    try:
        db = get_db()
        products = db.query(Product).all()
        
        def serialize_product(product):
            return {
                "id": str(product.id),
                "name": product.name,
                "category": product.category,
                "price": float(product.price),
                "description": product.description,
                "available": product.available,
                "created_at": product.created_at.isoformat() if product.created_at else None,
                "updated_at": product.updated_at.isoformat() if product.updated_at else None
            }
        
        return jsonify([serialize_product(product) for product in products])
    except SQLAlchemyError as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@product_bp.route("", methods=["POST"])
def create_product():
    """Crear un nuevo producto"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ["name", "category", "price"]
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"error": f"Campo requerido: {field}"}), 400
        
        # Validar que el precio sea un número positivo
        try:
            price = float(data["price"])
            if price < 0:
                return jsonify({"error": "El precio debe ser un número positivo"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "El precio debe ser un número válido"}), 400
        
        db = get_db()
        
        # Crear nuevo producto
        new_product = Product(
            name=data["name"],
            category=data["category"],
            price=price,
            description=data.get("description", ""),
            available=data.get("available", True)
        )
        
        db.add(new_product)
        db.commit()
        db.refresh(new_product)
        
        # Retornar el producto creado
        return jsonify({
            "id": str(new_product.id),
            "name": new_product.name,
            "category": new_product.category,
            "price": float(new_product.price),
            "description": new_product.description,
            "available": new_product.available,
            "created_at": new_product.created_at.isoformat() if new_product.created_at else None,
            "updated_at": new_product.updated_at.isoformat() if new_product.updated_at else None
        }), 201
        
    except SQLAlchemyError as e:
        db.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@product_bp.route("/<int:product_id>", methods=["GET"])
def get_product(product_id):
    """Obtener un producto específico por ID"""
    try:
        db = get_db()
        product = db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        return jsonify({
            "id": str(product.id),
            "name": product.name,
            "category": product.category,
            "price": float(product.price),
            "description": product.description,
            "available": product.available,
            "created_at": product.created_at.isoformat() if product.created_at else None,
            "updated_at": product.updated_at.isoformat() if product.updated_at else None
        })
        
    except SQLAlchemyError as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@product_bp.route("/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    """Actualizar un producto existente"""
    try:
        data = request.get_json()
        db = get_db()
        
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        # Actualizar campos si están presentes
        if "name" in data:
            product.name = data["name"]
        if "category" in data:
            product.category = data["category"]
        if "price" in data:
            try:
                price = float(data["price"])
                if price < 0:
                    return jsonify({"error": "El precio debe ser un número positivo"}), 400
                product.price = price
            except (ValueError, TypeError):
                return jsonify({"error": "El precio debe ser un número válido"}), 400
        if "description" in data:
            product.description = data["description"]
        if "available" in data:
            product.available = bool(data["available"])
        
        db.commit()
        db.refresh(product)
        
        return jsonify({
            "id": str(product.id),
            "name": product.name,
            "category": product.category,
            "price": float(product.price),
            "description": product.description,
            "available": product.available,
            "created_at": product.created_at.isoformat() if product.created_at else None,
            "updated_at": product.updated_at.isoformat() if product.updated_at else None
        })
        
    except SQLAlchemyError as e:
        db.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@product_bp.route("/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    """Eliminar un producto"""
    try:
        db = get_db()
        product = db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        db.delete(product)
        db.commit()
        
        return jsonify({"message": "Producto eliminado correctamente"}), 200
        
    except SQLAlchemyError as e:
        db.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@product_bp.route("/<int:product_id>/toggle", methods=["PATCH"])
def toggle_product_availability(product_id):
    """Cambiar la disponibilidad de un producto"""
    try:
        db = get_db()
        product = db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        product.available = not product.available
        db.commit()
        db.refresh(product)
        
        return jsonify({
            "id": str(product.id),
            "name": product.name,
            "available": product.available,
            "message": f"Producto {'activado' if product.available else 'desactivado'} correctamente"
        })
        
    except SQLAlchemyError as e:
        db.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500 