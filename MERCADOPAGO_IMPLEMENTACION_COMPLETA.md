# Implementación Completa de Mercado Pago Checkout Pro

## 📋 Resumen

Esta implementación proporciona un sistema completo de pagos con Mercado Pago Checkout Pro para locales gastronómicos, permitiendo el pago de múltiples ítems con una interfaz moderna y segura.

## 🚀 Instalación y Configuración

### 1. Backend (Python/Flask)

#### Instalar dependencias:
```bash
cd backend
pip install -r requirements.txt
```

#### Configurar variables de entorno:
Crear archivo `.env` en la carpeta `backend/` basado en `env.example`:

```env
# Configuración de la aplicación
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://username:password@localhost:5432/cafe_db
USE_ORM=true

# Mercado Pago Configuration
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret-here

# URLs de la aplicación
BASE_URL=http://localhost:5001
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5001
```

### 2. Frontend (Next.js)

#### Instalar dependencias:
```bash
cd frontend
npm install
```

#### Configurar variables de entorno:
Crear archivo `.env.local` en la carpeta `frontend/`:

```env
# Mercado Pago Configuration
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Backend URL
BACKEND_URL=http://localhost:5001
```

## 🔑 Obtención de Credenciales de Mercado Pago

1. Crear cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Ir a [Panel de Credenciales](https://www.mercadopago.com.ar/developers/panel/credentials)
3. Obtener:
   - **Access Token** (para el backend)
   - **Public Key** (para el frontend)

### Credenciales de Prueba (Sandbox):
- Access Token: `TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Public Key: `TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Credenciales de Producción:
- Access Token: `APP-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Public Key: `APP-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## 🏗️ Arquitectura del Sistema

### Backend (Python/Flask)

#### Servicio de Mercado Pago (`backend/app/services/mercadopago_service.py`)
```python
class MercadoPagoService:
    def __init__(self):
        self.sdk = mercadopago.SDK(self.access_token)
    
    def create_preference(self, order_data):
        # Crear preferencia de pago
        preference_response = self.sdk.preference().create(preference_data)
        return preference_response
    
    def get_payment_info(self, payment_id):
        # Obtener información del pago
        payment_response = self.sdk.payment().get(payment_id)
        return payment_response
    
    def refund_payment(self, payment_id, amount=None):
        # Reembolsar pago
        refund_response = self.sdk.refund().create(payment_id, refund_data)
        return refund_response
```

#### Controlador de Pagos (`backend/app/controllers/payment_controller.py`)
- `POST /payment/create-preference` - Crear preferencia de pago
- `GET /payment/success` - Callback de pago exitoso
- `GET /payment/failure` - Callback de pago fallido
- `GET /payment/pending` - Callback de pago pendiente
- `POST /payment/webhooks/mercadopago` - Webhook de Mercado Pago

### Frontend (Next.js/React)

#### Componente de Checkout (`frontend/components/mercadopago-checkout.tsx`)
```typescript
export function MercadoPagoCheckout({
  items,
  mesaId,
  onPaymentSuccess,
  onPaymentError,
}: MercadoPagoCheckoutProps) {
  // Lógica del componente
}
```

#### API Route (`frontend/app/api/payment/create-preference/route.ts`)
- Proxy para comunicarse con el backend
- Validación de datos
- Manejo de errores

## 🔄 Flujo de Pago Completo

### 1. Creación de Preferencia
```javascript
// Frontend envía datos del carrito
const response = await fetch("/api/payment/create-preference", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    total_amount: 2100,
    items: [
      { name: "Café Americano", quantity: 1, price: 500 },
      { name: "Torta de Chocolate", quantity: 2, price: 800 }
    ],
    mesa_id: "1"
  })
});
```

### 2. Respuesta del Backend
```json
{
  "success": true,
  "order_id": 123,
  "order_token": "uuid-token",
  "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "preference_id": "123456789-abc123-def456"
}
```

### 3. Integración del Wallet
```typescript
<Wallet
  initialization={{
    preferenceId: preference.preference_id,
  }}
  onSubmit={handlePaymentSuccess}
  onError={handlePaymentError}
/>
```

### 4. Callbacks y Webhooks
- **Success**: Usuario redirigido a `/payment/success`
- **Failure**: Usuario redirigido a `/payment/error`
- **Pending**: Usuario redirigido a `/payment/pending`
- **Webhook**: Notificación automática al backend

## 🧪 Pruebas

### Tarjetas de Prueba (Sandbox)
- **Visa**: `4509 9535 6623 3704`
- **Mastercard**: `5031 4332 1540 6351`
- **American Express**: `3711 8030 3257 522`

### Datos de Prueba
- **CVV**: `123`
- **Fecha de vencimiento**: `12/25`
- **DNI**: `12345678`
- **Nombre**: 
  - `APRO` (pagos aprobados)
  - `OTHE` (pagos pendientes)
  - `CONT` (pagos rechazados)

### Página de Prueba
Acceder a: `http://localhost:3000/test-checkout`

## 🚀 Ejecución

### Backend:
```bash
cd backend
python -m flask run --host=0.0.0.0 --port=5001
```

### Frontend:
```bash
cd frontend
npm run dev
```

## 📊 Endpoints del Backend

### Crear Preferencia de Pago
```http
POST /payment/create-preference
Content-Type: application/json

{
  "total_amount": 2100,
  "items": [
    {
      "name": "Café Americano",
      "quantity": 1,
      "price": 500
    },
    {
      "name": "Torta de Chocolate",
      "quantity": 2,
      "price": 800
    }
  ],
  "mesa_id": "1"
}
```

### Respuesta:
```json
{
  "success": true,
  "order_id": 123,
  "order_token": "uuid-token",
  "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "preference_id": "123456789-abc123-def456"
}
```

### Obtener Estado del Pedido
```http
GET /payment/order-status/123
```

### Respuesta:
```json
{
  "order_id": 123,
  "status": "PAYMENT_APPROVED",
  "payment_status": "approved",
  "total_amount": 2100,
  "created_at": "2024-01-15T10:30:00Z",
  "payment_approved_at": "2024-01-15T10:35:00Z"
}
```

## 🔒 Seguridad

### Validaciones Implementadas:
- Validación de montos positivos
- Validación de items requeridos
- Sanitización de datos de entrada
- Manejo seguro de tokens
- Validación de webhooks (en producción)

### Variables de Entorno:
- **Nunca** commitear archivos `.env` con credenciales reales
- Usar diferentes credenciales para desarrollo y producción
- Rotar tokens periódicamente

## 🐛 Troubleshooting

### Error: "Invalid preference"
- Verificar que las credenciales sean correctas
- Asegurar que el Access Token tenga permisos de preferencias

### Error: "Webhook not received"
- Verificar que la URL del webhook sea accesible públicamente
- Usar ngrok para desarrollo local: `ngrok http 5001`

### Error: "SDK not initialized"
- Verificar que `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` esté configurada
- Reiniciar el servidor de desarrollo

## 📈 Producción

### Configuración para Producción:
1. Cambiar credenciales de TEST a APP
2. Configurar URLs de producción
3. Habilitar validación de webhooks
4. Configurar SSL/TLS
5. Implementar logging y monitoreo

### Variables de Entorno de Producción:
```env
MERCADO_PAGO_ACCESS_TOKEN=APP-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_PUBLIC_KEY=APP-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BASE_URL=https://tu-dominio.com
FRONTEND_URL=https://tu-dominio.com
```

## 📚 Recursos Adicionales

- [Documentación Oficial de Mercado Pago](https://www.mercadopago.com.ar/developers/docs)
- [SDK de Python](https://github.com/mercadopago/sdk-python)
- [SDK de React](https://github.com/mercadopago/sdk-react)
- [Panel de Desarrolladores](https://www.mercadopago.com.ar/developers/panel)

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles. 