"""
Utilidad para validar mesa_id y token contra la base de datos Supabase.
"""

from datetime import datetime, timezone
from ..db.supabase_client import supabase
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class MesaValidationError(Exception):
    """Excepción personalizada para errores de validación de mesa."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def is_null_or_empty(value) -> bool:
    """Verifica si un valor es null, None, vacío o el string 'null'."""
    if value is None:
        return True
    if isinstance(value, str):
        stripped = value.strip()
        return stripped == '' or stripped.lower() == 'null' or stripped.lower() == 'undefined'
    return False


def validate_mesa_token(mesa_id: str, token: str) -> dict:
    """
    Valida que mesa_id y token sean válidos y existan en la base de datos.
    
    Args:
        mesa_id: ID de la mesa (ej: "1", "2")
        token: Token del QR de la mesa
    
    Returns:
        dict con los datos de la mesa si es válida
    
    Raises:
        MesaValidationError: Si la validación falla
    """
    # Validar que no sean null/vacíos
    if is_null_or_empty(mesa_id):
        raise MesaValidationError("mesa_id es requerido y no puede ser null", 400)
    
    if is_null_or_empty(token):
        raise MesaValidationError("token es requerido y no puede ser null", 400)
    
    # Buscar la mesa en Supabase
    try:
        response = supabase.table('mesas').select('*').eq('mesa_id', mesa_id).single().execute()
        
        if not response.data:
            logger.warning(f"Mesa no encontrada: mesa_id={mesa_id}")
            raise MesaValidationError(f"Mesa '{mesa_id}' no encontrada", 404)
        
        mesa = response.data
        
    except MesaValidationError:
        raise
    except Exception as e:
        # Si es error de "no rows returned" de Supabase
        if 'PGRST116' in str(e) or 'no rows' in str(e).lower():
            logger.warning(f"Mesa no encontrada: mesa_id={mesa_id}")
            raise MesaValidationError(f"Mesa '{mesa_id}' no encontrada", 404)
        logger.error(f"Error consultando mesa: {str(e)}")
        raise MesaValidationError("Error interno al validar mesa", 500)
    
    # Validar que el token coincida
    if mesa.get('token') != token:
        logger.warning(f"Token inválido para mesa {mesa_id}: esperado={mesa.get('token')[:20]}..., recibido={token[:20] if token else 'None'}...")
        raise MesaValidationError("Token inválido para esta mesa", 401)
    
    # Validar que la mesa esté activa
    if not mesa.get('is_active', True):
        logger.warning(f"Mesa inactiva: mesa_id={mesa_id}")
        raise MesaValidationError("Esta mesa no está activa", 403)
    
    # Validar expiración del token (si existe token_expires_at)
    token_expires_at = mesa.get('token_expires_at')
    if token_expires_at:
        try:
            # Parsear la fecha de expiración
            if isinstance(token_expires_at, str):
                # Formato ISO de Supabase
                expires_at = datetime.fromisoformat(token_expires_at.replace('Z', '+00:00'))
            else:
                expires_at = token_expires_at
            
            now = datetime.now(timezone.utc)
            
            if now > expires_at:
                logger.warning(f"Token expirado para mesa {mesa_id}: expiró {expires_at}, ahora {now}")
                raise MesaValidationError("El token de la mesa ha expirado. Escanea el QR nuevamente.", 401)
                
        except MesaValidationError:
            raise
        except Exception as e:
            # Si hay error parseando la fecha, logear pero no bloquear
            logger.warning(f"No se pudo parsear token_expires_at: {token_expires_at}, error: {e}")
    
    logger.info(f"Mesa validada correctamente: mesa_id={mesa_id}")
    return mesa


def validate_mesa_exists(mesa_id: str) -> dict:
    """
    Valida que una mesa exista (sin validar token).
    Útil para operaciones donde no se tiene el token.
    
    Args:
        mesa_id: ID de la mesa
    
    Returns:
        dict con los datos de la mesa si existe
    
    Raises:
        MesaValidationError: Si la mesa no existe
    """
    if is_null_or_empty(mesa_id):
        raise MesaValidationError("mesa_id es requerido y no puede ser null", 400)
    
    try:
        response = supabase.table('mesas').select('*').eq('mesa_id', mesa_id).single().execute()
        
        if not response.data:
            raise MesaValidationError(f"Mesa '{mesa_id}' no encontrada", 404)
        
        return response.data
        
    except MesaValidationError:
        raise
    except Exception as e:
        if 'PGRST116' in str(e) or 'no rows' in str(e).lower():
            raise MesaValidationError(f"Mesa '{mesa_id}' no encontrada", 404)
        logger.error(f"Error consultando mesa: {str(e)}")
        raise MesaValidationError("Error interno al validar mesa", 500)

