# Solución: Error 405 Method Not Allowed

## Problema
El error `405 Method Not Allowed` indica que Flask no está reconociendo correctamente el método POST para la ruta `/menu`.

## Solución Implementada

### 1. Controlador de Menú Reescrito
Se reescribió el controlador `menu_controller.py` para manejar mejor los métodos HTTP:

```python
@menu_bp.route("/", methods=["GET", "POST"])
def menu_items():
    if request.method == "GET":
        return get_menu()
    elif request.method == "POST":
        return create_menu_item()
```

### 2. Blueprint de Productos Deshabilitado
Se comentó temporalmente el registro del blueprint de productos para evitar conflictos:

```python
# app.register_blueprint(product_bp)  # Comentado para evitar conflictos
```

### 3. Rutas Consolidadas
Se consolidaron las rutas para evitar conflictos:
- `GET /menu` y `POST /menu` en una sola función
- `GET /menu/<id>`, `PUT /menu/<id>`, `DELETE /menu/<id>` en una sola función

## Pasos para Aplicar la Solución

### Paso 1: Reiniciar el Backend
```bash
# Detener el servidor actual (Ctrl+C)
# Luego reiniciar
cd backend
python -m flask run --host=0.0.0.0 --port=5001
```

### Paso 2: Probar los Endpoints
Ejecuta el script de prueba:
```bash
python test_menu_endpoints.py
```

### Paso 3: Verificar en el Frontend
1. Ve al panel de admin: `http://localhost:3000/admin`
2. Intenta crear un nuevo producto
3. Verifica que no aparece el error 405

## Endpoints Disponibles

### ✅ GET /menu
- **Descripción**: Obtener todos los productos
- **Método**: GET
- **Respuesta**: Lista de productos

### ✅ POST /menu
- **Descripción**: Crear nuevo producto
- **Método**: POST
- **Body**: 
```json
{
  "name": "Nombre del producto",
  "category": "Categoría",
  "price": 10.99,
  "description": "Descripción opcional",
  "available": true
}
```

### ✅ PUT /menu/<id>
- **Descripción**: Actualizar producto
- **Método**: PUT
- **Body**: Campos a actualizar

### ✅ DELETE /menu/<id>
- **Descripción**: Eliminar producto
- **Método**: DELETE

### ✅ PATCH /menu/<id>/toggle
- **Descripción**: Cambiar disponibilidad
- **Método**: PATCH

## Verificación

### Script de Prueba
El archivo `test_menu_endpoints.py` incluye pruebas para todos los endpoints:

```bash
python test_menu_endpoints.py
```

### Logs Esperados
Si todo funciona correctamente, deberías ver:
```
🧪 Iniciando pruebas de endpoints del menú...
🔍 Probando GET /menu...
Status: 200
➕ Probando POST /menu...
Status: 201
✏️ Probando PUT /menu/1...
Status: 200
🔄 Probando PATCH /menu/1/toggle...
Status: 200
🗑️ Probando DELETE /menu/1...
Status: 200
✅ Pruebas completadas
```

## Si el Problema Persiste

### 1. Verificar Logs del Backend
```bash
# En los logs del backend, busca:
# - "GET /menu HTTP/1.1" 200
# - "POST /menu HTTP/1.1" 201
```

### 2. Verificar CORS
El backend tiene CORS habilitado, pero si hay problemas:
```python
# En main.py
CORS(app, resources={r"/*": {"origins": "*"}})
```

### 3. Verificar Supabase
Asegúrate de que la tabla `menu` existe en Supabase:
```sql
-- Ejecutar en Supabase SQL Editor
SELECT * FROM menu LIMIT 5;
```

## Restaurar Blueprint de Productos (Opcional)

Una vez que el menú funcione correctamente, puedes restaurar el blueprint de productos:

```python
# En routes.py, descomenta:
app.register_blueprint(product_bp)
```

Pero asegúrate de que no haya conflictos de rutas entre ambos blueprints. 