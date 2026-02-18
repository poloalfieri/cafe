from typing import Dict, List, Optional
from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry
from ..utils.units import to_display_unit


def _recipe_row_to_camel(row: Dict, ingredient: Optional[Dict] = None) -> Dict:
    """Convert a recipe row + optional ingredient join to camelCase for the frontend."""
    result = {
        "ingredientId": str(row["ingredient_id"]),
        "quantity": row["quantity"],
    }
    if ingredient:
        result["name"] = ingredient.get("name", "")
        result["unit"] = to_display_unit(ingredient.get("unit"))
        result["unitCost"] = ingredient.get("unit_cost")
    return result


class RecipesService:
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

    def list_recipes(self, restaurant_id: str, product_id: str) -> List[Dict]:
        """Get all recipe ingredients for a product, joined with ingredient details."""
        def _run():
            return (
                supabase.table("recipes")
                .select("ingredient_id, quantity, ingredients(name, unit, unit_cost)")
                .eq("product_id", product_id)
                .eq("restaurant_id", restaurant_id)
                .execute()
            )

        response = execute_with_retry(_run)
        rows = response.data or []

        result = []
        for row in rows:
            ingredient_data = row.get("ingredients") or {}
            result.append({
                "ingredientId": str(row["ingredient_id"]),
                "quantity": row["quantity"],
                "name": ingredient_data.get("name", ""),
                "unit": to_display_unit(ingredient_data.get("unit")),
                "unitCost": ingredient_data.get("unit_cost"),
            })
        return result

    def add_recipe(self, restaurant_id: str, payload: Dict) -> Dict:
        product_id = payload.get("productId")
        ingredient_id = payload.get("ingredientId")
        quantity = payload.get("quantity")

        if not product_id or not ingredient_id:
            raise ValueError("productId e ingredientId son requeridos")
        if not quantity or float(quantity) <= 0:
            raise ValueError("quantity debe ser positivo")

        # Check if recipe already exists
        existing = (
            supabase.table("recipes")
            .select("id")
            .eq("product_id", product_id)
            .eq("ingredient_id", ingredient_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise ValueError("Este ingrediente ya está en la receta")

        insert_data = {
            "restaurant_id": restaurant_id,
            "product_id": product_id,
            "ingredient_id": ingredient_id,
            "quantity": float(quantity),
        }
        response = supabase.table("recipes").insert(insert_data).execute()
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo agregar el ingrediente a la receta")
        return row

    def update_recipe(self, restaurant_id: str, payload: Dict) -> Dict:
        product_id = payload.get("productId")
        ingredient_id = payload.get("ingredientId")
        quantity = payload.get("quantity")

        if not product_id or not ingredient_id:
            raise ValueError("productId e ingredientId son requeridos")
        if not quantity or float(quantity) <= 0:
            raise ValueError("quantity debe ser positivo")

        response = (
            supabase.table("recipes")
            .update({"quantity": float(quantity)})
            .eq("product_id", product_id)
            .eq("ingredient_id", ingredient_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        row = (response.data or [None])[0]
        if not row:
            raise LookupError("Receta no encontrada")
        return row

    def delete_recipe(self, restaurant_id: str, payload: Dict) -> None:
        product_id = payload.get("productId")
        ingredient_id = payload.get("ingredientId")

        if not product_id or not ingredient_id:
            raise ValueError("productId e ingredientId son requeridos")

        response = (
            supabase.table("recipes")
            .delete()
            .eq("product_id", product_id)
            .eq("ingredient_id", ingredient_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        if not response.data:
            raise LookupError("Receta no encontrada")


recipes_service = RecipesService()
