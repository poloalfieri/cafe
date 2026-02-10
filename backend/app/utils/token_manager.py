"""
Token Manager - Gestión segura de tokens en Supabase
"""
import secrets
import logging
from datetime import datetime, timedelta, timezone

from ..db.supabase_client import supabase

logger = logging.getLogger(__name__)


def generate_token(mesa_id: str, branch_id: str, expiry_minutes: int = 10) -> str:
    """
    Genera un token seguro y lo almacena en Supabase.
    """
    try:
        token = secrets.token_urlsafe(32)
        expiry = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
        now_iso = _now_iso()

        response = (
            supabase.table("mesas")
            .update(
                {
                    "token": token,
                    "token_expires_at": expiry.isoformat().replace("+00:00", "Z"),
                    "updated_at": now_iso,
                }
            )
            .eq("mesa_id", mesa_id)
            .eq("branch_id", branch_id)
            .execute()
        )

        if not response.data:
            raise ValueError(f"Mesa {mesa_id} no existe en la base de datos")

        logger.info(f"Token generado para mesa {mesa_id}, expira en {expiry_minutes} minutos")
        return token

    except Exception as e:
        logger.error(f"Error generando token para mesa {mesa_id}: {str(e)}")
        raise


def validate_token(mesa_id: str, branch_id: str, token: str) -> bool:
    """
    Valida un token contra Supabase.
    """
    try:
        response = (
            supabase.table("mesas")
            .select("token, token_expires_at, is_active")
            .eq("mesa_id", mesa_id)
            .eq("branch_id", branch_id)
            .execute()
        )

        data = response.data or []
        if not data:
            logger.warning(f"Intento de validar token para mesa inexistente: {mesa_id}")
            return False

        mesa = data[0]

        if not mesa.get("is_active", False):
            logger.warning(f"Intento de usar token en mesa inactiva: {mesa_id}")
            return False

        current_token = mesa.get("token")
        if not current_token:
            logger.warning(f"No hay token generado para mesa: {mesa_id}")
            return False

        if not secrets.compare_digest(current_token, token):
            logger.warning(f"Token inválido para mesa: {mesa_id}")
            return False

        expires_at = mesa.get("token_expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))

        if expires_at < datetime.now(timezone.utc):
            logger.warning(f"Token expirado para mesa: {mesa_id}")
            _clear_expired_token(mesa_id, branch_id)
            return False

        logger.info(f"Token validado exitosamente para mesa: {mesa_id}")
        return True

    except Exception as e:
        logger.error(f"Error validando token para mesa {mesa_id}: {str(e)}")
        return False


def renew_token(mesa_id: str, branch_id: str, expiry_minutes: int = 10) -> str:
    logger.info(f"Renovando token para mesa: {mesa_id}")
    return generate_token(mesa_id, branch_id, expiry_minutes)


def invalidate_token(mesa_id: str, branch_id: str) -> bool:
    """
    Invalida el token actual de una mesa.
    """
    try:
        now_iso = _now_iso()
        response = (
            supabase.table("mesas")
            .update(
                {
                    "token": secrets.token_urlsafe(32),
                    "token_expires_at": now_iso,
                    "updated_at": now_iso,
                }
            )
            .eq("mesa_id", mesa_id)
            .eq("branch_id", branch_id)
            .execute()
        )

        logger.info(f"Token invalidado para mesa: {mesa_id}")
        return bool(response.data)

    except Exception as e:
        logger.error(f"Error invalidando token para mesa {mesa_id}: {str(e)}")
        return False


def get_token_info(mesa_id: str, branch_id: str) -> dict:
    """
    Obtiene información sobre el token actual de una mesa.
    """
    try:
        response = (
            supabase.table("mesas")
            .select("token, token_expires_at")
            .eq("mesa_id", mesa_id)
            .eq("branch_id", branch_id)
            .execute()
        )
        data = response.data or []

        if not data or not data[0].get("token"):
            return None

        mesa = data[0]
        expires_at = mesa.get("token_expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))

        return {
            "token": mesa.get("token"),
            "expires_at": expires_at,
            "is_expired": expires_at < datetime.now(timezone.utc),
        }

    except Exception as e:
        logger.error(f"Error obteniendo info de token para mesa {mesa_id}: {str(e)}")
        return None


def _clear_expired_token(mesa_id: str, branch_id: str) -> None:
    """Función interna para limpiar tokens expirados"""
    try:
        now_iso = _now_iso()
        supabase.table("mesas").update(
            {"token_expires_at": now_iso, "updated_at": now_iso}
        ).eq("mesa_id", mesa_id).eq("branch_id", branch_id).execute()
    except Exception as e:
        logger.error(f"Error limpiando token expirado: {str(e)}")


def cleanup_expired_tokens() -> int:
    """
    Limpia todos los tokens expirados de la base de datos.
    """
    try:
        now_iso = _now_iso()
        response = (
            supabase.table("mesas")
            .update({"token_expires_at": now_iso, "updated_at": now_iso})
            .lt("token_expires_at", now_iso)
            .execute()
        )

        count = len(response.data or [])
        if count > 0:
            logger.info(f"Limpiados {count} tokens expirados")

        return count

    except Exception as e:
        logger.error(f"Error limpiando tokens expirados: {str(e)}")
        return 0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
