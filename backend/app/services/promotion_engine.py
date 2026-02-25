"""
Motor de aplicación de promociones automáticas.
Procesa los ítems de un pedido y aplica descuentos según las promotions activas y no manuales.
"""
from datetime import datetime, timezone, time as dt_time
from typing import Dict, List, Tuple
from .promotions_service import promotions_service


def _current_time() -> dt_time:
    now = datetime.now(timezone.utc)
    return now.time()


def _promotion_applies_to_item(promotion: Dict, product_id) -> bool:
    """Devuelve True si la promotion aplica a ese product_id."""
    applicable = promotion.get("applicable_products") or []
    if not applicable:
        return True  # Sin restricción = aplica a todos
    str_id = str(product_id)
    return any(str(p) == str_id for p in applicable)


def _in_time_window(promotion: Dict) -> bool:
    """Verifica si la hora actual está dentro del rango start_time–end_time de la promotion."""
    start_t = promotion.get("start_time")
    end_t = promotion.get("end_time")
    if not start_t or not end_t:
        return True
    try:
        now = _current_time()
        # start_time/end_time son strings "HH:MM:SS" o "HH:MM"
        def parse_t(s):
            parts = s.split(":")
            return dt_time(int(parts[0]), int(parts[1]))
        st = parse_t(start_t)
        et = parse_t(end_t)
        return st <= now <= et
    except Exception:
        return True


def _in_date_range(promotion: Dict) -> bool:
    """Verifica si la fecha actual está dentro del rango start_date–end_date."""
    start_d = promotion.get("start_date")
    end_d = promotion.get("end_date")
    today = datetime.now(timezone.utc).date()
    try:
        if start_d and datetime.fromisoformat(start_d).date() > today:
            return False
        if end_d and datetime.fromisoformat(end_d).date() < today:
            return False
    except Exception:
        pass
    return True


def apply_promotions_to_items(
    items: List[Dict],
    restaurant_id: str,
    branch_id: str,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Aplica las promotions automáticas activas a los ítems del pedido.

    Retorna:
        (items_modificados, savings_summary)
        - items_modificados: copia de items con finalPrice, discountAmount, promotionId por ítem
        - savings_summary: [{id, name, type, saving_amount}]
    """
    promotions = promotions_service.list_active_for_branch(restaurant_id, branch_id)
    if not promotions:
        return _items_with_final_price(items), []

    # Clonar items para no mutar el original
    result_items = [dict(item) for item in items]
    for it in result_items:
        it.setdefault("discountAmount", 0.0)
        it.setdefault("promotionId", None)
        # finalPrice arranca con el precio base (ya podría tener selectedOptions incluidos)
        it["finalPrice"] = float(it.get("price", 0))

    savings: Dict[str, float] = {}  # promotion_id → total ahorrado

    for promo in promotions:
        if not promo.get("active"):
            continue
        if not _in_date_range(promo):
            continue

        promo_type = promo.get("type", "")
        promo_id = str(promo.get("id", ""))
        value = float(promo.get("value") or 0)

        if promo_type == "discount":
            for it in result_items:
                if not _promotion_applies_to_item(promo, it.get("id")):
                    continue
                unit_price = float(it.get("price", 0))
                discount_unit = round(unit_price * value / 100, 2)
                it["finalPrice"] = round(it["finalPrice"] - discount_unit, 2)
                it["discountAmount"] = round(it.get("discountAmount", 0) + discount_unit, 2)
                it["promotionId"] = promo_id
                savings[promo_id] = savings.get(promo_id, 0) + discount_unit * int(it.get("quantity", 1))

        elif promo_type == "timeframe":
            if not _in_time_window(promo):
                continue
            for it in result_items:
                if not _promotion_applies_to_item(promo, it.get("id")):
                    continue
                unit_price = float(it.get("price", 0))
                discount_unit = round(unit_price * value / 100, 2)
                it["finalPrice"] = round(it["finalPrice"] - discount_unit, 2)
                it["discountAmount"] = round(it.get("discountAmount", 0) + discount_unit, 2)
                it["promotionId"] = promo_id
                savings[promo_id] = savings.get(promo_id, 0) + discount_unit * int(it.get("quantity", 1))

        elif promo_type == "2x1":
            # Por cada par de ítems elegibles el segundo sale gratis (precio unitario)
            eligible = [it for it in result_items if _promotion_applies_to_item(promo, it.get("id"))]
            for it in eligible:
                qty = int(it.get("quantity", 1))
                unit_price = float(it.get("price", 0))
                free_units = qty // 2  # por cada 2 uno gratis
                if free_units > 0:
                    discount_total = round(unit_price * free_units, 2)
                    per_unit_discount = round(discount_total / qty, 2)
                    it["finalPrice"] = round(it["finalPrice"] - per_unit_discount, 2)
                    it["discountAmount"] = round(it.get("discountAmount", 0) + per_unit_discount, 2)
                    it["promotionId"] = promo_id
                    savings[promo_id] = savings.get(promo_id, 0) + discount_total

        elif promo_type == "combo":
            # Verificar si todos los productos del combo están en el pedido con cantidad suficiente
            combo_items = promotions_service.get_combo_items(promo_id)
            if not combo_items:
                continue
            combo_price = value  # valor del combo = precio especial total
            matched = True
            for ci in combo_items:
                ci_product_id = str(ci["product_id"])
                ci_qty = int(ci.get("quantity", 1))
                order_qty = sum(
                    int(it.get("quantity", 1))
                    for it in result_items
                    if str(it.get("id")) == ci_product_id
                )
                if order_qty < ci_qty:
                    matched = False
                    break

            if matched:
                # Calcular precio normal del combo para saber el descuento
                normal_total = sum(
                    float(it.get("price", 0)) * min(
                        int(it.get("quantity", 1)),
                        next((int(ci["quantity"]) for ci in combo_items if str(ci["product_id"]) == str(it.get("id"))), 0)
                    )
                    for it in result_items
                    if any(str(ci["product_id"]) == str(it.get("id")) for ci in combo_items)
                )
                combo_saving = max(0, round(normal_total - combo_price, 2))
                if combo_saving > 0:
                    # Distribuir el descuento proporcialmente entre los ítems del combo
                    for ci in combo_items:
                        ci_product_id = str(ci["product_id"])
                        for it in result_items:
                            if str(it.get("id")) == ci_product_id:
                                unit_price = float(it.get("price", 0))
                                proportion = unit_price / normal_total if normal_total else 0
                                discount_unit = round(combo_saving * proportion, 2)
                                it["finalPrice"] = round(it["finalPrice"] - discount_unit, 2)
                                it["discountAmount"] = round(it.get("discountAmount", 0) + discount_unit, 2)
                                it["promotionId"] = promo_id
                    savings[promo_id] = savings.get(promo_id, 0) + combo_saving

    # Asegurar finalPrice >= 0
    for it in result_items:
        it["finalPrice"] = max(0.0, it["finalPrice"])

    savings_summary = [
        {"id": pid, "name": _promo_name(promotions, pid), "saving_amount": round(amt, 2)}
        for pid, amt in savings.items()
        if amt > 0
    ]

    return result_items, savings_summary


def _items_with_final_price(items: List[Dict]) -> List[Dict]:
    result = []
    for it in items:
        item = dict(it)
        item.setdefault("finalPrice", float(it.get("price", 0)))
        item.setdefault("discountAmount", 0.0)
        item.setdefault("promotionId", None)
        result.append(item)
    return result


def _promo_name(promotions: List[Dict], promo_id: str) -> str:
    for p in promotions:
        if str(p.get("id")) == promo_id:
            return p.get("name", "")
    return ""
