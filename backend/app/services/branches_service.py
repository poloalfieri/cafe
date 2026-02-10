from typing import Dict, List, Optional, Tuple
from ..db.supabase_client import supabase


class BranchesService:
    def _get_membership(self, user_id: str) -> Optional[Dict]:
        resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id, branch_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return (resp.data or [None])[0]

    def list_branches(self, user_id: str) -> List[Dict]:
        membership = self._get_membership(user_id)
        if not membership:
            return []
        restaurant_id = membership.get("restaurant_id")
        resp = (
            supabase.table("branches")
            .select("*")
            .eq("restaurant_id", restaurant_id)
            .order("created_at", desc=False)
            .execute()
        )
        return resp.data or []

    def create_branch(self, user_id: str, payload: Dict) -> Dict:
        name = (payload.get("name") or "").strip()
        if not name:
            raise ValueError("name requerido")

        membership = self._get_membership(user_id)
        if not membership:
            raise LookupError("Usuario sin restaurante asociado")

        insert_data = {
            "restaurant_id": membership.get("restaurant_id"),
            "name": name,
            "address": payload.get("address"),
            "phone": payload.get("phone"),
            "email": payload.get("email"),
            "manager": payload.get("manager"),
            "share_menu": bool(payload.get("share_menu", True)),
            "active": bool(payload.get("active", True)),
            "monthly_sales": payload.get("monthly_sales") or 0,
            "total_orders": payload.get("total_orders") or 0,
        }

        response = supabase.table("branches").insert(insert_data).execute()
        branch = (response.data or [None])[0]
        if not branch:
            raise Exception("No se pudo crear la sucursal")
        return branch

    def update_branch(self, user_id: str, branch_id: str, payload: Dict) -> Dict:
        membership = self._get_membership(user_id)
        if not membership:
            raise LookupError("Usuario sin restaurante asociado")

        restaurant_id = membership.get("restaurant_id")
        existing = (
            supabase.table("branches")
            .select("id, restaurant_id")
            .eq("id", branch_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Sucursal no encontrada")

        allowed_fields = {
            "name",
            "address",
            "phone",
            "email",
            "manager",
            "share_menu",
            "active",
            "monthly_sales",
            "total_orders",
        }
        update_data = {k: v for k, v in payload.items() if k in allowed_fields}

        if not update_data:
            raise ValueError("No hay datos para actualizar")

        response = (
            supabase.table("branches")
            .update(update_data)
            .eq("id", branch_id)
            .execute()
        )
        branch = (response.data or [None])[0]
        if not branch:
            raise Exception("No se pudo actualizar la sucursal")
        return branch

    def get_my_branch(self, user_id: str) -> Dict:
        membership = self._get_membership(user_id)
        if not membership:
            raise LookupError("Usuario sin restaurante asociado")

        branch_id = membership.get("branch_id")
        restaurant_id = membership.get("restaurant_id")

        if branch_id:
            branch_resp = (
                supabase.table("branches")
                .select("id, name, restaurant_id")
                .eq("id", branch_id)
                .limit(1)
                .execute()
            )
        else:
            branch_resp = (
                supabase.table("branches")
                .select("id, name, restaurant_id")
                .eq("restaurant_id", restaurant_id)
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )

        branch = (branch_resp.data or [None])[0]
        if not branch:
            raise LookupError("Sucursal no encontrada")
        return branch


branches_service = BranchesService()
