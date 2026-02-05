"""
Servicio para manejar mesas y sus tokens
Contiene toda la lógica de negocio de gestión de mesas
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy import text
from ..db.connection import get_db
from ..utils.logger import setup_logger
from ..utils.token_manager import generate_token, validate_token, renew_token

logger = setup_logger(__name__)


class MesaService:
    """Servicio para gestionar mesas y sus tokens de acceso"""
    
    def __init__(self):
        """Inicializar el servicio"""
        self.logger = logger
    
    def get_all_mesas(self) -> List[Dict]:
        """
        Obtener todas las mesas
        
        Returns:
            Lista de mesas con su información
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            
            query = text("""
                SELECT id, mesa_id, is_active, current_token, 
                       token_expires_at, created_at, updated_at
                FROM mesas 
                ORDER BY CAST(mesa_id AS INTEGER)
            """)
            
            result = db.execute(query)
            mesas = [dict(row._mapping) for row in result]
            
            logger.info(f"Obtenidas {len(mesas)} mesas")
            
            return mesas
            
        except Exception as e:
            logger.error(f"Error de base de datos al obtener mesas: {str(e)}")
            raise Exception("Error en la base de datos")
    
    def get_mesa_by_id(self, mesa_id: str) -> Optional[Dict]:
        """
        Obtener una mesa por su ID
        
        Args:
            mesa_id: ID de la mesa
            
        Returns:
            Mesa encontrada o None si no existe
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            
            query = text("""
                SELECT id, mesa_id, is_active, current_token, 
                       token_expires_at, created_at, updated_at
                FROM mesas 
                WHERE mesa_id = :mesa_id
            """)
            
            result = db.execute(query, {'mesa_id': mesa_id})
            mesa = result.fetchone()
            
            if not mesa:
                logger.warning(f"Mesa no encontrada: {mesa_id}")
                return None
            
            logger.info(f"Mesa {mesa_id} obtenida")
            
            return dict(mesa._mapping)
            
        except Exception as e:
            logger.error(f"Error de base de datos al obtener mesa {mesa_id}: {str(e)}")
            raise Exception("Error en la base de datos")
    
    def create_mesa(self, mesa_id: str, is_active: bool = True) -> Dict:
        """
        Crear una nueva mesa
        
        Args:
            mesa_id: ID de la mesa
            is_active: Si la mesa está activa (default: True)
            
        Returns:
            Mesa creada
            
        Raises:
            ValueError: Si la mesa ya existe
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            
            # Verificar si ya existe
            existing = self.get_mesa_by_id(mesa_id)
            if existing:
                raise ValueError(f"La mesa {mesa_id} ya existe")
            
            query = text("""
                INSERT INTO mesas (mesa_id, is_active)
                VALUES (:mesa_id, :is_active)
                RETURNING id, mesa_id, is_active, current_token, 
                          token_expires_at, created_at, updated_at
            """)
            
            result = db.execute(query, {
                'mesa_id': mesa_id,
                'is_active': is_active
            })
            
            new_mesa = dict(result.fetchone()._mapping)
            db.commit()
            
            logger.info(f"Mesa {mesa_id} creada")
            
            return new_mesa
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error de base de datos al crear mesa: {str(e)}")
            db.rollback()
            raise Exception("Error en la base de datos")
    
    def update_mesa_status(self, mesa_id: str, is_active: bool) -> Optional[Dict]:
        """
        Actualizar el estado de una mesa (activa/inactiva)
        
        Args:
            mesa_id: ID de la mesa
            is_active: Nuevo estado
            
        Returns:
            Mesa actualizada o None si no existe
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            
            query = text("""
                UPDATE mesas 
                SET is_active = :is_active,
                    updated_at = CURRENT_TIMESTAMP
                WHERE mesa_id = :mesa_id
                RETURNING id, mesa_id, is_active, current_token, 
                          token_expires_at, created_at, updated_at
            """)
            
            result = db.execute(query, {
                'mesa_id': mesa_id,
                'is_active': is_active
            })
            
            updated_mesa = result.fetchone()
            
            if not updated_mesa:
                logger.warning(f"Mesa no encontrada para actualizar: {mesa_id}")
                return None
            
            db.commit()
            
            logger.info(f"Mesa {mesa_id} marcada como {'activa' if is_active else 'inactiva'}")
            
            return dict(updated_mesa._mapping)
            
        except Exception as e:
            logger.error(f"Error de base de datos al actualizar mesa: {str(e)}")
            db.rollback()
            raise Exception("Error en la base de datos")
    
    def generate_token_for_mesa(self, mesa_id: str, expiry_minutes: int = 30) -> Dict:
        """
        Generar un nuevo token para una mesa
        
        Args:
            mesa_id: ID de la mesa
            expiry_minutes: Minutos de validez del token (default: 30)
            
        Returns:
            Diccionario con mesa_id, token y tiempo de expiración
            
        Raises:
            ValueError: Si la mesa no existe o no está activa
            Exception: Si hay error al generar el token
        """
        try:
            # Verificar que la mesa existe y está activa
            mesa = self.get_mesa_by_id(mesa_id)
            if not mesa:
                raise ValueError(f"La mesa {mesa_id} no existe")
            
            if not mesa.get('is_active', False):
                raise ValueError(f"La mesa {mesa_id} no está activa")
            
            # Generar nuevo token
            new_token = generate_token(mesa_id, expiry_minutes=expiry_minutes)
            expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
            
            # Guardar el token en la base de datos
            db = get_db()
            query = text("""
                UPDATE mesas 
                SET current_token = :token,
                    token_expires_at = :expires_at,
                    updated_at = CURRENT_TIMESTAMP
                WHERE mesa_id = :mesa_id
            """)
            
            db.execute(query, {
                'token': new_token,
                'expires_at': expires_at,
                'mesa_id': mesa_id
            })
            db.commit()
            
            logger.info(f"Token generado para mesa {mesa_id}, expira en {expiry_minutes} minutos")
            
            return {
                'mesa_id': mesa_id,
                'token': new_token,
                'expires_in_minutes': expiry_minutes,
                'expires_at': expires_at.isoformat()
            }
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al generar token para mesa {mesa_id}: {str(e)}")
            db.rollback()
            raise Exception("Error al generar token")
    
    def validate_mesa_token(self, mesa_id: str, token: str) -> Dict:
        """
        Validar un token de mesa
        
        Args:
            mesa_id: ID de la mesa
            token: Token a validar
            
        Returns:
            Diccionario con mesa_id, token y resultado de validación
            
        Raises:
            ValueError: Si el token no se proporciona
            Exception: Si hay error al validar
        """
        try:
            if not token:
                raise ValueError("Token requerido")
            
            # Validar con el token_manager
            is_valid = validate_token(mesa_id, token)
            
            # También verificar en la base de datos
            mesa = self.get_mesa_by_id(mesa_id)
            if mesa and mesa.get('current_token') == token:
                # Verificar si no ha expirado
                expires_at = mesa.get('token_expires_at')
                if expires_at:
                    if isinstance(expires_at, str):
                        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    
                    if datetime.utcnow() > expires_at:
                        is_valid = False
                        logger.warning(f"Token expirado para mesa {mesa_id}")
            
            logger.info(f"Token validado para mesa {mesa_id}: {'válido' if is_valid else 'inválido'}")
            
            return {
                'mesa_id': mesa_id,
                'token': token,
                'is_valid': is_valid
            }
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al validar token para mesa {mesa_id}: {str(e)}")
            raise Exception("Error al validar token")
    
    def renew_mesa_token(self, mesa_id: str, expiry_minutes: int = 30) -> Dict:
        """
        Renovar el token de una mesa
        
        Args:
            mesa_id: ID de la mesa
            expiry_minutes: Minutos de validez del nuevo token (default: 30)
            
        Returns:
            Diccionario con mesa_id, nuevo token y tiempo de expiración
            
        Raises:
            ValueError: Si la mesa no existe
            Exception: Si hay error al renovar el token
        """
        try:
            # Verificar que la mesa existe
            mesa = self.get_mesa_by_id(mesa_id)
            if not mesa:
                raise ValueError(f"La mesa {mesa_id} no existe")
            
            # Renovar token usando el token_manager
            new_token = renew_token(mesa_id, expiry_minutes=expiry_minutes)
            expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
            
            # Actualizar en la base de datos
            db = get_db()
            query = text("""
                UPDATE mesas 
                SET current_token = :token,
                    token_expires_at = :expires_at,
                    updated_at = CURRENT_TIMESTAMP
                WHERE mesa_id = :mesa_id
            """)
            
            db.execute(query, {
                'token': new_token,
                'expires_at': expires_at,
                'mesa_id': mesa_id
            })
            db.commit()
            
            logger.info(f"Token renovado para mesa {mesa_id}")
            
            return {
                'mesa_id': mesa_id,
                'token': new_token,
                'expires_in_minutes': expiry_minutes,
                'expires_at': expires_at.isoformat()
            }

    def get_or_create_session(self, mesa_id: str, expiry_minutes: int = 30) -> Dict:
        """
        Obtener el token actual de una mesa si es válido; si no, generar uno nuevo.
        """
        try:
            mesa = self.get_mesa_by_id(mesa_id)
            if not mesa:
                raise ValueError(f"La mesa {mesa_id} no existe")

            if not mesa.get('is_active', False):
                raise ValueError(f"La mesa {mesa_id} no está activa")

            current_token = mesa.get('current_token')
            expires_at = mesa.get('token_expires_at')

            # Si hay token y no expiró, reutilizarlo
            if current_token and expires_at:
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                if datetime.utcnow() <= expires_at:
                    return {
                        'mesa_id': mesa_id,
                        'token': current_token,
                        'expires_in_minutes': int((expires_at - datetime.utcnow()).total_seconds() // 60),
                        'expires_at': expires_at.isoformat()
                    }

            # Si no hay token válido, generar uno nuevo
            return self.generate_token_for_mesa(mesa_id, expiry_minutes=expiry_minutes)

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error obteniendo sesión para mesa {mesa_id}: {str(e)}")
            raise Exception("Error al obtener sesión de mesa")
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al renovar token para mesa {mesa_id}: {str(e)}")
            db.rollback()
            raise Exception("Error al renovar token")
    
    def initialize_default_mesas(self, count: int = 10) -> List[Dict]:
        """
        Inicializar mesas por defecto (útil para setup inicial)
        
        Args:
            count: Número de mesas a crear (default: 10)
            
        Returns:
            Lista de mesas creadas
        """
        created_mesas = []
        
        for i in range(1, count + 1):
            mesa_id = str(i)
            try:
                # Intentar obtener la mesa
                existing = self.get_mesa_by_id(mesa_id)
                if not existing:
                    # Crear si no existe
                    mesa = self.create_mesa(mesa_id, is_active=True)
                    created_mesas.append(mesa)
                    logger.info(f"Mesa {mesa_id} inicializada")
                else:
                    created_mesas.append(existing)
            except Exception as e:
                logger.error(f"Error inicializando mesa {mesa_id}: {str(e)}")
        
        logger.info(f"Inicializadas {len(created_mesas)} mesas")
        return created_mesas


# Singleton del servicio
mesa_service = MesaService()
