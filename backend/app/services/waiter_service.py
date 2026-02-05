"""
Servicio para manejar llamadas al mozo
Contiene toda la logica de negocio de notificaciones al mozo
"""

from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy import text
from ..db.connection import get_db
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class WaiterService:
    """Servicio para gestionar llamadas y notificaciones al mozo"""

    # Constantes de validacion
    VALID_PAYMENT_METHODS = ['CARD', 'CASH', 'QR']
    VALID_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED']
    VALID_MOTIVOS = ['pago_efectivo', 'pago_tarjeta', 'pago_qr']

    # Mapeo de motivo a payment_method
    MOTIVO_TO_PAYMENT_METHOD = {
        'pago_efectivo': 'CASH',
        'pago_tarjeta': 'CARD',
        'pago_qr': 'QR',
    }

    # Transiciones de estado permitidas
    ALLOWED_TRANSITIONS = {
        'PENDING': ['COMPLETED', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': [],
    }

    def __init__(self):
        """Inicializar el servicio"""
        self.logger = logger

    def create_waiter_call(self, data: Dict) -> Dict:
        """
        Crear una nueva llamada al mozo.
        Punto unico de creacion usado tanto por /waiter/calls como
        por /waiter/notificar-mozo.

        Args:
            data: Diccionario con mesa_id, payment_method (o motivo),
                  message y usuario_id opcionales.

        Returns:
            Diccionario con la llamada creada

        Raises:
            ValueError: Si los datos son invalidos
            Exception: Si hay error en la base de datos
        """
        try:
            # Validar campos requeridos
            self._validate_required_fields(data, ['mesa_id'])

            mesa_id = data['mesa_id']
            motivo = data.get('motivo')
            payment_method = data.get('payment_method')

            # Si llega motivo en vez de payment_method, mapear
            if motivo and not payment_method:
                if motivo not in self.VALID_MOTIVOS:
                    raise ValueError(
                        f"motivo debe ser uno de: {', '.join(self.VALID_MOTIVOS)}"
                    )
                payment_method = self.MOTIVO_TO_PAYMENT_METHOD[motivo]

            if not payment_method:
                raise ValueError("payment_method es requerido")

            # Validar metodo de pago
            if payment_method not in self.VALID_PAYMENT_METHODS:
                raise ValueError(
                    f"payment_method debe ser uno de: {', '.join(self.VALID_PAYMENT_METHODS)}"
                )

            usuario_id = data.get('usuario_id', '')
            message = data.get('message', '')

            db = get_db()

            query = text("""
                INSERT INTO waiter_calls
                    (mesa_id, payment_method, status, usuario_id, message, motivo)
                VALUES
                    (:mesa_id, :payment_method, 'PENDING', :usuario_id, :message, :motivo)
                RETURNING id, mesa_id, payment_method, status,
                          usuario_id, message, motivo, created_at, updated_at
            """)

            result = db.execute(query, {
                'mesa_id': mesa_id,
                'payment_method': payment_method,
                'usuario_id': usuario_id,
                'message': message,
                'motivo': motivo or '',
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
            status: Estado opcional para filtrar (PENDING, COMPLETED, CANCELLED)

        Returns:
            Lista de llamadas

        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()

            if status:
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
        Actualizar el estado de una llamada al mozo con validacion de
        transiciones permitidas:
            PENDING -> COMPLETED | CANCELLED
            COMPLETED -> (ninguna)
            CANCELLED -> (ninguna)

        Args:
            call_id: ID de la llamada
            new_status: Nuevo estado (PENDING, COMPLETED, CANCELLED)

        Returns:
            Llamada actualizada o None si no existe

        Raises:
            ValueError: Si el estado o la transicion son invalidos
            Exception: Si hay error en la base de datos
        """
        try:
            if new_status not in self.VALID_STATUSES:
                raise ValueError(
                    f"Status debe ser uno de: {', '.join(self.VALID_STATUSES)}"
                )

            db = get_db()

            # Obtener estado actual
            current_query = text("""
                SELECT status FROM waiter_calls WHERE id = :call_id
            """)
            current = db.execute(current_query, {'call_id': call_id}).fetchone()

            if not current:
                logger.warning(f"Llamada no encontrada: {call_id}")
                return None

            current_status = current.status

            # Validar transicion
            allowed = self.ALLOWED_TRANSITIONS.get(current_status, [])
            if new_status not in allowed:
                raise ValueError(
                    f"Transicion no permitida: {current_status} -> {new_status}. "
                    f"Transiciones validas desde {current_status}: {allowed or 'ninguna'}"
                )

            # Actualizar estado (updated_at se actualiza via trigger en DB)
            query = text("""
                UPDATE waiter_calls
                SET status = :status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :call_id
                RETURNING *
            """)

            result = db.execute(query, {
                'status': new_status,
                'call_id': call_id,
            })

            updated_call = result.fetchone()

            if not updated_call:
                logger.warning(f"Llamada no encontrada al actualizar: {call_id}")
                return None

            db.commit()

            logger.info(
                f"Estado de llamada actualizado - call_id: {call_id}, "
                f"{current_status} -> {new_status}"
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
        Soft-delete: marca la llamada como CANCELLED en vez de borrar la fila.

        Args:
            call_id: ID de la llamada

        Returns:
            Llamada cancelada o None si no existe

        Raises:
            Exception: Si hay error en la base de datos
        """
        try:
            db = get_db()

            # Verificar que exista
            check_query = text("""
                SELECT status FROM waiter_calls WHERE id = :call_id
            """)
            existing = db.execute(check_query, {'call_id': call_id}).fetchone()

            if not existing:
                logger.warning(f"Llamada no encontrada para eliminar: {call_id}")
                return None

            # Si ya esta cancelada o completada, devolver sin cambios
            if existing.status in ('CANCELLED', 'COMPLETED'):
                select_query = text("""
                    SELECT * FROM waiter_calls WHERE id = :call_id
                """)
                row = db.execute(select_query, {'call_id': call_id}).fetchone()
                return dict(row._mapping)

            # Soft delete: cambiar a CANCELLED
            query = text("""
                UPDATE waiter_calls
                SET status = 'CANCELLED',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :call_id
                RETURNING *
            """)

            result = db.execute(query, {'call_id': call_id})
            deleted_call = result.fetchone()
            db.commit()

            logger.info(f"Llamada al mozo cancelada (soft delete) - call_id: {call_id}")

            return dict(deleted_call._mapping)

        except Exception as e:
            logger.error(f"Error de base de datos al cancelar llamada: {str(e)}")
            db.rollback()
            raise Exception("Error en la base de datos")

    def create_notification(self, data: Dict) -> Dict:
        """
        Crear una notificacion al mozo con motivo especifico.
        Delega a create_waiter_call para usar un unico punto de creacion.

        Args:
            data: Diccionario con mesa_id, motivo, usuario_id y message opcionales

        Returns:
            Diccionario con la llamada creada

        Raises:
            ValueError: Si los datos son invalidos
            Exception: Si hay error en la base de datos
        """
        return self.create_waiter_call(data)

    # Metodos privados de validacion

    @staticmethod
    def _validate_required_fields(data: Dict, fields: List[str]) -> None:
        """Validar que los campos requeridos esten presentes"""
        for field in fields:
            if field not in data or data[field] is None or data[field] == "":
                raise ValueError(f"Campo requerido: {field}")


# Singleton del servicio
waiter_service = WaiterService()
