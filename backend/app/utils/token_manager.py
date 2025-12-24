"""
Token Manager - Gestión segura de tokens en base de datos
Reemplaza el almacenamiento en memoria por persistencia en DB
"""
import secrets
import logging
from datetime import datetime, timedelta
from sqlalchemy import text
from app.db.connection import get_db

logger = logging.getLogger(__name__)


def generate_token(mesa_id: str, expiry_minutes: int = 10) -> str:
    """
    Genera un token seguro y lo almacena en la base de datos.
    
    Args:
        mesa_id: Identificador de la mesa
        expiry_minutes: Minutos de validez del token (default: 10)
    
    Returns:
        Token generado
    
    Raises:
        ValueError: Si mesa_id no existe
        Exception: Si hay error al guardar en DB
    """
    try:
        # Generar token criptográficamente seguro
        token = secrets.token_urlsafe(32)  # 32 bytes = 256 bits
        expiry = datetime.utcnow() + timedelta(minutes=expiry_minutes)
        
        # Obtener conexión a la base de datos
        db = get_db()
        
        # Actualizar token en la base de datos
        query = text("""
            UPDATE mesas 
            SET current_token = :token, 
                token_expires_at = :expiry,
                updated_at = :now
            WHERE mesa_id = :mesa_id
        """)
        
        result = db.execute(query, {
            "token": token,
            "expiry": expiry,
            "now": datetime.utcnow(),
            "mesa_id": mesa_id
        })
        db.commit()
        
        if result.rowcount == 0:
            raise ValueError(f"Mesa {mesa_id} no existe en la base de datos")
        
        logger.info(f"Token generado para mesa {mesa_id}, expira en {expiry_minutes} minutos")
        return token
        
    except Exception as e:
        logger.error(f"Error generando token para mesa {mesa_id}: {str(e)}")
        db.rollback()
        raise


def validate_token(mesa_id: str, token: str) -> bool:
    """
    Valida un token contra la base de datos.
    
    Args:
        mesa_id: Identificador de la mesa
        token: Token a validar
    
    Returns:
        True si el token es válido, False en caso contrario
    """
    try:
        db = get_db()
        
        # Consultar token de la base de datos
        query = text("""
            SELECT current_token, token_expires_at, is_active 
            FROM mesas 
            WHERE mesa_id = :mesa_id
        """)
        
        result = db.execute(query, {"mesa_id": mesa_id}).fetchone()
        
        # Verificaciones de seguridad
        if not result:
            logger.warning(f"Intento de validar token para mesa inexistente: {mesa_id}")
            return False
        
        if not result.is_active:
            logger.warning(f"Intento de usar token en mesa inactiva: {mesa_id}")
            return False
        
        if not result.current_token:
            logger.warning(f"No hay token generado para mesa: {mesa_id}")
            return False
        
        # Verificar que el token coincida (comparación segura)
        if not secrets.compare_digest(result.current_token, token):
            logger.warning(f"Token inválido para mesa: {mesa_id}")
            return False
        
        # Verificar que no haya expirado
        # SQLite devuelve fechas como strings, necesitamos convertir
        expires_at = result.token_expires_at
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        
        if expires_at < datetime.utcnow():
            logger.warning(f"Token expirado para mesa: {mesa_id}")
            # Limpiar token expirado
            _clear_expired_token(mesa_id)
            return False
        
        logger.info(f"Token validado exitosamente para mesa: {mesa_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error validando token para mesa {mesa_id}: {str(e)}")
        return False


def renew_token(mesa_id: str, expiry_minutes: int = 10) -> str:
    """
    Renueva el token de una mesa.
    Es un alias de generate_token para mantener compatibilidad.
    
    Args:
        mesa_id: Identificador de la mesa
        expiry_minutes: Minutos de validez del token
    
    Returns:
        Nuevo token generado
    """
    logger.info(f"Renovando token para mesa: {mesa_id}")
    return generate_token(mesa_id, expiry_minutes)


def invalidate_token(mesa_id: str) -> bool:
    """
    Invalida el token actual de una mesa.
    Útil para logout o finalización de sesión.
    
    Args:
        mesa_id: Identificador de la mesa
    
    Returns:
        True si se invalidó correctamente
    """
    try:
        db = get_db()
        
        query = text("""
            UPDATE mesas 
            SET current_token = NULL, 
                token_expires_at = NULL,
                updated_at = :now
            WHERE mesa_id = :mesa_id
        """)
        
        result = db.execute(query, {
            "now": datetime.utcnow(),
            "mesa_id": mesa_id
        })
        db.commit()
        
        logger.info(f"Token invalidado para mesa: {mesa_id}")
        return result.rowcount > 0
        
    except Exception as e:
        logger.error(f"Error invalidando token para mesa {mesa_id}: {str(e)}")
        db.rollback()
        return False


def get_token_info(mesa_id: str) -> dict:
    """
    Obtiene información sobre el token actual de una mesa.
    
    Args:
        mesa_id: Identificador de la mesa
    
    Returns:
        Dict con información del token o None
    """
    try:
        db = get_db()
        
        query = text("""
            SELECT current_token, token_expires_at 
            FROM mesas 
            WHERE mesa_id = :mesa_id
        """)
        
        result = db.execute(query, {"mesa_id": mesa_id}).fetchone()
        
        if not result or not result.current_token:
            return None
        
        # Convertir fecha si es string (SQLite)
        expires_at = result.token_expires_at
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        
        return {
            "token": result.current_token,
            "expires_at": expires_at,
            "is_expired": expires_at < datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo info de token para mesa {mesa_id}: {str(e)}")
        return None


def _clear_expired_token(mesa_id: str) -> None:
    """Función interna para limpiar tokens expirados"""
    try:
        db = get_db()
        query = text("""
            UPDATE mesas 
            SET current_token = NULL, 
                token_expires_at = NULL,
                updated_at = :now
            WHERE mesa_id = :mesa_id
        """)
        db.execute(query, {"now": datetime.utcnow(), "mesa_id": mesa_id})
        db.commit()
    except Exception as e:
        logger.error(f"Error limpiando token expirado: {str(e)}")
        db.rollback()


def cleanup_expired_tokens() -> int:
    """
    Limpia todos los tokens expirados de la base de datos.
    Útil para tareas de mantenimiento periódicas.
    
    Returns:
        Número de tokens eliminados
    """
    try:
        db = get_db()
        
        query = text("""
            UPDATE mesas 
            SET current_token = NULL, 
                token_expires_at = NULL,
                updated_at = :now
            WHERE token_expires_at < :now 
              AND current_token IS NOT NULL
        """)
        
        result = db.execute(query, {"now": datetime.utcnow()})
        db.commit()
        
        count = result.rowcount
        if count > 0:
            logger.info(f"Limpiados {count} tokens expirados")
        
        return count
        
    except Exception as e:
        logger.error(f"Error limpiando tokens expirados: {str(e)}")
        db.rollback()
        return 0 