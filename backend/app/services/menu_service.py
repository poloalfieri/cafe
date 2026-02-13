"""
Servicio de Menú - Lógica de negocio para productos del menú
"""
from typing import List, Dict, Optional
from ..db.supabase_client import supabase
from ..utils.logger import setup_logger
from ..services.branches_service import branches_service
from ..utils.retry import execute_with_retry

logger = setup_logger(__name__)


class MenuService:
    """Servicio para manejar operaciones de menú"""
    
    def get_all_items(
        self,
        user_id: Optional[str] = None,
        mesa_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> List[Dict]:
        return self.list_items(user_id=user_id, mesa_id=mesa_id, branch_id=branch_id)

    def list_items(
        self,
        category: Optional[str] = None,
        available: Optional[str] = None,
        user_id: Optional[str] = None,
        mesa_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        Listar productos con filtros opcionales.

        Args:
            category: Filtrar por categoría
            available: "true"/"false" para filtrar por disponibilidad
            user_id: Usuario autenticado para resolver restaurant_id
            mesa_id: Mesa pública para resolver restaurant_id
            branch_id: Sucursal para resolver restaurant_id cuando es público

        Returns:
            Lista de productos normalizados
        """
        try:
            restaurant_id = self._resolve_restaurant_id(
                user_id=user_id,
                mesa_id=mesa_id,
                branch_id=branch_id,
            )
            query = supabase.table("menu").select("*")
            query = query.eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)

            if category:
                query = query.eq("category", category)

            if available is not None:
                available_bool = self._parse_bool(available)
                query = query.eq("available", available_bool)

            response = query.execute()
            items = response.data or []

            return [self._normalize_menu_item(item) for item in items]

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al listar menú: {str(e)}")
            raise Exception(f"Error al consultar el menú: {str(e)}")
    
    def get_item_by_id(
        self,
        item_id: int,
        user_id: Optional[str] = None,
        mesa_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> Optional[Dict]:
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
            restaurant_id = self._resolve_restaurant_id(
                user_id=user_id,
                mesa_id=mesa_id,
                branch_id=branch_id,
            )
            response = (
                supabase.table("menu")
                .select("*")
                .eq("id", item_id)
                .eq("restaurant_id", restaurant_id)
                .execute()
            )
            
            if not response.data:
                return None
            
            return self._normalize_menu_item(response.data[0])
            
        except Exception as e:
            logger.error(f"Error al obtener producto {item_id}: {str(e)}")
            raise Exception(f"Error al consultar el producto: {str(e)}")
    
    def create_item(self, data: Dict, user_id: str) -> Dict:
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
        restaurant_id, resolved_branch_id = self._resolve_restaurant_and_branch(
            user_id=user_id,
            branch_id=data.get("branch_id"),
        )
        menu_data = {
            "name": data["name"].strip(),
            "category": data["category"].strip(),
            "price": price,
            "description": data.get("description", "").strip(),
            "available": bool(data.get("available", True)),
            "image_url": data.get("image_url"),
            "restaurant_id": restaurant_id,
            "branch_id": resolved_branch_id,
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
    
    def update_item(self, item_id: int, data: Dict, user_id: str) -> Optional[Dict]:
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
        restaurant_id, resolved_branch_id = self._resolve_restaurant_and_branch(
            user_id=user_id,
            branch_id=data.get("branch_id"),
        )
        
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
            response = (
                supabase.table("menu")
                .update(update_data)
                .eq("id", item_id)
                .eq("restaurant_id", restaurant_id)
                .eq("branch_id", resolved_branch_id)
                .execute()
            )
            
            if not response.data:
                raise Exception("No se pudo actualizar el producto")
            
            updated_item = response.data[0]
            logger.info(f"Producto actualizado: {updated_item['name']} (ID: {item_id})")
            
            return self._normalize_menu_item(updated_item)
            
        except Exception as e:
            logger.error(f"Error al actualizar producto {item_id}: {str(e)}")
            raise Exception(f"Error al actualizar el producto: {str(e)}")
    
    def delete_item(self, item_id: int, user_id: str, branch_id: Optional[str] = None) -> bool:
        """
        Eliminar un producto del menú
        
        Args:
            item_id: ID del producto
            
        Returns:
            True si se eliminó, False si no existe
            
        Raises:
            Exception: Si hay error al eliminar
        """
        restaurant_id, resolved_branch_id = self._resolve_restaurant_and_branch(
            user_id=user_id,
            branch_id=branch_id,
        )
        
        try:
            response = (
                supabase.table("menu")
                .delete()
                .eq("id", item_id)
                .eq("restaurant_id", restaurant_id)
                .eq("branch_id", resolved_branch_id)
                .execute()
            )
            
            if not response.data:
                raise Exception("No se pudo eliminar el producto")
            
            logger.info(f"Producto eliminado: ID {item_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error al eliminar producto {item_id}: {str(e)}")
            raise Exception(f"Error al eliminar el producto: {str(e)}")
    
    def get_items_by_category(
        self,
        category: str,
        user_id: Optional[str] = None,
        mesa_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        Obtener productos por categoría
        
        Args:
            category: Categoría a filtrar
            
        Returns:
            Lista de productos de la categoría
        """
        try:
            return self.list_items(
                category=category,
                user_id=user_id,
                mesa_id=mesa_id,
                branch_id=branch_id,
            )
            
        except Exception as e:
            logger.error(f"Error al obtener productos por categoría {category}: {str(e)}")
            raise Exception(f"Error al consultar productos: {str(e)}")
    
    def get_available_items(
        self,
        user_id: Optional[str] = None,
        mesa_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        Obtener solo productos disponibles
        
        Returns:
            Lista de productos disponibles
        """
        try:
            return self.list_items(
                available="true",
                user_id=user_id,
                mesa_id=mesa_id,
                branch_id=branch_id,
            )
            
        except Exception as e:
            logger.error(f"Error al obtener productos disponibles: {str(e)}")
            raise Exception(f"Error al consultar productos: {str(e)}")
    
    def toggle_availability(self, item_id: int, user_id: str) -> Optional[Dict]:
        """
        Cambiar el estado de disponibilidad de un producto
        
        Args:
            item_id: ID del producto
            
        Returns:
            Producto actualizado o None si no existe
        """
        item = self.get_item_by_id(item_id, user_id=user_id)
        if not item:
            return None
        
        new_availability = not item["available"]
        return self.update_item(item_id, {"available": new_availability}, user_id)
    
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
    
    def _item_exists(self, item_id: int, restaurant_id: str) -> bool:
        """Verificar si un producto existe"""
        try:
            response = (
                supabase.table("menu")
                .select("id")
                .eq("id", item_id)
                .eq("restaurant_id", restaurant_id)
                .execute()
            )
            return bool(response.data)
        except Exception:
            return False

    def _resolve_restaurant_id(
        self,
        user_id: Optional[str],
        mesa_id: Optional[str],
        branch_id: Optional[str],
    ) -> str:
        if user_id:
            return branches_service.get_restaurant_id(user_id)
        if mesa_id:
            if not branch_id:
                raise ValueError("branch_id requerido")
            def _run():
                return (
                    supabase.table("mesas")
                    .select("restaurant_id")
                    .eq("mesa_id", mesa_id)
                    .eq("branch_id", branch_id)
                    .limit(1)
                    .execute()
                )
            resp = execute_with_retry(_run)
            mesa = (resp.data or [None])[0]
            if not mesa or not mesa.get("restaurant_id"):
                raise LookupError("Mesa no encontrada")
            return mesa.get("restaurant_id")
        raise ValueError("restaurant_id requerido")

    def _resolve_restaurant_and_branch(
        self,
        user_id: str,
        branch_id: Optional[str],
    ) -> (str, str):
        def _run_membership():
            return (
                supabase.table("restaurant_users")
                .select("restaurant_id, branch_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
        resp = execute_with_retry(_run_membership)
        membership = (resp.data or [None])[0]
        if not membership or not membership.get("restaurant_id"):
            raise LookupError("Usuario sin restaurante asociado")

        restaurant_id = membership.get("restaurant_id")
        resolved_branch = branch_id or membership.get("branch_id")
        if not resolved_branch:
            raise ValueError("branch_id requerido")

        if branch_id and branch_id != membership.get("branch_id"):
            def _run_branch():
                return (
                    supabase.table("branches")
                    .select("id, restaurant_id")
                    .eq("id", branch_id)
                    .limit(1)
                    .execute()
                )
            branch_resp = execute_with_retry(_run_branch)
            branch = (branch_resp.data or [None])[0]
            if not branch or branch.get("restaurant_id") != restaurant_id:
                raise LookupError("Sucursal no encontrada")

        return restaurant_id, resolved_branch

    @staticmethod
    def _parse_bool(value: Optional[str]) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            raise ValueError("available inválido")
        normalized = str(value).strip().lower()
        if normalized in ("true", "1", "yes", "si"):
            return True
        if normalized in ("false", "0", "no"):
            return False
        raise ValueError("available inválido")
    
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
