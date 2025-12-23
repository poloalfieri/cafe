# 🔄 Ejemplo de Migración - Menu Controller

## ANTES (Sin Seguridad) ❌

```python
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
        menu = response.data or []
        return jsonify(menu)
    except Exception as e:
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
        
        # Crear nuevo producto
        menu_data = {
            "name": data["name"],
            "category": data["category"],
            "price": float(data["price"]),
            "description": data.get("description", ""),
            "available": bool(data.get("available", True))
        }
        
        response = supabase.table("menu").insert(menu_data).execute()
        
        if not response.data:
            return jsonify({"error": "Error al crear el producto"}), 500
        
        return jsonify(response.data[0]), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

**Problemas:**
- ❌ Sin autenticación
- ❌ Sin autorización
- ❌ Cualquiera puede crear/modificar productos
- ❌ Sin auditoría
- ❌ Sin logging de seguridad

---

## DESPUÉS (Con Seguridad) ✅

```python
from flask import Blueprint, request, jsonify, g
from ..db.supabase_client import supabase
from ..middleware.auth import require_auth, require_roles, optional_auth, is_authenticated
import logging

logger = logging.getLogger(__name__)

menu_bp = Blueprint("menu", __name__, url_prefix="/menu")

# ✅ GET es público pero con personalización para usuarios autenticados
@menu_bp.route("/", methods=["GET"])
@optional_auth  # Token opcional
def get_menu():
    """Obtener lista de todos los productos del menú"""
    try:
        response = supabase.table("menu").select("*").execute()
        menu = response.data or []
        
        # Personalizar respuesta si hay usuario
        if is_authenticated():
            logger.info(f"Usuario {g.current_user['email']} consultó el menú")
            return jsonify({
                "menu": menu,
                "user": g.current_user['email'],
                "role": g.user_role
            })
        
        logger.info("Usuario anónimo consultó el menú")
        return jsonify(menu)
        
    except Exception as e:
        logger.error(f"Error al obtener menú: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ✅ POST requiere autenticación y rol específico
@menu_bp.route("/", methods=["POST"])
@require_auth  # ✅ Requiere estar autenticado
@require_roles('desarrollador', 'admin')  # ✅ Solo estos roles
def create_menu_item():
    """Crear un nuevo producto en el menú"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ["name", "category", "price"]
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"error": f"Campo requerido: {field}"}), 400
        
        # Validar precio
        try:
            price = float(data["price"])
            if price < 0:
                return jsonify({"error": "El precio debe ser positivo"}), 400
            if price > 999999.99:
                return jsonify({"error": "El precio excede el límite"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "El precio debe ser un número válido"}), 400
        
        # Crear nuevo producto con auditoría
        menu_data = {
            "name": data["name"],
            "category": data["category"],
            "price": price,
            "description": data.get("description", ""),
            "available": bool(data.get("available", True)),
            "created_by": g.user_id,  # ✅ Auditoría: quién creó
            "org_id": g.user_org_id  # ✅ Asociar a organización
        }
        
        response = supabase.table("menu").insert(menu_data).execute()
        
        if not response.data:
            logger.error(f"Error al crear producto por {g.current_user['email']}")
            return jsonify({"error": "Error al crear el producto"}), 500
        
        new_item = response.data[0]
        
        # ✅ Log de auditoría
        logger.info(
            f"Producto creado - "
            f"ID: {new_item['id']}, "
            f"Nombre: {new_item['name']}, "
            f"Usuario: {g.current_user['email']}, "
            f"Rol: {g.user_role}"
        )
        
        return jsonify(new_item), 201
        
    except Exception as e:
        logger.error(f"Error al crear producto: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ✅ PUT requiere autenticación y roles específicos
@menu_bp.route("/<int:item_id>", methods=["PUT"])
@require_auth
@require_roles('desarrollador', 'admin')
def update_menu_item(item_id):
    """Actualizar un producto existente del menú"""
    try:
        data = request.get_json()
        
        # Verificar que el producto existe
        check_response = supabase.table("menu").select("*").eq("id", item_id).execute()
        if not check_response.data:
            logger.warning(f"Intento de actualizar producto inexistente {item_id} por {g.current_user['email']}")
            return jsonify({"error": "Producto no encontrado"}), 404
        
        old_product = check_response.data[0]
        
        # ✅ Validar pertenencia a organización
        if g.user_role != 'desarrollador':  # Desarrollador puede todo
            product_org = old_product.get('org_id')
            if product_org and product_org != g.user_org_id:
                logger.warning(
                    f"Usuario {g.current_user['email']} intentó "
                    f"actualizar producto de otra organización"
                )
                return jsonify({"error": "No puede modificar productos de otra organización"}), 403
        
        # Preparar datos para actualización
        update_data = {}
        if "name" in data:
            update_data["name"] = data["name"]
        if "category" in data:
            update_data["category"] = data["category"]
        if "price" in data:
            try:
                price = float(data["price"])
                if price < 0 or price > 999999.99:
                    return jsonify({"error": "Precio inválido"}), 400
                update_data["price"] = price
            except (ValueError, TypeError):
                return jsonify({"error": "El precio debe ser un número válido"}), 400
        if "description" in data:
            update_data["description"] = data["description"]
        if "available" in data:
            update_data["available"] = bool(data["available"])
        
        # ✅ Auditoría
        update_data["updated_by"] = g.user_id
        
        # Actualizar producto
        response = supabase.table("menu").update(update_data).eq("id", item_id).execute()
        
        if not response.data:
            return jsonify({"error": "Error al actualizar el producto"}), 500
        
        updated_item = response.data[0]
        
        # ✅ Log de auditoría detallado
        changes = {k: {"old": old_product.get(k), "new": v} for k, v in update_data.items() if k in old_product}
        logger.info(
            f"Producto actualizado - "
            f"ID: {item_id}, "
            f"Usuario: {g.current_user['email']}, "
            f"Cambios: {changes}"
        )
        
        return jsonify(updated_item)
        
    except Exception as e:
        logger.error(f"Error al actualizar producto {item_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ✅ DELETE solo para desarrollador
@menu_bp.route("/<int:item_id>", methods=["DELETE"])
@require_auth
@require_roles('desarrollador')  # Solo desarrollador puede eliminar
def delete_menu_item(item_id):
    """Eliminar un producto del menú"""
    try:
        # Verificar que el producto existe
        check_response = supabase.table("menu").select("*").eq("id", item_id).execute()
        if not check_response.data:
            logger.warning(f"Intento de eliminar producto inexistente {item_id} por {g.current_user['email']}")
            return jsonify({"error": "Producto no encontrado"}), 404
        
        product = check_response.data[0]
        
        # Eliminar producto
        response = supabase.table("menu").delete().eq("id", item_id).execute()
        
        if response.data:
            # ✅ Log crítico de auditoría
            logger.warning(
                f"⚠️ PRODUCTO ELIMINADO - "
                f"ID: {item_id}, "
                f"Nombre: {product['name']}, "
                f"Usuario: {g.current_user['email']}, "
                f"Rol: {g.user_role}"
            )
            
            # ✅ Guardar en tabla de auditoría (opcional)
            # audit_log.insert({
            #     "user_id": g.user_id,
            #     "action": "DELETE",
            #     "resource": "menu",
            #     "resource_id": item_id,
            #     "details": product
            # })
            
            return jsonify({"message": "Producto eliminado correctamente"}), 200
        else:
            return jsonify({"error": "Error al eliminar el producto"}), 500
        
    except Exception as e:
        logger.error(f"Error al eliminar producto {item_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500
```

---

## 📊 Cambios Implementados

### ✅ Seguridad
- [x] Autenticación requerida en operaciones sensibles
- [x] Autorización basada en roles
- [x] Validación de pertenencia a organización
- [x] Protección contra accesos no autorizados

### ✅ Auditoría
- [x] Log de quién creó cada producto (`created_by`)
- [x] Log de quién modificó cada producto (`updated_by`)
- [x] Registro detallado de cambios
- [x] Alertas en logs para operaciones críticas (DELETE)

### ✅ Validación
- [x] Validación mejorada de precios (límites)
- [x] Validación de pertenencia a organización
- [x] Verificación de existencia antes de modificar
- [x] Mensajes de error descriptivos

### ✅ Logging
- [x] Logs de acceso (quién consultó el menú)
- [x] Logs de modificaciones con detalles
- [x] Logs de errores con contexto
- [x] Logs de intentos no autorizados

---

## 🎯 Matriz de Acceso Actualizada

| Acción | Desarrollador | Admin | Caja | Mozo | Público |
|--------|---------------|-------|------|------|---------|
| Ver menú (GET) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear producto (POST) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modificar producto (PUT) | ✅ | ✅* | ❌ | ❌ | ❌ |
| Eliminar producto (DELETE) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Toggle disponibilidad (PATCH) | ✅ | ✅ | ❌ | ❌ | ❌ |

\* Solo productos de su organización

---

## 📝 Próximos Pasos

1. Aplicar mismo patrón a:
   - ✅ `menu_controller.py` (ejemplo completado)
   - ⏳ `order_controller.py`
   - ⏳ `payment_controller.py`
   - ⏳ `waiter_controller.py`
   - ⏳ `metrics_controller.py`
   - ⏳ `mesa_controller.py`

2. Agregar tabla de auditoría en Supabase:
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

3. Implementar rate limiting

4. Agregar tests de seguridad
