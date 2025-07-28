# Configuración de Mercado Pago - Sistema de Pedidos

## 🔧 Configuración del Backend

### 1. Variables de Entorno

Crea un archivo `.env` en la carpeta `backend/` con las siguientes variables:

```env
# Database Configuration
DATABASE_URL=sqlite:///cafe.db
USE_ORM=true

# Application URLs
BASE_URL=http://localhost:5001
FRONTEND_URL=http://localhost:3000

# Mercado Pago Configuration
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_WEBHOOK_SECRET=your_webhook_secret_here

# Other configurations
SECRET_KEY=your-secret-key-here
TOKEN_EXPIRY_MINUTES=10
```

### 2. Configuración de Mercado Pago

1. **Crear cuenta en Mercado Pago**:
   - Ve a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
   - Crea una cuenta de desarrollador

2. **Obtener credenciales de prueba**:
   - En el dashboard de desarrolladores, ve a "Credenciales"
   - Copia el `Access Token` de prueba
   - Copia la `Public Key` de prueba

3. **Configurar webhooks** (opcional):
   - En el dashboard, ve a "Notificaciones"
   - Configura la URL: `http://localhost:5001/payment/webhooks/mercadopago`
   - Guarda el webhook secret

### 3. Instalar Dependencias

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Crear Base de Datos

```bash
python create_tables.py
```

### 5. Ejecutar el Backend

```bash
python -m app.main
```

## 🚀 Configuración del Frontend

### 1. Instalar Dependencias

```bash
cd frontend
npm install
```

### 2. Ejecutar el Frontend

```bash
npm run dev
```

## 🔄 Flujo Completo del Sistema

### 1. Usuario Realiza Pedido
- El usuario selecciona productos en `/usuario`
- Va al carrito y hace clic en "Ir a pagar"
- El sistema crea una preferencia de pago en Mercado Pago
- Redirige al usuario a la página de pago de Mercado Pago

### 2. Proceso de Pago
- El usuario completa el pago en Mercado Pago
- Mercado Pago redirige de vuelta a `/payment/success`
- El sistema actualiza el estado del pedido a "PAYMENT_APPROVED"

### 3. Gestión por el Cajero
- El cajero ve el pedido en `/cajero`
- Puede aceptar o rechazar el pedido
- Si acepta: el pedido pasa a "IN_PREPARATION"
- Si rechaza: se procesa automáticamente el reembolso

### 4. Estados del Pedido
- `PAYMENT_PENDING`: Pendiente de pago
- `PAYMENT_APPROVED`: Pago aprobado, esperando confirmación del local
- `PAYMENT_REJECTED`: Pago rechazado, reembolso procesado
- `IN_PREPARATION`: En preparación
- `READY`: Listo para entregar
- `DELIVERED`: Entregado

## 📋 Endpoints del Backend

### Crear Preferencia de Pago
```
POST /payment/create-preference
```

### Callbacks de Pago
```
GET /payment/success
GET /payment/failure
GET /payment/pending
```

### Gestión de Pedidos
```
POST /payment/accept-order/{order_id}
POST /payment/reject-order/{order_id}
GET /payment/order-status/{order_id}
```

### Webhook
```
POST /payment/webhooks/mercadopago
```

## 🛠️ Desarrollo

### Modo de Prueba
- Usa las credenciales de prueba de Mercado Pago
- Los pagos no se procesan realmente
- Puedes usar tarjetas de prueba para simular pagos

### Tarjetas de Prueba
- **Aprobada**: 4509 9535 6623 3704
- **Rechazada**: 4000 0000 0000 0002
- **Pendiente**: 4000 0000 0000 0101

## 🔒 Seguridad

### En Producción
1. Usa credenciales de producción de Mercado Pago
2. Configura HTTPS
3. Valida las firmas de los webhooks
4. Usa variables de entorno seguras
5. Implementa autenticación para el panel de cajero

### Validación de Webhooks
El sistema incluye validación de firmas para los webhooks de Mercado Pago. En producción, asegúrate de:
- Configurar el webhook secret correctamente
- Validar la firma en cada notificación
- Manejar errores de validación

## 📱 Páginas del Frontend

### Usuario
- `/usuario`: Menú de productos
- `/usuario/cart`: Carrito de compras

### Pago
- `/payment/success`: Pago exitoso
- `/payment/error`: Error en el pago
- `/payment/pending`: Pago pendiente

### Cajero
- `/cajero`: Panel de gestión

### Administrador
- `/admin`: Panel de administración

## 🐛 Solución de Problemas

### Error de Conexión
- Verifica que el backend esté corriendo en puerto 5001
- Verifica que el frontend esté corriendo en puerto 3000
- Revisa los logs del backend para errores

### Error de Pago
- Verifica las credenciales de Mercado Pago
- Revisa que las URLs de callback estén correctas
- Verifica que la base de datos esté creada

### Error de Base de Datos
- Ejecuta `python create_tables.py` para recrear las tablas
- Verifica que SQLite tenga permisos de escritura
- Revisa los logs para errores específicos 