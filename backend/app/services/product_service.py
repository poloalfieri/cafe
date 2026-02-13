"""
Servicio para manejar lógica de negocio de productos
Separa la lógica de negocio del controller HTTP
"""

from ..db.connection import get_db
from ..db.models import Product
from ..utils.logger import setup_logger
from sqlalchemy.exc import SQLAlchemyError
from typing import Dict, List, Optional

logger = setup_logger(__name__)


class ProductService:
    """Servicio para manejar lógica de negocio de productos"""
    
    @staticmethod
    def get_all_products() -> List[Dict]:
        """
        Obtener todos los productos
        
        Returns:
            Lista de productos serializados
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            products = db.query(Product).all()
            
            logger.info(f"Obtenidos {len(products)} productos")
            return [ProductService._serialize_product(p) for p in products]
            
        except SQLAlchemyError as e:
            logger.error(f"Error de base de datos al obtener productos: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            logger.error(f"Error al obtener productos: {str(e)}")
            raise
    
    @staticmethod
    def get_product_by_id(product_id: int) -> Optional[Dict]:
        """
        Obtener un producto por ID
        
        Args:
            product_id: ID del producto
            
        Returns:
            Producto serializado o None si no existe
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            product = db.query(Product).filter(Product.id == product_id).first()
            
            if not product:
                logger.warning(f"Producto {product_id} no encontrado")
                return None
            
            logger.info(f"Producto {product_id} obtenido")
            return ProductService._serialize_product(product)
            
        except SQLAlchemyError as e:
            logger.error(f"Error de base de datos al obtener producto {product_id}: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            logger.error(f"Error al obtener producto {product_id}: {str(e)}")
            raise
    
    @staticmethod
    def create_product(data: Dict) -> Dict:
        """
        Crear un nuevo producto
        
        Args:
            data: Datos del producto (name, category, price, description?, available?)
            
        Returns:
            Producto creado serializado
            
        Raises:
            ValueError: Si los datos son inválidos
            Exception: Si hay error en la base de datos
        """
        # Validar datos
        ProductService._validate_required_fields(data, ["name", "category", "price"])
        ProductService._validate_price(data["price"])
        
        db = get_db()
        
        try:
            # Crear nuevo producto
            new_product = Product(
                name=data["name"],
                category=data["category"],
                price=float(data["price"]),
                description=data.get("description", ""),
                available=data.get("available", True)
            )
            
            db.add(new_product)
            db.commit()
            db.refresh(new_product)
            
            logger.info(f"Producto creado: {new_product.id} - {new_product.name}")
            return ProductService._serialize_product(new_product)
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error de base de datos al crear producto: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            db.rollback()
            logger.error(f"Error al crear producto: {str(e)}")
            raise
    
    @staticmethod
    def update_product(product_id: int, data: Dict) -> Optional[Dict]:
        """
        Actualizar un producto existente
        
        Args:
            product_id: ID del producto
            data: Datos a actualizar
            
        Returns:
            Producto actualizado serializado o None si no existe
            
        Raises:
            ValueError: Si los datos son inválidos
            Exception: Si hay error en la base de datos
        """
        # Validar precio si está presente
        if "price" in data:
            ProductService._validate_price(data["price"])
        
        db = get_db()
        
        try:
            product = db.query(Product).filter(Product.id == product_id).first()
            
            if not product:
                logger.warning(f"Producto {product_id} no encontrado para actualizar")
                return None
            
            # Actualizar campos si están presentes
            if "name" in data:
                product.name = data["name"]
            if "category" in data:
                product.category = data["category"]
            if "price" in data:
                product.price = float(data["price"])
            if "description" in data:
                product.description = data["description"]
            if "available" in data:
                product.available = bool(data["available"])
            
            db.commit()
            db.refresh(product)
            
            logger.info(f"Producto {product_id} actualizado")
            return ProductService._serialize_product(product)
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error de base de datos al actualizar producto {product_id}: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            db.rollback()
            logger.error(f"Error al actualizar producto {product_id}: {str(e)}")
            raise
    
    @staticmethod
    def delete_product(product_id: int) -> bool:
        """
        Eliminar un producto
        
        Args:
            product_id: ID del producto
            
        Returns:
            True si se eliminó, False si no existe
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        db = get_db()
        
        try:
            product = db.query(Product).filter(Product.id == product_id).first()
            
            if not product:
                logger.warning(f"Producto {product_id} no encontrado para eliminar")
                return False
            
            product_name = product.name
            db.delete(product)
            db.commit()
            
            logger.info(f"Producto {product_id} ({product_name}) eliminado")
            return True
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error de base de datos al eliminar producto {product_id}: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            db.rollback()
            logger.error(f"Error al eliminar producto {product_id}: {str(e)}")
            raise
    
    @staticmethod
    def toggle_availability(product_id: int) -> Optional[Dict]:
        """
        Cambiar la disponibilidad de un producto
        
        Args:
            product_id: ID del producto
            
        Returns:
            Producto actualizado serializado o None si no existe
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        db = get_db()
        
        try:
            product = db.query(Product).filter(Product.id == product_id).first()
            
            if not product:
                logger.warning(f"Producto {product_id} no encontrado para toggle")
                return None
            
            product.available = not product.available
            db.commit()
            db.refresh(product)
            
            logger.info(f"Producto {product_id} disponibilidad cambiada a {product.available}")
            
            return {
                "id": str(product.id),
                "name": product.name,
                "available": product.available,
                "message": f"Producto {'activado' if product.available else 'desactivado'} correctamente"
            }
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error de base de datos al cambiar disponibilidad {product_id}: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            db.rollback()
            logger.error(f"Error al cambiar disponibilidad {product_id}: {str(e)}")
            raise
    
    # Métodos privados de validación y serialización
    
    @staticmethod
    def _validate_required_fields(data: Dict, fields: List[str]) -> None:
        """Validar que los campos requeridos estén presentes"""
        for field in fields:
            if field not in data or data[field] is None or data[field] == "":
                raise ValueError(f"Campo requerido: {field}")
    
    @staticmethod
    def _validate_price(price) -> None:
        """Validar que el precio sea válido"""
        try:
            price_float = float(price)
            if price_float <= 0:
                raise ValueError("El precio debe ser un número positivo mayor a cero")
        except (ValueError, TypeError):
            raise ValueError("El precio debe ser un número válido")
    
    @staticmethod
    def _serialize_product(product: Product) -> Dict:
        """Serializar un producto a diccionario"""
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


# Instancia singleton
product_service = ProductService()
