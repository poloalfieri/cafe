import math
from typing import Dict, List, Optional
from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry
from ..utils.units import ALLOWED_UNITS, normalize_unit, to_display_unit


def _row_to_camel(row: Dict) -> Dict:
    """Convert snake_case DB row to camelCase for the frontend."""
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "unit": to_display_unit(row.get("unit")),
        "currentStock": row.get("current_stock", 0),
        "unitCost": row.get("unit_cost"),
        "minStock": row.get("min_stock", 0),
        "trackStock": row.get("track_stock", True),
        "createdAt": row.get("created_at", ""),
        "updatedAt": row.get("updated_at", ""),
    }


class IngredientsService:
    def resolve_restaurant_id(self, user_id: str) -> str:
        """Resolve restaurant_id from user_id via restaurant_users table."""
        resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        membership = (resp.data or [None])[0]
        if not membership:
            raise LookupError("Usuario sin restaurante asociado")
        return membership["restaurant_id"]

    def list_ingredients(
        self,
        restaurant_id: str,
        branch_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
    ) -> Dict:
        def _run():
            query = (
                supabase.table("ingredients")
                .select("*", count="exact")
                .eq("restaurant_id", restaurant_id)
            )
            if branch_id:
                query = query.eq("branch_id", branch_id)
            if search:
                query = query.ilike("name", f"%{search}%")
            query = query.order("name")
            offset = (page - 1) * page_size
            query = query.range(offset, offset + page_size - 1)
            return query.execute()

        response = execute_with_retry(_run)
        rows = response.data or []
        total = response.count or len(rows)
        total_pages = max(1, math.ceil(total / page_size))

        return {
            "ingredients": [_row_to_camel(r) for r in rows],
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
            },
        }

    def create_ingredient(self, user_id: str, restaurant_id: str, payload: Dict) -> Dict:
        name = (payload.get("name") or "").strip()
        unit = normalize_unit(payload.get("unit"))
        if not name:
            raise ValueError("name es requerido")
        if unit not in ALLOWED_UNITS:
            raise ValueError(f"Unidad inválida. Permitidas: {', '.join(ALLOWED_UNITS)}")

        insert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": payload.get("branch_id"),
            "name": name,
            "unit": unit,
            "current_stock": payload.get("currentStock", 0),
            "unit_cost": payload.get("unitCost"),
            "min_stock": payload.get("minStock", 0),
            "track_stock": payload.get("trackStock", True),
        }
        response = supabase.table("ingredients").insert(insert_data).execute()
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo crear el ingrediente")
        return _row_to_camel(row)

    def update_ingredient(
        self, user_id: str, restaurant_id: str, ingredient_id: str, payload: Dict
    ) -> Dict:
        existing = (
            supabase.table("ingredients")
            .select("id, restaurant_id")
            .eq("id", ingredient_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Ingrediente no encontrado")

        field_map = {
            "name": "name",
            "unit": "unit",
            "currentStock": "current_stock",
            "unitCost": "unit_cost",
            "minStock": "min_stock",
            "trackStock": "track_stock",
            "branch_id": "branch_id",
        }
        update_data = {}
        for camel, snake in field_map.items():
            if camel in payload:
                update_data[snake] = payload[camel]

        if "unit" in update_data:
            normalized_unit = normalize_unit(update_data["unit"])
            if normalized_unit not in ALLOWED_UNITS:
                raise ValueError(f"Unidad inválida. Permitidas: {', '.join(ALLOWED_UNITS)}")
            update_data["unit"] = normalized_unit

        if not update_data:
            raise ValueError("No hay datos para actualizar")

        response = (
            supabase.table("ingredients")
            .update(update_data)
            .eq("id", ingredient_id)
            .execute()
        )
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo actualizar el ingrediente")
        return _row_to_camel(row)

    def delete_ingredient(self, user_id: str, restaurant_id: str, ingredient_id: str) -> None:
        existing = (
            supabase.table("ingredients")
            .select("id, restaurant_id")
            .eq("id", ingredient_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Ingrediente no encontrado")

        # Check if ingredient is used in recipes
        recipes_check = (
            supabase.table("recipes")
            .select("product_id")
            .eq("ingredient_id", ingredient_id)
            .limit(1)
            .execute()
        )
        if recipes_check.data:
            raise PermissionError("No se puede eliminar: el ingrediente está usado en recetas")

        # Check if ingredient is used in product options
        options_check = (
            supabase.table("product_option_items")
            .select("id")
            .eq("ingredient_id", ingredient_id)
            .limit(1)
            .execute()
        )
        if options_check.data:
            raise PermissionError("No se puede eliminar: el ingrediente está usado como opcional en productos")

        response = supabase.table("ingredients").delete().eq("id", ingredient_id).execute()
        if not response.data:
            raise Exception("No se pudo eliminar el ingrediente")


ingredients_service = IngredientsService()
