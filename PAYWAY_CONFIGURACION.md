# 🔧 Configuración Completa de Payway para Producción

## 📋 Pasos para Configurar Payway

### 1. **Crear Cuenta en Payway**

1. **Registrarse**: https://www.payway.com.ar/
2. **Verificar identidad**:
   - DNI/CUIL/CUIT
   - Documentos de identidad
   - Información de contacto
3. **Configurar cuenta bancaria**:
   - CBU/CVU donde recibirás los pagos
   - Datos del banco
   - Verificación de titularidad

### 2. **Obtener Credenciales de API**

Una vez verificada tu cuenta, obtendrás:

```env
# Credenciales de Producción
PAYWAY_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PAYWAY_ACCESS_TOKEN=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PAYWAY_CLIENT_ID=xxxxxxxx
PAYWAY_CLIENT_SECRET=xxxxxxxx
```

### 3. **Configurar Variables de Entorno**

Crear archivo `.env` en el directorio `backend/`:

```env
# URLs de la aplicación
BACKEND_URL=https://tu-dominio.com
FRONTEND_URL=https://tu-dominio.com

# Payway Configuration (PRODUCCIÓN)
PAYWAY_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PAYWAY_ACCESS_TOKEN=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PAYWAY_CLIENT_ID=xxxxxxxx
PAYWAY_CLIENT_SECRET=xxxxxxxx

# Otras configuraciones
SECRET_KEY=tu-secret-key-super-segura
DATABASE_URL=postgresql://usuario:password@localhost/cafe_db
```

### 4. **Configurar Webhooks**

En el panel de Payway, configurar el webhook:

```
URL: https://tu-dominio.com/payment/webhooks/payway
Método: POST
Eventos: payment.created, payment.updated, payment.cancelled
```

### 5. **Configurar URLs de Retorno**

En el panel de Payway, configurar:

```
Success URL: https://tu-dominio.com/payment/success
Failure URL: https://tu-dominio.com/payment/error
Pending URL: https://tu-dominio.com/payment/pending
```

## 💰 Cómo Funciona el Flujo de Pago

### 1. **Cliente Selecciona "Billetera Virtual"**
- Se llama al endpoint `POST /payment/init`
- Se crea una preferencia de pago en Payway
- Se devuelve un link de pago

### 2. **Cliente Completa el Pago**
- Se abre el link de Payway en nueva pestaña
- Cliente paga con su billetera (Mercado Pago, Ualá, etc.)
- Payway procesa el pago

### 3. **Notificación de Pago**
- Payway envía webhook al backend
- Se actualiza el estado del pedido
- Se notifica al cliente

### 4. **Transferencia a tu Cuenta**
- Payway transfiere el dinero a tu cuenta bancaria
- **Tiempo**: 24-48 horas hábiles
- **Comisión**: ~3-5% del monto (varía según plan)

## 🏦 Configuración Bancaria

### Cuenta Bancaria Requerida
- **Tipo**: Cuenta corriente o caja de ahorro
- **Moneda**: Pesos argentinos (ARS)
- **CBU/CVU**: Para recibir transferencias
- **Titular**: Debe coincidir con tu identidad verificada

### Proceso de Verificación
1. **Envío de datos bancarios**
2. **Verificación de titularidad**
3. **Depósito de prueba** (monto mínimo)
4. **Confirmación de recepción**
5. **Activación de cuenta**

## 🔒 Seguridad y Validaciones

### Webhook Security
```python
# En producción, implementar validación de firma
def validate_webhook_signature(payload, signature):
    # Validar firma HMAC-SHA256
    expected_signature = hmac.new(
        PAYWAY_CLIENT_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected_signature)
```

### Validaciones de Datos
- Verificar monto mínimo/máximo
- Validar datos del pagador
- Verificar external_reference único
- Logging de todas las transacciones

## 📊 Monitoreo y Reportes

### Logs Importantes
```python
# Logs que debes monitorear
logger.info(f"Pago iniciado - Mesa: {mesa_id}, Monto: {monto}")
logger.info(f"Pago aprobado - Payment ID: {payment_id}")
logger.error(f"Error en pago - Mesa: {mesa_id}, Error: {error}")
```

### Métricas a Seguir
- Tasa de conversión de pagos
- Tiempo promedio de procesamiento
- Errores de pago por método
- Volumen de transacciones

## 🧪 Testing en Sandbox

### Credenciales de Prueba
```env
# Sandbox (para desarrollo)
PAYWAY_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PAYWAY_ACCESS_TOKEN=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PAYWAY_CLIENT_ID=test_client_id
PAYWAY_CLIENT_SECRET=test_client_secret
```

### Datos de Prueba
- **Billeteras de prueba**: Mercado Pago, Ualá, etc.
- **Monto máximo**: $1000
- **Sin transferencias reales**: Solo simulación

## 🚀 Despliegue en Producción

### 1. **Configurar SSL**
```bash
# Certificado SSL obligatorio para webhooks
sudo certbot --nginx -d tu-dominio.com
```

### 2. **Configurar Firewall**
```bash
# Permitir solo conexiones HTTPS
sudo ufw allow 443
sudo ufw deny 80
```

### 3. **Monitoreo Continuo**
```bash
# Logs en tiempo real
tail -f /var/log/nginx/access.log
tail -f /var/log/backend/app.log
```

### 4. **Backup de Configuración**
```bash
# Backup de variables de entorno
cp .env .env.backup.$(date +%Y%m%d)
```

## 📞 Soporte y Contacto

### Payway Support
- **Email**: soporte@payway.com.ar
- **Teléfono**: 0800-xxx-xxxx
- **Horarios**: Lunes a Viernes 9-18hs

### Documentación Oficial
- **API Docs**: https://www.payway.com.ar/developers
- **Webhooks**: https://www.payway.com.ar/developers/webhooks
- **SDKs**: https://github.com/payway

## ⚠️ Consideraciones Importantes

### Comisiones
- **Billetera virtual**: ~3-5%
- **Tarjeta de crédito**: ~4-6%
- **Tarjeta de débito**: ~2-3%

### Límites
- **Monto mínimo**: $10
- **Monto máximo**: $50,000 (varía según plan)
- **Transacciones por día**: Según plan contratado

### Tiempos de Procesamiento
- **Pago aprobado**: Inmediato
- **Transferencia a cuenta**: 24-48 horas hábiles
- **Reembolsos**: 5-10 días hábiles

## 🎯 Checklist de Producción

- [ ] Cuenta Payway verificada
- [ ] Credenciales de API obtenidas
- [ ] Variables de entorno configuradas
- [ ] Webhook configurado
- [ ] URLs de retorno configuradas
- [ ] SSL certificado instalado
- [ ] Logs configurados
- [ ] Monitoreo activo
- [ ] Backup de configuración
- [ ] Pruebas en sandbox completadas
- [ ] Documentación del equipo actualizada

## 💡 Tips para Éxito

1. **Comienza con sandbox**: Prueba todo antes de ir a producción
2. **Monitorea logs**: Revisa diariamente los logs de transacciones
3. **Mantén documentación**: Actualiza procedimientos y configuraciones
4. **Capacita al equipo**: Asegúrate de que todos sepan cómo funciona
5. **Plan de contingencia**: Ten un plan B si Payway falla
6. **Comunicación clara**: Informa a los clientes sobre métodos de pago
7. **Soporte disponible**: Ten contacto directo con Payway para emergencias 