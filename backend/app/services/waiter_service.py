"""
Servicio para manejar llamadas al mozo
Contiene toda la lógica de negocio de notificaciones al mozo
"""

from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy import text
from ..db.connection import get_db
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class WaiterService:
    """Servicio para gestionar llamadas y notificaciones al mozo"""
    
    # Constantes de validación
    VALID_PAYMENT_METHODS = ['CARD', 'CASH', 'QR']
    VALID_STATUSES = ['PENDING', 'ATTENDED']
    VALID_MOTIVOS = ['pago_efectivo', 'pago_tarjeta', 'pago_qr']
    
    def __init__(self):
        """Inicializar el servicio"""
        self.logger = logger
    
    def create_waiter_call(self, data: Dict) -> Dict:
        """
        Crear una nueva llamada al mozo
        
        Args:
            data: Diccionario con mesa_id, payment_method y message opcional
            
        Returns:
            Diccionario con la llamada creada
            
        Raises:
            ValueError: Si los datos son inválidos
            Exception: Si hay error en la base de datos
        """
        try:
            # Validar campos requeridos
            self._validate_required_fields(data, ['mesa_id', 'payment_method'])
            
            mesa_id = data['mesa_id']
            payment_method = data['payment_method']
            
            # Validar método de pago
            if payment_method not in self.VALID_PAYMENT_METHODS:
                raise ValueError(
                    f"payment_method debe ser uno de: {', '.join(self.VALID_PAYMENT_METHODS)}"
                )
            
            db = get_db()
            
            # Crear nueva llamada en la base de datos
            query = text("""
                INSERT INTO waiter_calls (mesa_id, payment_method, status)
                VALUES (:mesa_id, :payment_method, 'PENDING')
                RETURNING id, mesa_id, payment_method, status, created_at
            """)
            
            result = db.execute(query, {
                'mesa_id': mesa_id,
                'payment_method': payment_method
            })
            
            new_call = dict(result.fetchone()._mapping)
            db.commit()
            
            logger.info(
                f"Nueva llamada al mozo creada - mesa_id: {mesa_id}, "
                f"payment_method: {payment_method}"
            )
            
            return new_call
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error de base de datos al crear llamada: {str(e)}")
            db.rollback()
            raise Exception("Error en la base de datos")
    
    def get_all_calls(self, status: Optional[str] = None) -> List[Dict]:
        """
        Obtener todas las llamadas al mozo, opcionalmente filtradas por estado
        
        Args:
            status: Estado opcional para filtrar (PENDING, ATTENDED)
            
        Returns:
            Lista de llamadas
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            
            if status:
                # Validar que el estado sea válido
                if status not in self.VALID_STATUSES:
                    raise ValueError(
                        f"status debe ser uno de: {', '.join(self.VALID_STATUSES)}"
                    )
                
                query = text("""
                    SELECT * FROM waiter_calls 
                    WHERE status = :status 
                    ORDER BY created_at DESC
                """)
                result = db.execute(query, {'status': status})
            else:
                query = text("""
                    SELECT * FROM waiter_calls 
                    ORDER BY created_at DESC
                """)
                result = db.execute(query)
            
            calls = [dict(row._mapping) for row in result]
            
            logger.info(f"Obtenidas {len(calls)} llamadas al mozo (status: {status or 'ALL'})")
            
            return calls
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error de base de datos al obtener llamadas: {str(e)}")
            raise Exception("Error en la base de datos")
    
    def update_call_status(self, call_id: str, new_status: str) -> Optional[Dict]:
        """
        Actualizar el estado de una llamada al mozo
        
        Args:
            call_id: ID de la llamada
            new_status: Nuevo estado (PENDING, ATTENDED)
            
        Returns:
            Llamada actualizada o None si no existe
            
        Raises:
            ValueError: Si el estado es inválido
            Exception: Si hay error en la base de datos
        """
        try:
            # Validar estado
            if new_status not in self.VALID_STATUSES:
                raise ValueError(
                    f"Status debe ser uno de: {', '.join(self.VALID_STATUSES)}"
                )
            
            db = get_db()
            
            # Actualizar estado
            query = text("""
                UPDATE waiter_calls 
                SET status = :status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :call_id
                RETURNING *
            """)
            
            result = db.execute(query, {
                'status': new_status,
                'call_id': call_id
            })
            
            updated_call = result.fetchone()
            
            if not updated_call:
                logger.warning(f"Llamada no encontrada: {call_id}")
                return None
            
            db.commit()
            
            logger.info(
                f"Estado de llamada actualizado - call_id: {call_id}, "
                f"status: {new_status}"
            )
            
            return dict(updated_call._mapping)
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error de base de datos al actualizar llamada: {str(e)}")
            db.rollback()
            raise Exception("Error en la base de datos")
    
    def delete_call(self, call_id: str) -> Optional[Dict]:
        """
        Eliminar una llamada al mozo
        
        Args:
            call_id: ID de la llamada a eliminar
            
        Returns:
            Llamada eliminada o None si no existe
            
        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()
            
            # Eliminar la llamada
            query = text("""
                DELETE FROM waiter_calls 
                WHERE id = :call_id
                RETURNING *
            """)
            
            result = db.execute(query, {'call_id': call_id})
            deleted_call = result.fetchone()
            
            if not deleted_call:
                logger.warning(f"Llamada no encontrada para eliminar: {call_id}")
                return None
            
            db.commit()
            
            logger.info(f"Llamada al mozo eliminada - call_id: {call_id}")
            
            return dict(deleted_call._mapping)
            
        except Exception as e:
            logger.error(f"Error de base de datos al eliminar llamada: {str(e)}")
            db.rollback()
            raise Exception("Error en la base de datos")
    
    def create_notification(self, data: Dict) -> Dict:
        """
        Crear una notificación al mozo con motivo específico
        
        Args:
            data: Diccionario con mesa_id, motivo, usuario_id y message opcionales
            
        Returns:
            Diccionario con la notificación creada
            
        Raises:
            ValueError: Si los datos son inválidos
            Exception: Si hay error en la base de datos
        """
        try:
            # Validar campos requeridos
            self._validate_required_fields(data, ['mesa_id', 'motivo'])
            
            mesa_id = data['mesa_id']
            motivo = data['motivo']
            usuario_id = data.get('usuario_id', '')
            message = data.get('message', '')
            
            # Validar motivo
            if motivo not in self.VALID_MOTIVOS:
                raise ValueError(
                    f"motivo debe ser uno de: {', '.join(self.VALID_MOTIVOS)}"
                )
            
            db = get_db()
            
            # Crear nueva notificación en la base de datos
            query = text("""
                INSERT INTO waiter_calls (mesa_id, payment_method, status, usuario_id, message, motivo)
                VALUES (:mesa_id, :payment_method, 'PENDING', :usuario_id, :message, :motivo)
                RETURNING id, mesa_id, payment_method, status, usuario_id, message, motivo, created_at, updated_at
            """)
            
            # Mapear motivo a payment_method para compatibilidad
            payment_method_map = {
                'pago_efectivo': 'CASH',
                'pago_tarjeta': 'CARD',
                'pago_qr': 'QR'
            }
            
            result = db.execute(query, {
                'mesa_id': mesa_id,
                'payment_method': payment_method_map.get(motivo, 'CASH'),
                'usuario_id': usuario_id,
                'message': message,
                'motivo': motivo
            })
            
            new_notification = dict(result.fetchone()._mapping)
            db.commit()
            
            logger.info(
                f"Nueva notificación al mozo creada - mesa_id: {mesa_id}, "
                f"motivo: {motivo}"
            )
            
            return new_notification
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error de base de datos al crear notificación: {str(e)}")
            db.rollback()
            raise Exception("Error en la base de datos")
    
    # Métodos privados de validación
    
    @staticmethod
    def _validate_required_fields(data: Dict, fields: List[str]) -> None:
        """Validar que los campos requeridos estén presentes"""
        for field in fields:
            if field not in data or data[field] is None or data[field] == "":
                raise ValueError(f"Campo requerido: {field}")


# Singleton del servicio
waiter_service = WaiterService()
