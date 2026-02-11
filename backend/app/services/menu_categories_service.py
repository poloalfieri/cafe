from typing import Dict, List

from ..db.supabase_client import supabase
from ..services.branches_service import branches_service
from ..utils.retry import execute_with_retry


class MenuCategoriesService:
    def _ensure_branch(self, user_id: str, branch_id: str) -> str:
        restaurant_id = branches_service.get_restaurant_id(user_id)

        def _run():
            return (
                supabase.table("branches")
                .select("id, restaurant_id")
                .eq("id", branch_id)
                .limit(1)
                .execute()
            )

        resp = execute_with_retry(_run)
        branch = (resp.data or [None])[0]
        if not branch or branch.get("restaurant_id") != restaurant_id:
            raise LookupError("Sucursal no encontrada")
        return restaurant_id

    def list_categories(self, user_id: str, branch_id: str) -> List[Dict]:
        restaurant_id = self._ensure_branch(user_id, branch_id)

        def _run():
            return (
                supabase.table("menu_categories")
                .select("*")
                .eq("restaurant_id", restaurant_id)
                .eq("branch_id", branch_id)
                .order("name", desc=False)
                .execute()
            )

        resp = execute_with_retry(_run)
        return resp.data or []

    def create_category(self, user_id: str, payload: Dict) -> Dict:
        branch_id = (payload.get("branch_id") or "").strip()
        name = (payload.get("name") or "").strip()
        if not branch_id:
            raise ValueError("branch_id requerido")
        if not name:
            raise ValueError("name requerido")

        restaurant_id = self._ensure_branch(user_id, branch_id)

        insert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
            "name": name,
            "active": bool(payload.get("active", True)),
        }

        response = supabase.table("menu_categories").insert(insert_data).execute()
        category = (response.data or [None])[0]
        if not category:
            raise Exception("No se pudo crear la categoría")
        return category

    def update_category(self, user_id: str, category_id: str, payload: Dict) -> Dict:
        branch_id = (payload.get("branch_id") or "").strip()
        if not branch_id:
            raise ValueError("branch_id requerido")

        restaurant_id = self._ensure_branch(user_id, branch_id)

        allowed_fields = {"name", "active"}
        update_data = {k: v for k, v in payload.items() if k in allowed_fields}
        if "name" in update_data:
            update_data["name"] = (update_data["name"] or "").strip()
        if not update_data:
            raise ValueError("No hay datos para actualizar")

        response = (
            supabase.table("menu_categories")
            .update(update_data)
            .eq("id", category_id)
            .eq("restaurant_id", restaurant_id)
            .eq("branch_id", branch_id)
            .execute()
        )
        category = (response.data or [None])[0]
        if not category:
            raise LookupError("Categoría no encontrada")
        return category

    def delete_category(self, user_id: str, category_id: str, branch_id: str) -> None:
        restaurant_id = self._ensure_branch(user_id, branch_id)

        response = (
            supabase.table("menu_categories")
            .delete()
            .eq("id", category_id)
            .eq("restaurant_id", restaurant_id)
            .eq("branch_id", branch_id)
            .execute()
        )
        if not response.data:
            raise LookupError("Categoría no encontrada")


menu_categories_service = MenuCategoriesService()
