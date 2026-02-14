# Gestión de Super Admins

## Descripción

Se ha agregado la funcionalidad completa para que un super-admin (usuario con rol "desarrollador") pueda:
1. Ver la lista de todas las cuentas super-admin
2. Crear nuevas cuentas super-admin con email y contraseña
3. Eliminar cuentas super-admin existentes

## Archivos Creados

### 1. Endpoint: Crear Super Admin
**Archivo:** `/frontend/app/api/super-admin/create-super-admin/route.ts`

Permite crear nuevas cuentas super-admin.

**Método:** POST

**Body:**
```json
{
  "email": "nuevo-superadmin@ejemplo.com",
  "password": "contraseña123",
  "fullName": "Nombre Completo (opcional)"
}
```

**Validaciones:**
- Email debe ser válido (contener @)
- Contraseña debe tener al menos 6 caracteres
- Verifica que no exista un usuario con ese email
- Solo accesible por usuarios con rol "desarrollador"

**Respuesta exitosa:**
```json
{
  "ok": true,
  "user_id": "uuid-del-usuario",
  "email": "nuevo-superadmin@ejemplo.com"
}
```

### 2. Endpoint: Listar Super Admins
**Archivo:** `/frontend/app/api/super-admin/list-super-admins/route.ts`

Obtiene la lista de todos los usuarios con rol "desarrollador".

**Método:** GET

**Respuesta:**
```json
{
  "superAdmins": [
    {
      "id": "uuid",
      "email": "admin@ejemplo.com",
      "full_name": "Nombre Completo",
      "created_at": "2024-01-01T00:00:00Z",
      "last_sign_in_at": "2024-02-14T12:00:00Z"
    }
  ]
}
```

### 3. Endpoint: Eliminar Super Admin
**Archivo:** `/frontend/app/api/super-admin/delete-super-admin/route.ts`

Elimina permanentemente una cuenta super-admin.

**Método:** DELETE

**Body:**
```json
{
  "userId": "uuid-del-usuario"
}
```

**Validaciones:**
- userId es requerido
- No puedes eliminar tu propia cuenta
- El usuario debe ser super-admin
- Solo accesible por usuarios con rol "desarrollador"

**Respuesta exitosa:**
```json
{
  "ok": true
}
```

## Archivos Modificados

### Dashboard de Super Admin
**Archivo:** `/frontend/components/super-admin-dashboard.tsx`

Se agregó una nueva sección completa en la pestaña "Configuración" con:

**1. Lista de Super Admins:**
- Muestra todos los super-admins del sistema
- Información mostrada:
  - Email
  - Nombre completo
  - Fecha de creación
  - Último acceso
  - Badge "Tú" para identificar tu propia cuenta
- Botón de actualizar lista
- Botón de eliminar (deshabilitado para tu propia cuenta)

**2. Formulario de Creación:**
- Modal para crear nuevos super-admins
- Campos:
  - Email (requerido)
  - Contraseña (requerido, mínimo 6 caracteres)
  - Nombre completo (opcional)
- Validación en tiempo real
- Manejo de errores

**3. Confirmación de Eliminación:**
- AlertDialog para confirmar antes de eliminar
- Muestra información del usuario a eliminar
- Advertencia sobre la acción irreversible

## Flujo de Uso

### Ver Lista de Super Admins
1. Iniciar sesión como super-admin en `/super-admin`
2. Navegar a la pestaña "Configuración"
3. La lista de super-admins se carga automáticamente
4. Ver información detallada de cada cuenta

### Crear Super Admin
1. En la pestaña "Configuración"
2. Sección "Crear Super Admin"
3. Click en "Crear Super Admin"
4. Completar el formulario:
   - Email del nuevo super-admin
   - Contraseña (mínimo 6 caracteres)
   - Nombre completo (opcional)
5. Click en "Crear Super Admin"
6. La lista se actualiza automáticamente

### Eliminar Super Admin
1. En la lista de super-admins
2. Click en el botón de eliminar (icono de basura)
3. Confirmar en el diálogo de advertencia
4. La cuenta se elimina permanentemente
5. La lista se actualiza automáticamente

**Nota:** No puedes eliminar tu propia cuenta (el botón estará deshabilitado)

## Características de Seguridad

1. **Autenticación y Autorización:**
   - Solo usuarios con rol "desarrollador" pueden acceder a estos endpoints
   - Verificación de token Bearer en cada request

2. **Validaciones:**
   - Email único al crear
   - Contraseñas de al menos 6 caracteres
   - No puedes eliminar tu propia cuenta

3. **Confirmaciones:**
   - Diálogo de confirmación antes de eliminar
   - Advertencias claras sobre acciones irreversibles

4. **Información del Usuario:**
   - Identificación visual de tu propia cuenta
   - Fechas de creación y último acceso visibles

## Interfaz de Usuario

### Lista de Super Admins
- Cards con bordes que cambian de color al pasar el mouse
- Badge "Tú" en color púrpura para tu cuenta
- Botón de eliminar en rojo (deshabilitado para tu cuenta)
- Botón de actualizar en la esquina superior derecha
- Estados de carga con spinner animado
- Estado vacío cuando no hay super-admins

### Modal de Creación
- Diseño consistente con el resto del dashboard
- Inputs validados en tiempo real
- Botón deshabilitado si hay errores
- Mensajes de error claros
- Indicador de carga durante la creación

### Confirmación de Eliminación
- AlertDialog con advertencia destacada
- Muestra email y nombre completo del usuario
- Texto en rojo para advertencia
- Botón de eliminar en rojo
- Loading state durante la eliminación

## Notas Técnicas

- El rol "desarrollador" es el equivalente a "super-admin"
- Los super-admins no están vinculados a ningún restaurante
- El rol se asigna en `app_metadata` con `{ role: "desarrollador" }`
- Se utiliza `requireStaffAuth()` para validar permisos
- La lista se carga automáticamente al abrir la pestaña
- Después de crear o eliminar, la lista se actualiza automáticamente
