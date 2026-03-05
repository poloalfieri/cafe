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

    def list_promotions(
        self,
        user_id: str,
        branch_id: Optional[str] = None,
        is_manual: Optional[bool] = None,
        active_only: bool = False,
    ) -> List[Dict]:
        restaurant_id = self._get_restaurant_id(user_id)
        if not restaurant_id:
            return []
        def _run():
            query = supabase.table("promotions").select("*").eq("restaurant_id", restaurant_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            if is_manual is not None:
                query = query.eq("is_manual", is_manual)
            if active_only:
                query = query.eq("active", True)
            return query.order("created_at", desc=False).execute()

        response = execute_with_retry(_run)
        promos = response.data or []
        for p in promos:
            if p.get("type") == "combo":
                p["combo_items"] = self.get_combo_items(p["id"])
        return promos

    def list_active_for_branch(self, restaurant_id: str, branch_id: Optional[str] = None) -> List[Dict]:
        """Devuelve promotions activas para el motor de aplicación.
        Incluye automáticas (is_manual=false) y las que son visibles al usuario (applies_to_all=true).
        """
        def _query_auto(q):
            """Promos automáticas: is_manual=false"""
            return q.eq("is_manual", False)

        def _query_public(q):
            """Promos públicas: applies_to_all=true (se muestran al usuario → deben aplicarse)"""
            return q.eq("applies_to_all", True)

        def _base(q):
            return q.eq("restaurant_id", restaurant_id).eq("active", True)

        def _run():
            # Query 1: automáticas para esta branch
            queries = []
            if branch_id:
                q1 = _query_auto(_base(supabase.table("promotions").select("*"))).eq("branch_id", branch_id)
                queries.append(q1)
                # Query 2: automáticas globales (branch_id IS NULL)
                q2 = _query_auto(_base(supabase.table("promotions").select("*"))).is_("branch_id", "null")
                queries.append(q2)
                # Query 3: públicas para esta branch
                q3 = _query_public(_base(supabase.table("promotions").select("*"))).eq("branch_id", branch_id)
                queries.append(q3)
                # Query 4: públicas globales
                q4 = _query_public(_base(supabase.table("promotions").select("*"))).is_("branch_id", "null")
                queries.append(q4)
            else:
                q1 = _query_auto(_base(supabase.table("promotions").select("*")))
                queries.append(q1)
                q2 = _query_public(_base(supabase.table("promotions").select("*")))
                queries.append(q2)
            return queries

        seen = set()
        promos = []
        for q in _run():
            resp = execute_with_retry(lambda q=q: q.execute())
            for p in (resp.data or []):
                if p["id"] not in seen:
                    seen.add(p["id"])
                    promos.append(p)

        for p in promos:
            if p.get("type") == "combo":
                p["combo_items"] = self.get_combo_items(p["id"])
        return promos

    def get_combo_items(self, promotion_id: str) -> List[Dict]:
        """Devuelve los productos que componen un combo."""
        response = (
            supabase.table("combo_items")
            .select("product_id, quantity")
            .eq("promotion_id", promotion_id)
            .execute()
        )
        return response.data or []

    def set_combo_items(self, promotion_id: str, items: List[Dict]) -> None:
        """Reemplaza los combo_items de una promoción."""
        supabase.table("combo_items").delete().eq("promotion_id", promotion_id).execute()
        if items:
            rows = [
                {"promotion_id": promotion_id, "product_id": it["product_id"], "quantity": it.get("quantity", 1)}
                for it in items
                if it.get("product_id")
            ]
            if rows:
                supabase.table("combo_items").insert(rows).execute()

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
            "is_manual": bool(payload.get("is_manual", False)),
            "applies_to_all": bool(payload.get("applies_to_all", False)),
            "days_of_week": payload.get("days_of_week"),
        }
        response = supabase.table("promotions").insert(insert_data).execute()
        promo = (response.data or [None])[0]
        if not promo:
            raise Exception("No se pudo crear la promoción")

        # Guardar combo_items si es tipo combo
        if promo_type == "combo" and payload.get("combo_items"):
            self.set_combo_items(promo["id"], payload["combo_items"])
            promo["combo_items"] = self.get_combo_items(promo["id"])

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
            "is_manual",
            "applies_to_all",
            "days_of_week",
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

        # Actualizar combo_items si se envían
        if "combo_items" in payload:
            self.set_combo_items(promotion_id, payload["combo_items"])
            promo["combo_items"] = self.get_combo_items(promotion_id)

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
