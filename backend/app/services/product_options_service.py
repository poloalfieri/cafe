from typing import Dict, List, Optional
from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry


def _group_to_camel(row: Dict, items: Optional[List[Dict]] = None) -> Dict:
    result = {
        "id": str(row["id"]),
        "productId": str(row["product_id"]),
        "name": row["name"],
        "isRequired": row.get("is_required", False),
        "maxSelections": row.get("max_selections", 1),
        "createdAt": row.get("created_at", ""),
        "updatedAt": row.get("updated_at", ""),
    }
    if items is not None:
        result["items"] = items
    return result


def _item_to_camel(row: Dict) -> Dict:
    ingredient = row.get("ingredients") or {}
    return {
        "id": str(row["id"]),
        "groupId": str(row["group_id"]),
        "ingredientId": str(row["ingredient_id"]),
        "priceAddition": float(row.get("price_addition", 0)),
        "ingredientName": ingredient.get("name", ""),
        "ingredientUnit": ingredient.get("unit", ""),
        "currentStock": float(ingredient.get("current_stock", 0)),
        "createdAt": row.get("created_at", ""),
        "updatedAt": row.get("updated_at", ""),
    }


class ProductOptionsService:
    def resolve_restaurant_id(self, user_id: str) -> str:
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

    # ── Groups ──────────────────────────────────────────────

    def list_groups(self, restaurant_id: str, product_id: str) -> List[Dict]:
        """List all option groups for a product, including their items."""
        def _run():
            return (
                supabase.table("product_option_groups")
                .select("*")
                .eq("product_id", product_id)
                .eq("restaurant_id", restaurant_id)
                .order("created_at")
                .execute()
            )

        response = execute_with_retry(_run)
        groups = response.data or []

        result = []
        for group in groups:
            items_resp = (
                supabase.table("product_option_items")
                .select("*, ingredients(name, unit, current_stock)")
                .eq("group_id", group["id"])
                .eq("restaurant_id", restaurant_id)
                .order("created_at")
                .execute()
            )
            items = [_item_to_camel(i) for i in (items_resp.data or [])]
            result.append(_group_to_camel(group, items))
        return result

    def create_group(self, restaurant_id: str, payload: Dict) -> Dict:
        product_id = payload.get("productId")
        name = (payload.get("name") or "").strip()

        if not product_id:
            raise ValueError("productId es requerido")
        if not name:
            raise ValueError("name es requerido")

        is_required = payload.get("isRequired", False)
        max_selections = payload.get("maxSelections", 1)
        if max_selections < 1:
            max_selections = 1

        insert_data = {
            "product_id": product_id,
            "name": name,
            "is_required": is_required,
            "max_selections": max_selections,
            "restaurant_id": restaurant_id,
        }
        response = supabase.table("product_option_groups").insert(insert_data).execute()
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo crear el grupo de opciones")
        return _group_to_camel(row, items=[])

    def update_group(self, restaurant_id: str, group_id: str, payload: Dict) -> Dict:
        existing = (
            supabase.table("product_option_groups")
            .select("id, restaurant_id")
            .eq("id", group_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Grupo de opciones no encontrado")

        update_data = {}
        if "name" in payload:
            name = (payload["name"] or "").strip()
            if not name:
                raise ValueError("name no puede estar vacío")
            update_data["name"] = name
        if "isRequired" in payload:
            update_data["is_required"] = bool(payload["isRequired"])
        if "maxSelections" in payload:
            val = int(payload["maxSelections"])
            update_data["max_selections"] = max(1, val)

        if not update_data:
            raise ValueError("No hay datos para actualizar")

        response = (
            supabase.table("product_option_groups")
            .update(update_data)
            .eq("id", group_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo actualizar el grupo")
        return _group_to_camel(row)

    def delete_group(self, restaurant_id: str, group_id: str) -> None:
        existing = (
            supabase.table("product_option_groups")
            .select("id, restaurant_id")
            .eq("id", group_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Grupo de opciones no encontrado")

        response = (
            supabase.table("product_option_groups")
            .delete()
            .eq("id", group_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        if not response.data:
            raise Exception("No se pudo eliminar el grupo")

    # ── Items ───────────────────────────────────────────────

    def add_item(self, restaurant_id: str, payload: Dict) -> Dict:
        group_id = payload.get("groupId")
        ingredient_id = payload.get("ingredientId")
        price_addition = payload.get("priceAddition", 0)

        if not group_id or not ingredient_id:
            raise ValueError("groupId e ingredientId son requeridos")

        group_check = (
            supabase.table("product_option_groups")
            .select("id, restaurant_id")
            .eq("id", group_id)
            .limit(1)
            .execute()
        )
        group = (group_check.data or [None])[0]
        if not group or group.get("restaurant_id") != restaurant_id:
            raise LookupError("Grupo de opciones no encontrado")

        existing = (
            supabase.table("product_option_items")
            .select("id")
            .eq("group_id", group_id)
            .eq("ingredient_id", ingredient_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise ValueError("Este ingrediente ya está en el grupo")

        insert_data = {
            "group_id": group_id,
            "ingredient_id": ingredient_id,
            "price_addition": float(price_addition),
            "restaurant_id": restaurant_id,
        }
        response = supabase.table("product_option_items").insert(insert_data).execute()
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo agregar la opción")

        full = (
            supabase.table("product_option_items")
            .select("*, ingredients(name, unit, current_stock)")
            .eq("id", row["id"])
            .single()
            .execute()
        )
        return _item_to_camel(full.data)

    def update_item(self, restaurant_id: str, item_id: str, payload: Dict) -> Dict:
        existing = (
            supabase.table("product_option_items")
            .select("id, restaurant_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Opción no encontrada")

        update_data = {}
        if "priceAddition" in payload:
            update_data["price_addition"] = float(payload["priceAddition"])

        if not update_data:
            raise ValueError("No hay datos para actualizar")

        supabase.table("product_option_items").update(update_data).eq("id", item_id).execute()

        full = (
            supabase.table("product_option_items")
            .select("*, ingredients(name, unit, current_stock)")
            .eq("id", item_id)
            .single()
            .execute()
        )
        return _item_to_camel(full.data)

    def delete_item(self, restaurant_id: str, item_id: str) -> None:
        existing = (
            supabase.table("product_option_items")
            .select("id, restaurant_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Opción no encontrada")

        response = (
            supabase.table("product_option_items")
            .delete()
            .eq("id", item_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        if not response.data:
            raise Exception("No se pudo eliminar la opción")


product_options_service = ProductOptionsService()
