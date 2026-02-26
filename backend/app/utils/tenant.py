from flask import g, jsonify


def get_restaurant_id() -> str | None:
    return getattr(g, "restaurant_id", None)


def require_restaurant_scope():
    restaurant_id = get_restaurant_id()
    if not restaurant_id:
        return None, (jsonify({"error": "restaurant_id no resuelto"}), 400)
    return restaurant_id, None
