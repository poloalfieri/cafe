# Guía completa para configurar MercadoPago con Supabase Edge Functions

## 📋 Resumen del problema

Has configurado las edge functions de Supabase para MercadoPago, pero están presentando algunos problemas. Te ayudo a solucionarlo paso a paso.

## 🔧 Configuración actual

Tu proyecto tiene:
- ✅ Edge functions configuradas (`create-payment-preference` y `mercadopago-webhook`)
- ✅ Base de datos con tabla `orders`
- ✅ Credenciales de MercadoPago
- ❌ Las functions no se están sirviendo correctamente

## 🚀 Solución paso a paso

### 1. Verificar el estado de Supabase

```bash
supabase status
```

### 2. Probar las functions directamente con Deno

Para probar que las functions funcionan, puedes ejecutarlas directamente:

```bash
# Navegar al directorio de la función
cd supabase/functions/create-payment-preference

# Ejecutar con Deno
deno run --allow-net --allow-env index.ts
```

### 3. Alternativa: Usar el backend de Python

Mientras solucionamos las edge functions, puedes usar tu backend de Python que ya tienes configurado:

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 5001
```

### 4. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# MercadoPago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-1001359864732827-072913-fbc2fbd03dd8c02207cc74702ac9b036-262306772
MERCADO_PAGO_PUBLIC_KEY=APP_USR-2ba80a43-96d4-46d5-ab6f-c8f8b02fcd63

# Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### 5. Probar la integración desde el frontend

Si tu frontend está en Next.js, puedes probar la integración así:

```javascript
// En tu componente de React
const createPayment = async (items, mesaId) => {
  try {
    const response = await fetch('http://localhost:5001/api/payments/create-preference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mesa_id: mesaId,
        items: items,
        total_amount: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Redirigir a MercadoPago
      window.location.href = data.init_point;
    }
  } catch (error) {
    console.error('Error creating payment:', error);
  }
};
```

## 🐛 Debugging de las Edge Functions

Para ver por qué las edge functions no funcionan:

```bash
# Ver logs de Supabase
supabase logs

# Verificar configuración
cat supabase/config.toml | grep -A 10 functions

# Probar función específica
curl -X POST http://127.0.0.1:54321/functions/v1/create-payment-preference \
  -H "Content-Type: application/json" \
  -d '{"mesa_id": "test", "items": [], "total_amount": 100}'
```

## 📋 URLs importantes

- **Supabase Studio**: http://127.0.0.1:54323
- **API REST**: http://127.0.0.1:54321/rest/v1/
- **Edge Functions**: http://127.0.0.1:54321/functions/v1/
- **Backend Python**: http://localhost:5001

## ✅ Próximos pasos

1. **Verifica que Supabase esté corriendo** con `supabase status`
2. **Prueba el backend de Python** como alternativa temporal
3. **Usa Supabase Studio** para verificar que los datos se guardan correctamente
4. **Configura el webhook** en MercadoPago apuntando a tu edge function

¿Quieres que continuemos con alguno de estos pasos específicos?
