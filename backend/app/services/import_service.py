"""
Servicio de importación masiva CSV para ingredientes y productos.
"""
import csv
import io
from typing import Dict, List
from ..db.supabase_client import supabase
from ..utils.units import ALLOWED_UNITS, normalize_unit
from .ingredients_service import ingredients_service


def _parse_csv_bytes(data: bytes) -> List[Dict]:
    """Parsea bytes CSV (con o sin BOM) y devuelve lista de dicts con headers normalizados."""
    text = data.decode("utf-8-sig").strip()  # utf-8-sig quita BOM si existe
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


class ImportService:
    def import_ingredients(
        self, user_id: str, restaurant_id: str, branch_id: str, file_bytes: bytes
    ) -> Dict:
        """
        Importa ingredientes desde un CSV.
        Columnas esperadas: nombre, unidad, stock_actual, costo_unitario, stock_minimo, track_stock
        Hace upsert por (name, restaurant_id). Si cambia stock registra movimiento tipo 'import'.
        Retorna: {created, updated, errors: [{row, message}]}
        """
        rows = _parse_csv_bytes(file_bytes)
        created = updated = 0
        errors: List[Dict] = []

        REQUIRED = {"nombre", "unidad"}

        for idx, row in enumerate(rows, start=2):  # start=2 porque la fila 1 es el header
            row_num = idx
            # Normalizar claves a minúsculas sin espacios
            row = {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}

            missing = REQUIRED - set(row.keys())
            if missing:
                errors.append({"row": row_num, "message": f"Columnas faltantes: {', '.join(missing)}"})
                continue

            name = row.get("nombre", "").strip()
            if not name:
                errors.append({"row": row_num, "message": "nombre está vacío"})
                continue

            unit = normalize_unit(row.get("unidad", ""))
            if unit not in ALLOWED_UNITS:
                errors.append({"row": row_num, "message": f"Unidad inválida: '{row.get('unidad')}'. Permitidas: {', '.join(ALLOWED_UNITS)}"})
                continue

            try:
                new_stock = float(row.get("stock_actual") or 0)
                unit_cost = float(row.get("costo_unitario")) if row.get("costo_unitario") else None
                min_stock = float(row.get("stock_minimo") or 0)
                track_val = row.get("track_stock", "si").lower()
                track_stock = track_val not in ("no", "false", "0")
            except (ValueError, TypeError) as e:
                errors.append({"row": row_num, "message": f"Valor numérico inválido: {e}"})
                continue

            # Buscar si ya existe
            existing_resp = (
                supabase.table("ingredients")
                .select("id, current_stock, branch_id")
                .eq("restaurant_id", restaurant_id)
                .ilike("name", name)
                .limit(1)
                .execute()
            )
            existing = (existing_resp.data or [None])[0]

            try:
                if existing:
                    ing_id = str(existing["id"])
                    old_stock = float(existing.get("current_stock") or 0)
                    delta = round(new_stock - old_stock, 4)

                    update_data: Dict = {"unit": unit, "min_stock": min_stock, "track_stock": track_stock}
                    if unit_cost is not None:
                        update_data["unit_cost"] = unit_cost
                    if branch_id:
                        update_data["branch_id"] = branch_id

                    supabase.table("ingredients").update(update_data).eq("id", ing_id).execute()

                    if delta != 0:
                        ingredients_service.record_movement(
                            ingredient_id=ing_id,
                            qty=delta,
                            movement_type="import",
                            restaurant_id=restaurant_id,
                            reason="Importación CSV",
                            source="csv_import",
                            user_id=user_id,
                            branch_id=branch_id or existing.get("branch_id"),
                        )
                    updated += 1
                else:
                    insert_data = {
                        "restaurant_id": restaurant_id,
                        "branch_id": branch_id or None,
                        "name": name,
                        "unit": unit,
                        "current_stock": new_stock,
                        "unit_cost": unit_cost,
                        "min_stock": min_stock,
                        "track_stock": track_stock,
                    }
                    resp = supabase.table("ingredients").insert(insert_data).execute()
                    new_row = (resp.data or [None])[0]
                    if new_row and new_stock > 0:
                        ingredients_service.record_movement(
                            ingredient_id=str(new_row["id"]),
                            qty=new_stock,
                            movement_type="import",
                            restaurant_id=restaurant_id,
                            reason="Importación CSV (creación)",
                            source="csv_import",
                            user_id=user_id,
                            branch_id=branch_id or None,
                        )
                    created += 1
            except Exception as e:
                errors.append({"row": row_num, "message": f"Error al guardar: {e}"})

        return {"created": created, "updated": updated, "errors": errors}

    def import_products(
        self, user_id: str, restaurant_id: str, branch_id: str, file_bytes: bytes
    ) -> Dict:
        """
        Importa productos del menú desde un CSV.
        Columnas esperadas: nombre, categoria, precio, descripcion, disponible
        Hace upsert por (name, restaurant_id).
        """
        rows = _parse_csv_bytes(file_bytes)
        created = updated = 0
        errors: List[Dict] = []

        REQUIRED = {"nombre", "precio"}

        for idx, row in enumerate(rows, start=2):
            row_num = idx
            row = {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}

            missing = REQUIRED - set(row.keys())
            if missing:
                errors.append({"row": row_num, "message": f"Columnas faltantes: {', '.join(missing)}"})
                continue

            name = row.get("nombre", "").strip()
            if not name:
                errors.append({"row": row_num, "message": "nombre está vacío"})
                continue

            try:
                price = float(row.get("precio") or 0)
                if price < 0:
                    raise ValueError("precio negativo")
            except (ValueError, TypeError) as e:
                errors.append({"row": row_num, "message": f"precio inválido: {e}"})
                continue

            category = row.get("categoria", "").strip() or None
            description = row.get("descripcion", "").strip() or None
            avail_val = row.get("disponible", "si").lower()
            available = avail_val not in ("no", "false", "0")

            # Resolver category_id si se envió nombre de categoría
            category_id = None
            if category:
                cat_resp = (
                    supabase.table("menu_categories")
                    .select("id")
                    .eq("restaurant_id", restaurant_id)
                    .ilike("name", category)
                    .limit(1)
                    .execute()
                )
                cat_row = (cat_resp.data or [None])[0]
                if cat_row:
                    category_id = cat_row["id"]

            # Buscar si ya existe
            existing_resp = (
                supabase.table("menu")
                .select("id")
                .eq("restaurant_id", restaurant_id)
                .ilike("name", name)
                .limit(1)
                .execute()
            )
            existing = (existing_resp.data or [None])[0]

            try:
                if existing:
                    update_data = {"price": price, "available": available}
                    if description is not None:
                        update_data["description"] = description
                    if category_id:
                        update_data["category_id"] = category_id
                    supabase.table("menu").update(update_data).eq("id", existing["id"]).execute()
                    updated += 1
                else:
                    insert_data = {
                        "restaurant_id": restaurant_id,
                        "branch_id": branch_id or None,
                        "name": name,
                        "price": price,
                        "available": available,
                        "description": description,
                        "category_id": category_id,
                    }
                    supabase.table("menu").insert(insert_data).execute()
                    created += 1
            except Exception as e:
                errors.append({"row": row_num, "message": f"Error al guardar: {e}"})

        return {"created": created, "updated": updated, "errors": errors}


import_service = ImportService()
