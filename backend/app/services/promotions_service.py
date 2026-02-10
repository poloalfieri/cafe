from typing import Dict, List, Optional
from ..utils.retry import execute_with_retry
from ..db.supabase_client import supabase


def _clean_time(value):
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


class PromotionsService:
    def _get_restaurant_id(self, user_id: str) -> Optional[str]:
        resp = (
            supabase.table("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        membership = (resp.data or [None])[0]
        return membership.get("restaurant_id") if membership else None

    def list_promotions(self, user_id: str, branch_id: Optional[str] = None) -> List[Dict]:
        restaurant_id = self._get_restaurant_id(user_id)
        if not restaurant_id:
            return []
        def _run():
            query = supabase.table("promotions").select("*").eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            return query.order("created_at", desc=False).execute()

        response = execute_with_retry(_run)
        return response.data or []

    def create_promotion(self, user_id: str, payload: Dict) -> Dict:
        restaurant_id = self._get_restaurant_id(user_id)
        if not restaurant_id:
            raise LookupError("Usuario sin restaurante asociado")

        name = (payload.get("name") or "").strip()
        promo_type = (payload.get("type") or "").strip()
        if not name or not promo_type:
            raise ValueError("name y type requeridos")

        insert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": payload.get("branch_id"),
            "name": name,
            "type": promo_type,
            "value": payload.get("value"),
            "description": payload.get("description"),
            "start_date": payload.get("start_date"),
            "end_date": payload.get("end_date"),
            "start_time": _clean_time(payload.get("start_time")),
            "end_time": _clean_time(payload.get("end_time")),
            "active": bool(payload.get("active", True)),
            "applicable_products": payload.get("applicable_products"),
        }
        response = supabase.table("promotions").insert(insert_data).execute()
        promo = (response.data or [None])[0]
        if not promo:
            raise Exception("No se pudo crear la promoción")
        return promo

    def update_promotion(self, user_id: str, promotion_id: str, payload: Dict) -> Dict:
        restaurant_id = self._get_restaurant_id(user_id)
        if not restaurant_id:
            raise LookupError("Usuario sin restaurante asociado")

        existing = (
            supabase.table("promotions")
            .select("id, restaurant_id")
            .eq("id", promotion_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Promoción no encontrada")

        allowed_fields = {
            "name",
            "type",
            "value",
            "description",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "active",
            "applicable_products",
            "branch_id",
        }
        update_data = {k: v for k, v in payload.items() if k in allowed_fields}
        if "start_time" in update_data:
            update_data["start_time"] = _clean_time(update_data.get("start_time"))
        if "end_time" in update_data:
            update_data["end_time"] = _clean_time(update_data.get("end_time"))
        if not update_data:
            raise ValueError("No hay datos para actualizar")

        response = (
            supabase.table("promotions")
            .update(update_data)
            .eq("id", promotion_id)
            .execute()
        )
        promo = (response.data or [None])[0]
        if not promo:
            raise Exception("No se pudo actualizar la promoción")
        return promo

    def delete_promotion(self, user_id: str, promotion_id: str) -> None:
        restaurant_id = self._get_restaurant_id(user_id)
        if not restaurant_id:
            raise LookupError("Usuario sin restaurante asociado")

        existing = (
            supabase.table("promotions")
            .select("id, restaurant_id")
            .eq("id", promotion_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Promoción no encontrada")

        response = supabase.table("promotions").delete().eq("id", promotion_id).execute()
        if not response.data:
            raise Exception("No se pudo eliminar la promoción")


promotions_service = PromotionsService()
