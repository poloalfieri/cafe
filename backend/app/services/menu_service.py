"""
Servicio de Menú - Lógica de negocio para productos del menú
"""
from typing import List, Dict, Optional
from ..db.supabase_client import supabase
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class MenuService:
    """Servicio para manejar operaciones de menú"""
    
    def get_all_items(self) -> List[Dict]:
        """
        Obtener todos los productos del menú
        
        Returns:
            Lista de productos del menú
            
        Raises:
            Exception: Si hay error al consultar la base de datos
        """
        try:
            response = supabase.table("menu").select("*").execute()
            items = response.data or []
            
            # Normalizar datos
            return [self._normalize_menu_item(item) for item in items]
            
        except Exception as e:
            logger.error(f"Error al obtener menú: {str(e)}")
            raise Exception(f"Error al consultar el menú: {str(e)}")
    
    def get_item_by_id(self, item_id: int) -> Optional[Dict]:
        """
        Obtener un producto específico del menú
        
        Args:
            item_id: ID del producto
            
        Returns:
            Producto del menú o None si no existe
            
        Raises:
            Exception: Si hay error al consultar la base de datos
        """
        try:
            response = supabase.table("menu").select("*").eq("id", item_id).execute()
            
            if not response.data:
                return None
            
            return self._normalize_menu_item(response.data[0])
            
        except Exception as e:
            logger.error(f"Error al obtener producto {item_id}: {str(e)}")
            raise Exception(f"Error al consultar el producto: {str(e)}")
    
    def create_item(self, data: Dict) -> Dict:
        """
        Crear un nuevo producto en el menú
        
        Args:
            data: Datos del producto (name, category, price, description, available)
            
        Returns:
            Producto creado
            
        Raises:
            ValueError: Si los datos son inválidos
            Exception: Si hay error al crear el producto
        """
        # Validar datos requeridos
        self._validate_required_fields(data, ["name", "category", "price"])
        
        # Validar y normalizar precio
        price = self._validate_price(data["price"])
        
        # Preparar datos
        menu_data = {
            "name": data["name"].strip(),
            "category": data["category"].strip(),
            "price": price,
            "description": data.get("description", "").strip(),
            "available": bool(data.get("available", True)),
            "image_url": data.get("image_url")
        }
        
        try:
            response = supabase.table("menu").insert(menu_data).execute()
            
            if not response.data:
                raise Exception("No se pudo crear el producto")
            
            created_item = response.data[0]
            logger.info(f"Producto creado: {created_item['name']} (ID: {created_item['id']})")
            
            return self._normalize_menu_item(created_item)
            
        except Exception as e:
            logger.error(f"Error al crear producto: {str(e)}")
            raise Exception(f"Error al crear el producto: {str(e)}")
    
    def update_item(self, item_id: int, data: Dict) -> Optional[Dict]:
        """
        Actualizar un producto existente del menú
        
        Args:
            item_id: ID del producto
            data: Datos a actualizar
            
        Returns:
            Producto actualizado o None si no existe
            
        Raises:
            ValueError: Si los datos son inválidos
            Exception: Si hay error al actualizar
        """
        # Verificar que el producto existe
        if not self._item_exists(item_id):
            return None
        
        # Preparar datos para actualización
        update_data = {}
        
        if "name" in data:
            update_data["name"] = data["name"].strip()
        
        if "category" in data:
            update_data["category"] = data["category"].strip()
        
        if "price" in data:
            update_data["price"] = self._validate_price(data["price"])
        
        if "description" in data:
            update_data["description"] = data["description"].strip()
        
        if "available" in data:
            update_data["available"] = bool(data["available"])

        if "image_url" in data:
            update_data["image_url"] = data["image_url"]
        
        # Si no hay nada que actualizar
        if not update_data:
            raise ValueError("No hay datos para actualizar")
        
        try:
            response = supabase.table("menu").update(update_data).eq("id", item_id).execute()
            
            if not response.data:
                raise Exception("No se pudo actualizar el producto")
            
            updated_item = response.data[0]
            logger.info(f"Producto actualizado: {updated_item['name']} (ID: {item_id})")
            
            return self._normalize_menu_item(updated_item)
            
        except Exception as e:
            logger.error(f"Error al actualizar producto {item_id}: {str(e)}")
            raise Exception(f"Error al actualizar el producto: {str(e)}")
    
    def delete_item(self, item_id: int) -> bool:
        """
        Eliminar un producto del menú
        
        Args:
            item_id: ID del producto
            
        Returns:
            True si se eliminó, False si no existe
            
        Raises:
            Exception: Si hay error al eliminar
        """
        # Verificar que el producto existe
        if not self._item_exists(item_id):
            return False
        
        try:
            response = supabase.table("menu").delete().eq("id", item_id).execute()
            
            if not response.data:
                raise Exception("No se pudo eliminar el producto")
            
            logger.info(f"Producto eliminado: ID {item_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error al eliminar producto {item_id}: {str(e)}")
            raise Exception(f"Error al eliminar el producto: {str(e)}")
    
    def get_items_by_category(self, category: str) -> List[Dict]:
        """
        Obtener productos por categoría
        
        Args:
            category: Categoría a filtrar
            
        Returns:
            Lista de productos de la categoría
        """
        try:
            response = supabase.table("menu").select("*").eq("category", category).execute()
            items = response.data or []
            
            return [self._normalize_menu_item(item) for item in items]
            
        except Exception as e:
            logger.error(f"Error al obtener productos por categoría {category}: {str(e)}")
            raise Exception(f"Error al consultar productos: {str(e)}")
    
    def get_available_items(self) -> List[Dict]:
        """
        Obtener solo productos disponibles
        
        Returns:
            Lista de productos disponibles
        """
        try:
            response = supabase.table("menu").select("*").eq("available", True).execute()
            items = response.data or []
            
            return [self._normalize_menu_item(item) for item in items]
            
        except Exception as e:
            logger.error(f"Error al obtener productos disponibles: {str(e)}")
            raise Exception(f"Error al consultar productos: {str(e)}")
    
    def toggle_availability(self, item_id: int) -> Optional[Dict]:
        """
        Cambiar el estado de disponibilidad de un producto
        
        Args:
            item_id: ID del producto
            
        Returns:
            Producto actualizado o None si no existe
        """
        item = self.get_item_by_id(item_id)
        if not item:
            return None
        
        new_availability = not item["available"]
        return self.update_item(item_id, {"available": new_availability})
    
    # Métodos privados de validación y utilidades
    
    def _validate_required_fields(self, data: Dict, required: List[str]) -> None:
        """Validar que existan campos requeridos"""
        for field in required:
            if field not in data or not data[field]:
                raise ValueError(f"Campo requerido: {field}")
    
    def _validate_price(self, price) -> float:
        """Validar y normalizar precio"""
        try:
            price_float = float(price)
            if price_float < 0:
                raise ValueError("El precio debe ser un número positivo")
            return price_float
        except (ValueError, TypeError):
            raise ValueError("El precio debe ser un número válido")
    
    def _item_exists(self, item_id: int) -> bool:
        """Verificar si un producto existe"""
        try:
            response = supabase.table("menu").select("id").eq("id", item_id).execute()
            return bool(response.data)
        except Exception:
            return False
    
    def _normalize_menu_item(self, item: Dict) -> Dict:
        """Normalizar formato de un producto del menú"""
        return {
            "id": str(item["id"]),
            "name": item["name"],
            "category": item["category"],
            "price": float(item["price"]),
            "description": item.get("description", ""),
            "available": bool(item.get("available", True)),
            "image_url": item.get("image_url"),
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at")
        }


# Instancia singleton del servicio
menu_service = MenuService()
