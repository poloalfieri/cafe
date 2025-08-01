from flask import Blueprint, request, jsonify
from ..db.supabase_client import supabase

menu_bp = Blueprint("menu", __name__, url_prefix="/menu")

@menu_bp.route("/", methods=["GET", "POST"])
def menu_items():
    """Manejar GET y POST para productos del menú"""
    if request.method == "GET":
        return get_menu()
    elif request.method == "POST":
        return create_menu_item()

def get_menu():
    """Obtener lista de todos los productos del menú"""
    try:
        response = supabase.table("menu").select("*").execute()
        print("Respuesta de Supabase:", response)
        menu = response.data or []
        return jsonify(menu)
    except Exception as e:
        print("Error al consultar Supabase:", e)
        return jsonify({"error": str(e)}), 500

def create_menu_item():
    """Crear un nuevo producto en el menú"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ["name", "category", "price"]
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"error": f"Campo requerido: {field}"}), 400
        
        # Validar que el precio sea un número positivo
        try:
            price = float(data["price"])
            if price < 0:
                return jsonify({"error": "El precio debe ser un número positivo"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "El precio debe ser un número válido"}), 400
        
        # Crear nuevo producto en el menú
        menu_data = {
            "name": data["name"],
            "category": data["category"],
            "price": price,
            "description": data.get("description", ""),
            "available": bool(data.get("available", True))  # Asegurar que sea boolean
        }
        
        response = supabase.table("menu").insert(menu_data).execute()
        
        if not response.data:
            return jsonify({"error": "Error al crear el producto"}), 500
        
        new_item = response.data[0]
        return jsonify({
            "id": str(new_item["id"]),
            "name": new_item["name"],
            "category": new_item["category"],
            "price": float(new_item["price"]),
            "description": new_item.get("description", ""),
            "available": bool(new_item.get("available", True)),
            "created_at": new_item.get("created_at"),
            "updated_at": new_item.get("updated_at")
        }), 201
        
    except Exception as e:
        print("Error al crear producto en menú:", e)
        return jsonify({"error": str(e)}), 500

@menu_bp.route("/<int:item_id>", methods=["GET", "PUT", "DELETE"])
def menu_item(item_id):
    """Manejar GET, PUT y DELETE para un producto específico"""
    if request.method == "GET":
        return get_menu_item(item_id)
    elif request.method == "PUT":
        return update_menu_item(item_id)
    elif request.method == "DELETE":
        return delete_menu_item(item_id)

def get_menu_item(item_id):
    """Obtener un producto específico del menú por ID"""
    try:
        response = supabase.table("menu").select("*").eq("id", item_id).execute()
        
        if not response.data:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        item = response.data[0]
        return jsonify({
            "id": str(item["id"]),
            "name": item["name"],
            "category": item["category"],
            "price": float(item["price"]),
            "description": item.get("description", ""),
            "available": bool(item.get("available", True)),
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at")
        })
        
    except Exception as e:
        print("Error al obtener producto del menú:", e)
        return jsonify({"error": str(e)}), 500

def update_menu_item(item_id):
    """Actualizar un producto existente del menú"""
    try:
        data = request.get_json()
        
        # Verificar que el producto existe
        check_response = supabase.table("menu").select("id").eq("id", item_id).execute()
        if not check_response.data:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        # Preparar datos para actualización
        update_data = {}
        if "name" in data:
            update_data["name"] = data["name"]
        if "category" in data:
            update_data["category"] = data["category"]
        if "price" in data:
            try:
                price = float(data["price"])
                if price < 0:
                    return jsonify({"error": "El precio debe ser un número positivo"}), 400
                update_data["price"] = price
            except (ValueError, TypeError):
                return jsonify({"error": "El precio debe ser un número válido"}), 400
        if "description" in data:
            update_data["description"] = data["description"]
        if "available" in data:
            update_data["available"] = bool(data["available"])  # Asegurar que sea boolean
        
        # Actualizar producto
        response = supabase.table("menu").update(update_data).eq("id", item_id).execute()
        
        if not response.data:
            return jsonify({"error": "Error al actualizar el producto"}), 500
        
        updated_item = response.data[0]
        return jsonify({
            "id": str(updated_item["id"]),
            "name": updated_item["name"],
            "category": updated_item["category"],
            "price": float(updated_item["price"]),
            "description": updated_item.get("description", ""),
            "available": bool(updated_item.get("available", True)),
            "created_at": updated_item.get("created_at"),
            "updated_at": updated_item.get("updated_at")
        })
        
    except Exception as e:
        print("Error al actualizar producto del menú:", e)
        return jsonify({"error": str(e)}), 500

def delete_menu_item(item_id):
    """Eliminar un producto del menú"""
    try:
        # Verificar que el producto existe
        check_response = supabase.table("menu").select("id").eq("id", item_id).execute()
        if not check_response.data:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        # Eliminar producto
        response = supabase.table("menu").delete().eq("id", item_id).execute()
        
        if response.data:
            return jsonify({"message": "Producto eliminado correctamente"}), 200
        else:
            return jsonify({"error": "Error al eliminar el producto"}), 500
        
    except Exception as e:
        print("Error al eliminar producto del menú:", e)
        return jsonify({"error": str(e)}), 500

@menu_bp.route("/<int:item_id>/toggle", methods=["PATCH"])
def toggle_menu_item_availability(item_id):
    """Cambiar la disponibilidad de un producto del menú"""
    try:
        # Obtener el producto actual
        response = supabase.table("menu").select("available").eq("id", item_id).execute()
        
        if not response.data:
            return jsonify({"error": "Producto no encontrado"}), 404
        
        current_available = bool(response.data[0].get("available", True))
        new_available = not current_available
        
        # Actualizar disponibilidad
        update_response = supabase.table("menu").update({"available": new_available}).eq("id", item_id).execute()
        
        if not update_response.data:
            return jsonify({"error": "Error al cambiar la disponibilidad"}), 500
        
        updated_item = update_response.data[0]
        return jsonify({
            "id": str(updated_item["id"]),
            "name": updated_item["name"],
            "available": bool(updated_item.get("available", True)),
            "message": f"Producto {'activado' if bool(updated_item.get('available', True)) else 'desactivado'} correctamente"
        })
        
    except Exception as e:
        print("Error al cambiar disponibilidad del producto:", e)
        return jsonify({"error": str(e)}), 500

@menu_bp.route("/mesas", methods=["GET"])
def get_mesas():
    # Simulación, deberías traerlo de la base de datos
    return jsonify({"message": "Endpoint de mesas"})