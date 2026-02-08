"""
Servicio para manejar mesas y sus tokens
Contiene toda la lógica de negocio de gestión de mesas (Supabase)
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta, timezone
import secrets

from ..db.supabase_client import supabase
from ..utils.logger import setup_logger
from ..utils.token_manager import generate_token, validate_token, renew_token

logger = setup_logger(__name__)


class MesaService:
    """Servicio para gestionar mesas y sus tokens de acceso"""

    def __init__(self):
        self.logger = logger

    def get_all_mesas(self) -> List[Dict]:
        """
        Obtener todas las mesas
        """
        try:
            response = supabase.table("mesas").select("*").execute()
            mesas = response.data or []

            def mesa_sort_key(mesa: Dict):
                value = mesa.get("mesa_id", "")
                try:
                    return int(value)
                except Exception:
                    return value

            mesas.sort(key=mesa_sort_key)

            logger.info(f"Obtenidas {len(mesas)} mesas")
            return mesas

        except Exception as e:
            logger.error(f"Error al obtener mesas: {str(e)}")
            raise Exception("Error en la base de datos")

    def get_mesa_by_id(self, mesa_id: str) -> Optional[Dict]:
        """
        Obtener una mesa por su ID
        """
        try:
            response = (
                supabase.table("mesas")
                .select("*")
                .eq("mesa_id", mesa_id)
                .execute()
            )
            data = response.data or []
            if not data:
                logger.warning(f"Mesa no encontrada: {mesa_id}")
                return None
            return data[0]

        except Exception as e:
            logger.error(f"Error al obtener mesa {mesa_id}: {str(e)}")
            raise Exception("Error en la base de datos")

    def create_mesa(self, mesa_id: str, is_active: bool = True) -> Dict:
        """
        Crear una nueva mesa
        """
        try:
            existing = self.get_mesa_by_id(mesa_id)
            if existing:
                raise ValueError(f"La mesa {mesa_id} ya existe")

            # Insert inicial para cumplir NOT NULL de token y token_expires_at
            placeholder_token = secrets.token_urlsafe(32)
            placeholder_expires = datetime.now(timezone.utc) + timedelta(minutes=30)

            insert_data = {
                "mesa_id": mesa_id,
                "is_active": is_active,
                "token": placeholder_token,
                "token_expires_at": placeholder_expires.isoformat().replace("+00:00", "Z"),
            }

            response = supabase.table("mesas").insert(insert_data).execute()
            if not response.data:
                raise Exception("No se pudo crear la mesa")

            # Generar el token real usando la misma función centralizada
            generate_token(mesa_id, expiry_minutes=30)
            new_mesa = self.get_mesa_by_id(mesa_id) or response.data[0]

            logger.info(f"Mesa {mesa_id} creada")
            return new_mesa

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al crear mesa: {str(e)}")
            raise Exception("Error en la base de datos")

    def update_mesa_status(self, mesa_id: str, is_active: bool) -> Optional[Dict]:
        """
        Actualizar el estado de una mesa (activa/inactiva)
        """
        try:
            update_data = {
                "is_active": is_active,
                "updated_at": self._now_iso(),
            }

            response = (
                supabase.table("mesas")
                .update(update_data)
                .eq("mesa_id", mesa_id)
                .execute()
            )

            if not response.data:
                logger.warning(f"Mesa no encontrada para actualizar: {mesa_id}")
                return None

            updated_mesa = response.data[0]
            logger.info(f"Mesa {mesa_id} marcada como {'activa' if is_active else 'inactiva'}")
            return updated_mesa

        except Exception as e:
            logger.error(f"Error al actualizar mesa: {str(e)}")
            raise Exception("Error en la base de datos")

    def generate_token_for_mesa(self, mesa_id: str, expiry_minutes: int = 30) -> Dict:
        """
        Generar un nuevo token para una mesa
        """
        try:
            mesa = self.get_mesa_by_id(mesa_id)
            if not mesa:
                raise ValueError(f"La mesa {mesa_id} no existe")

            if not mesa.get("is_active", False):
                raise ValueError(f"La mesa {mesa_id} no está activa")

            new_token = generate_token(mesa_id, expiry_minutes=expiry_minutes)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)

            response = (
                supabase.table("mesas")
                .update(
                    {
                        "token": new_token,
                        "token_expires_at": expires_at.isoformat().replace("+00:00", "Z"),
                        "updated_at": self._now_iso(),
                    }
                )
                .eq("mesa_id", mesa_id)
                .execute()
            )

            if not response.data:
                raise Exception("No se pudo actualizar el token de mesa")

            logger.info(f"Token generado para mesa {mesa_id}, expira en {expiry_minutes} minutos")

            return {
                "mesa_id": mesa_id,
                "token": new_token,
                "expires_in_minutes": expiry_minutes,
                "expires_at": expires_at.isoformat(),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al generar token para mesa {mesa_id}: {str(e)}")
            raise Exception("Error al generar token")

    def validate_mesa_token(self, mesa_id: str, token: str) -> Dict:
        """
        Validar un token de mesa
        """
        try:
            if not token:
                raise ValueError("Token requerido")

            is_valid = validate_token(mesa_id, token)

            mesa = self.get_mesa_by_id(mesa_id)
            if mesa and mesa.get("token") == token:
                expires_at = mesa.get("token_expires_at")
                if expires_at:
                    if isinstance(expires_at, str):
                        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))

                    if datetime.now(timezone.utc) > expires_at:
                        is_valid = False
                        logger.warning(f"Token expirado para mesa {mesa_id}")

            logger.info(f"Token validado para mesa {mesa_id}: {'válido' if is_valid else 'inválido'}")

            return {
                "mesa_id": mesa_id,
                "token": token,
                "is_valid": is_valid,
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al validar token para mesa {mesa_id}: {str(e)}")
            raise Exception("Error al validar token")

    def renew_mesa_token(self, mesa_id: str, expiry_minutes: int = 30) -> Dict:
        """
        Renovar el token de una mesa
        """
        try:
            mesa = self.get_mesa_by_id(mesa_id)
            if not mesa:
                raise ValueError(f"La mesa {mesa_id} no existe")

            new_token = renew_token(mesa_id, expiry_minutes=expiry_minutes)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)

            response = (
                supabase.table("mesas")
                .update(
                    {
                        "token": new_token,
                        "token_expires_at": expires_at.isoformat().replace("+00:00", "Z"),
                        "updated_at": self._now_iso(),
                    }
                )
                .eq("mesa_id", mesa_id)
                .execute()
            )

            if not response.data:
                raise Exception("No se pudo actualizar el token de mesa")

            logger.info(f"Token renovado para mesa {mesa_id}")

            return {
                "mesa_id": mesa_id,
                "token": new_token,
                "expires_in_minutes": expiry_minutes,
                "expires_at": expires_at.isoformat(),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al renovar token para mesa {mesa_id}: {str(e)}")
            raise Exception("Error al renovar token")

    def get_or_create_session(self, mesa_id: str, expiry_minutes: int = 30) -> Dict:
        """
        Obtener el token actual de una mesa si es válido; si no, generar uno nuevo.
        """
        try:
            mesa = self.get_mesa_by_id(mesa_id)
            if not mesa:
                raise ValueError(f"La mesa {mesa_id} no existe")

            if not mesa.get("is_active", False):
                raise ValueError(f"La mesa {mesa_id} no está activa")

            current_token = mesa.get("token")
            expires_at = mesa.get("token_expires_at")

            if current_token and expires_at:
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) <= expires_at:
                    return {
                        "mesa_id": mesa_id,
                        "token": current_token,
                        "expires_in_minutes": int(
                            (expires_at - datetime.now(timezone.utc)).total_seconds() // 60
                        ),
                        "expires_at": expires_at.isoformat(),
                    }

            return self.generate_token_for_mesa(mesa_id, expiry_minutes=expiry_minutes)

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error obteniendo sesión para mesa {mesa_id}: {str(e)}")
            raise Exception("Error al obtener sesión de mesa")

    def initialize_default_mesas(self, count: int = 10) -> List[Dict]:
        """
        Inicializar mesas por defecto (útil para setup inicial)
        """
        created_mesas = []

        for i in range(1, count + 1):
            mesa_id = str(i)
            try:
                existing = self.get_mesa_by_id(mesa_id)
                if not existing:
                    mesa = self.create_mesa(mesa_id, is_active=True)
                    created_mesas.append(mesa)
                    logger.info(f"Mesa {mesa_id} inicializada")
                else:
                    created_mesas.append(existing)
            except Exception as e:
                logger.error(f"Error inicializando mesa {mesa_id}: {str(e)}")

        logger.info(f"Inicializadas {len(created_mesas)} mesas")
        return created_mesas

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


mesa_service = MesaService()
