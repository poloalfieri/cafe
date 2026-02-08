"""
Servicio para manejar lógica de negocio de productos (Supabase)
"""

from typing import Dict, List, Optional

from ..db.supabase_client import supabase
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class ProductService:
    """Servicio para manejar lógica de negocio de productos"""

    @staticmethod
    def get_all_products() -> List[Dict]:
        try:
            response = supabase.table("menu").select("*").execute()
            products = response.data or []

            logger.info(f"Obtenidos {len(products)} productos")
            return [ProductService._normalize_product(p) for p in products]

        except Exception as e:
            logger.error(f"Error al obtener productos: {str(e)}")
            raise Exception("Error en la base de datos")

    @staticmethod
    def get_product_by_id(product_id: int) -> Optional[Dict]:
        try:
            response = supabase.table("menu").select("*").eq("id", product_id).execute()
            data = response.data or []

            if not data:
                logger.warning(f"Producto {product_id} no encontrado")
                return None

            logger.info(f"Producto {product_id} obtenido")
            return ProductService._normalize_product(data[0])

        except Exception as e:
            logger.error(f"Error al obtener producto {product_id}: {str(e)}")
            raise Exception("Error en la base de datos")

    @staticmethod
    def create_product(data: Dict) -> Dict:
        ProductService._validate_required_fields(data, ["name", "category", "price"])
        ProductService._validate_price(data["price"])

        insert_data = {
            "name": data["name"],
            "category": data["category"],
            "price": float(data["price"]),
            "description": data.get("description", ""),
            "available": bool(data.get("available", True)),
        }

        try:
            response = supabase.table("menu").insert(insert_data).execute()
            if not response.data:
                raise Exception("No se pudo crear el producto")

            created = response.data[0]
            logger.info(f"Producto creado: {created.get('id')} - {created.get('name')}")
            return ProductService._normalize_product(created)

        except Exception as e:
            logger.error(f"Error al crear producto: {str(e)}")
            raise Exception("Error en la base de datos")

    @staticmethod
    def update_product(product_id: int, data: Dict) -> Optional[Dict]:
        if "price" in data:
            ProductService._validate_price(data["price"])

        update_data = {}
        if "name" in data:
            update_data["name"] = data["name"]
        if "category" in data:
            update_data["category"] = data["category"]
        if "price" in data:
            update_data["price"] = float(data["price"])
        if "description" in data:
            update_data["description"] = data["description"]
        if "available" in data:
            update_data["available"] = bool(data["available"])

        if not update_data:
            raise ValueError("No hay datos para actualizar")

        try:
            response = (
                supabase.table("menu")
                .update(update_data)
                .eq("id", product_id)
                .execute()
            )

            if not response.data:
                logger.warning(f"Producto {product_id} no encontrado para actualizar")
                return None

            updated = response.data[0]
            logger.info(f"Producto {product_id} actualizado")
            return ProductService._normalize_product(updated)

        except Exception as e:
            logger.error(f"Error al actualizar producto {product_id}: {str(e)}")
            raise Exception("Error en la base de datos")

    @staticmethod
    def delete_product(product_id: int) -> bool:
        try:
            response = supabase.table("menu").delete().eq("id", product_id).execute()
            if not response.data:
                logger.warning(f"Producto {product_id} no encontrado para eliminar")
                return False

            logger.info(f"Producto {product_id} eliminado")
            return True

        except Exception as e:
            logger.error(f"Error al eliminar producto {product_id}: {str(e)}")
            raise Exception("Error en la base de datos")

    @staticmethod
    def toggle_availability(product_id: int) -> Optional[Dict]:
        product = ProductService.get_product_by_id(product_id)
        if not product:
            return None

        new_availability = not product["available"]
        return ProductService.update_product(product_id, {"available": new_availability})

    @staticmethod
    def _validate_required_fields(data: Dict, required: List[str]) -> None:
        for field in required:
            if field not in data or data[field] in (None, ""):
                raise ValueError(f"Campo requerido: {field}")

    @staticmethod
    def _validate_price(price) -> None:
        try:
            price_float = float(price)
            if price_float < 0:
                raise ValueError("El precio debe ser un número positivo")
        except (ValueError, TypeError):
            raise ValueError("El precio debe ser un número válido")

    @staticmethod
    def _normalize_product(product: Dict) -> Dict:
        return {
            "id": product.get("id"),
            "name": product.get("name"),
            "category": product.get("category"),
            "price": float(product.get("price", 0)),
            "description": product.get("description"),
            "available": bool(product.get("available", True)),
            "created_at": product.get("created_at"),
            "updated_at": product.get("updated_at"),
        }


product_service = ProductService()
