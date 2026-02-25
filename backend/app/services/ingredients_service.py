import math
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from ..db.supabase_client import supabase
from ..services.menu_service import menu_service
from ..utils.retry import execute_with_retry
from ..utils.units import ALLOWED_UNITS, normalize_unit, to_display_unit
from ..utils.logger import setup_logger


logger = setup_logger(__name__)


def _row_to_camel(row: Dict) -> Dict:
    """Convert snake_case DB row to camelCase for the frontend."""
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "unit": to_display_unit(row.get("unit")),
        "currentStock": row.get("current_stock", 0),
        "wastePercent": float(row.get("waste_percent", 0) or 0),
        "unitCost": row.get("unit_cost"),
        "minStock": row.get("min_stock", 0),
        "trackStock": row.get("track_stock", True),
        "createdAt": row.get("created_at", ""),
        "updatedAt": row.get("updated_at", ""),
    }


class IngredientsService:
    @staticmethod
    def _normalize_optional_uuid(value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        try:
            return str(uuid.UUID(str(value)))
        except (TypeError, ValueError, AttributeError):
            return None

    @staticmethod
    def _get_waste_percent(payload: Dict) -> float:
        """Normaliza wastePercent (0-100). Si no viene, usa 0."""
        raw = payload.get("wastePercent", 0)
        if raw in (None, ""):
            return 0.0
        try:
            value = float(raw)
        except (TypeError, ValueError):
            raise ValueError("wastePercent debe ser numérico")
        if value < 0 or value > 100:
            raise ValueError("wastePercent debe estar entre 0 y 100")
        return value

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

    def get_low_stock(self, restaurant_id: str, branch_id: Optional[str] = None) -> List[Dict]:
        """Devuelve ingredientes con track_stock=true y current_stock <= min_stock,
        ordenados por déficit descendente (más crítico primero)."""
        def _run():
            q = (
                supabase.table("ingredients")
                .select("*")
                .eq("restaurant_id", restaurant_id)
                .eq("track_stock", True)
            )
            if branch_id:
                q = q.eq("branch_id", branch_id)
            return q.execute()

        response = execute_with_retry(_run)
        rows = response.data or []
        low = [r for r in rows if (r.get("current_stock") or 0) <= (r.get("min_stock") or 0)]
        # Ordenar por déficit: cuánto falta relativo al mínimo (más crítico = más negativo)
        low.sort(key=lambda r: (r.get("current_stock") or 0) - (r.get("min_stock") or 0))
        return [_row_to_camel(r) for r in low]

    def create_ingredient(self, user_id: str, restaurant_id: str, payload: Dict) -> Dict:
        name = (payload.get("name") or "").strip()
        unit = normalize_unit(payload.get("unit"))
        waste_percent = self._get_waste_percent(payload)
        current_stock = float(payload.get("currentStock", 0) or 0)
        if not name:
            raise ValueError("name es requerido")
        if unit not in ALLOWED_UNITS:
            raise ValueError(f"Unidad inválida. Permitidas: {', '.join(ALLOWED_UNITS)}")

        insert_data = {
            "restaurant_id": restaurant_id,
            "branch_id": payload.get("branch_id"),
            "name": name,
            "unit": unit,
            "current_stock": current_stock,
            "waste_percent": waste_percent,
            "unit_cost": payload.get("unitCost"),
            "min_stock": payload.get("minStock", 0),
            "track_stock": payload.get("trackStock", True),
        }
        response = supabase.table("ingredients").insert(insert_data).execute()
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo crear el ingrediente")
        if current_stock > 0 and waste_percent > 0:
            waste_qty = round(current_stock * (waste_percent / 100.0), 4)
            if waste_qty > 0:
                try:
                    self.record_movement(
                        ingredient_id=str(row["id"]),
                        qty=-waste_qty,
                        movement_type="waste",
                        restaurant_id=restaurant_id,
                        reason=f"Desecho automático {waste_percent}% en carga inicial",
                        source="manual",
                        user_id=user_id,
                        branch_id=payload.get("branch_id"),
                    )
                    updated_resp = (
                        supabase.table("ingredients")
                        .select("*")
                        .eq("id", row["id"])
                        .limit(1)
                        .execute()
                    )
                    updated_row = (updated_resp.data or [None])[0]
                    if updated_row:
                        row = updated_row
                except Exception as e:
                    logger.warning(
                        f"No se pudo registrar waste inicial para ingrediente {row.get('id')}: {e}"
                    )
        menu_service.sync_unavailable_from_stock(
            restaurant_id=restaurant_id,
            branch_id=row.get("branch_id"),
        )
        return _row_to_camel(row)

    def record_movement(
        self,
        ingredient_id: str,
        qty: float,
        movement_type: str,
        restaurant_id: str,
        reason: Optional[str] = None,
        source: Optional[str] = None,
        user_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> None:
        """Registra un movimiento de stock e incrementa/decrementa current_stock."""
        ingredient_id_value = ingredient_id
        if isinstance(ingredient_id, str):
            if ingredient_id.isdigit() or (ingredient_id.startswith("-") and ingredient_id[1:].isdigit()):
                ingredient_id_value = int(ingredient_id)

        movement_payload = {
            "ingredient_id": ingredient_id_value,
            "qty": qty,
            "type": movement_type,
            "reason": reason,
            "source": source,
            "user_id": self._normalize_optional_uuid(user_id),
            "branch_id": self._normalize_optional_uuid(branch_id),
            "restaurant_id": restaurant_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("stock_movements").insert(movement_payload).execute()

        # Actualizar current_stock como incremento relativo
        current_resp = (
            supabase.table("ingredients")
            .select("current_stock")
            .eq("id", ingredient_id)
            .limit(1)
            .execute()
        )
        current_row = (current_resp.data or [None])[0]
        if current_row is not None:
            old_stock = float(current_row.get("current_stock") or 0)
            new_stock = round(old_stock + qty, 4)
            supabase.table("ingredients").update({"current_stock": new_stock}).eq("id", ingredient_id).execute()

    def list_movements(
        self,
        restaurant_id: str,
        branch_id: Optional[str] = None,
        ingredient_id: Optional[str] = None,
        movement_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1,
        page_size: int = 30,
    ) -> Dict:
        def _run():
            q = (
                supabase.table("stock_movements")
                .select("*, ingredients(name, unit)", count="exact")
                .eq("restaurant_id", restaurant_id)
                .order("created_at", desc=True)
            )
            if branch_id:
                q = q.eq("branch_id", branch_id)
            if ingredient_id:
                q = q.eq("ingredient_id", ingredient_id)
            if movement_type:
                q = q.eq("type", movement_type)
            if date_from:
                q = q.gte("created_at", date_from)
            if date_to:
                q = q.lte("created_at", date_to)
            offset = (page - 1) * page_size
            q = q.range(offset, offset + page_size - 1)
            return q.execute()

        response = execute_with_retry(_run)
        rows = response.data or []
        total = response.count or len(rows)
        total_pages = max(1, math.ceil(total / page_size))

        movements = []
        for r in rows:
            ing = r.get("ingredients") or {}
            movements.append({
                "id": str(r["id"]),
                "ingredientId": str(r["ingredient_id"]),
                "ingredientName": ing.get("name", ""),
                "ingredientUnit": ing.get("unit", ""),
                "qty": float(r.get("qty", 0)),
                "type": r.get("type", ""),
                "reason": r.get("reason"),
                "source": r.get("source"),
                "userId": str(r["user_id"]) if r.get("user_id") else None,
                "branchId": str(r["branch_id"]) if r.get("branch_id") else None,
                "createdAt": r.get("created_at", ""),
            })

        return {
            "movements": movements,
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
            },
        }

    def update_ingredient(
        self, user_id: str, restaurant_id: str, ingredient_id: str, payload: Dict
    ) -> Dict:
        existing = (
            supabase.table("ingredients")
            .select("id, restaurant_id, current_stock, branch_id, waste_percent")
            .eq("id", ingredient_id)
            .limit(1)
            .execute()
        )
        current = (existing.data or [None])[0]
        if not current or current.get("restaurant_id") != restaurant_id:
            raise LookupError("Ingrediente no encontrado")

        current_waste_percent = float(current.get("waste_percent") or 0)
        payload_waste_percent: Optional[float] = None
        if "wastePercent" in payload:
            payload_waste_percent = self._get_waste_percent(payload)
        effective_waste_percent = (
            payload_waste_percent if payload_waste_percent is not None else current_waste_percent
        )

        field_map = {
            "name": "name",
            "unit": "unit",
            "currentStock": "current_stock",
            "wastePercent": "waste_percent",
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

        # Registrar movimiento de ajuste si cambia el stock
        if "current_stock" in update_data:
            old_stock = float(current.get("current_stock") or 0)
            new_stock = float(update_data["current_stock"])
            delta = round(new_stock - old_stock, 4)
            if delta != 0:
                movement_branch_id = current.get("branch_id") or payload.get("branch_id")
                try:
                    self.record_movement(
                        ingredient_id=ingredient_id,
                        qty=delta,
                        movement_type="adjustment",
                        restaurant_id=restaurant_id,
                        reason=payload.get("reason"),
                        source="manual",
                        user_id=user_id,
                        branch_id=movement_branch_id,
                    )
                    if delta > 0 and effective_waste_percent > 0:
                        waste_qty = round(delta * (effective_waste_percent / 100.0), 4)
                        if waste_qty > 0:
                            self.record_movement(
                                ingredient_id=ingredient_id,
                                qty=-waste_qty,
                                movement_type="waste",
                                restaurant_id=restaurant_id,
                                reason=f"Desecho automático {effective_waste_percent}% sobre carga de stock",
                                source="manual",
                                user_id=user_id,
                                branch_id=movement_branch_id,
                            )
                    # record_movement ya actualizó current_stock — no volver a actualizar
                    del update_data["current_stock"]
                except Exception as e:
                    logger.error(
                        f"Error registrando movimiento de stock para ingrediente {ingredient_id}: {e}"
                    )
                    # No continuar silenciosamente: evita desalinear historial vs stock
                    raise ValueError("No se pudo registrar el movimiento de stock") from e

        # Si solo cambia el porcentaje de desecho (sin cambiar current_stock) y aumenta,
        # descontar la diferencia como pérdida real y registrarla como movement_type='waste'.
        if "waste_percent" in update_data and "current_stock" not in update_data:
            new_waste_percent = float(update_data["waste_percent"] or 0)
            if new_waste_percent > current_waste_percent:
                movement_branch_id = current.get("branch_id") or payload.get("branch_id")
                base_stock = float(current.get("current_stock") or 0)
                delta_percent = new_waste_percent - current_waste_percent
                waste_qty = round(base_stock * (delta_percent / 100.0), 4)
                if waste_qty > 0:
                    try:
                        self.record_movement(
                            ingredient_id=ingredient_id,
                            qty=-waste_qty,
                            movement_type="waste",
                            restaurant_id=restaurant_id,
                            reason=(
                                f"Ajuste desecho {current_waste_percent}% -> "
                                f"{new_waste_percent}%"
                            ),
                            source="manual",
                            user_id=user_id,
                            branch_id=movement_branch_id,
                        )
                    except Exception as e:
                        logger.error(
                            f"Error registrando waste por cambio de porcentaje en {ingredient_id}: {e}"
                        )
                        raise ValueError("No se pudo registrar el movimiento de desecho") from e

        if not update_data:
            # Solo cambió el stock, ya fue actualizado por record_movement
            updated_resp = (
                supabase.table("ingredients")
                .select("*")
                .eq("id", ingredient_id)
                .limit(1)
                .execute()
            )
            row = (updated_resp.data or [None])[0]
            if not row:
                raise Exception("No se pudo actualizar el ingrediente")
            return _row_to_camel(row)

        response = (
            supabase.table("ingredients")
            .update(update_data)
            .eq("id", ingredient_id)
            .execute()
        )
        row = (response.data or [None])[0]
        if not row:
            raise Exception("No se pudo actualizar el ingrediente")
        menu_service.sync_unavailable_from_stock(
            restaurant_id=restaurant_id,
            branch_id=row.get("branch_id"),
        )
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
