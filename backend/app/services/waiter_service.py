"""
Servicio para manejar llamadas al mozo
Contiene toda la logica de negocio de notificaciones al mozo
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
import threading
import uuid
from ..utils.logger import setup_logger
from ..services.order_service import order_service
from ..utils.token_manager import validate_token

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
        self._calls: Dict[str, Dict] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def create_waiter_call(
        self,
        data: Dict,
        mesa_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        token: Optional[str] = None,
        skip_token_validation: bool = False,
    ) -> Tuple[Dict, bool]:
        """
        Crear una nueva llamada al mozo.
        Punto unico de creacion usado por /waiter/calls.

        Args:
            data: Diccionario con mesa_id, payment_method (o motivo),
                  message y usuario_id opcionales.
            mesa_id: Mesa a validar (si no viene en data).
            token: Token de mesa a validar.

        Returns:
            Tupla con (llamada, already_pending)

        Raises:
            ValueError: Si los datos son invalidos
            Exception: Si hay error interno
        """
        try:
            # Validar campos requeridos
            self._validate_required_fields(data, ['mesa_id'])

            mesa_id = mesa_id or data.get('mesa_id')
            branch_id = branch_id or data.get('branch_id')
            if not mesa_id:
                raise ValueError("mesa_id requerido")
            if not branch_id:
                raise ValueError("branch_id requerido")
            if not skip_token_validation:
                if not token:
                    raise PermissionError("Token de mesa requerido")
                if not validate_token(mesa_id, branch_id, token):
                    raise PermissionError("Token de mesa invalido o expirado")
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
            with self._lock:
                # Evitar duplicados: si ya existe una llamada PENDING para la mesa, devolverla
                for call in self._calls.values():
                    if call.get('mesa_id') == mesa_id and call.get('status') == 'PENDING':
                        logger.info(
                            f"Llamada PENDING ya existente para mesa_id: {mesa_id}. "
                            "No se crea un duplicado."
                        )
                        return dict(call), True

                call_id = str(uuid.uuid4())
                now = self._now_iso()
                new_call = {
                    'id': call_id,
                    'mesa_id': mesa_id,
                    'branch_id': branch_id,
                    'payment_method': payment_method,
                    'status': 'PENDING',
                    'usuario_id': usuario_id,
                    'message': message,
                    'motivo': motivo or '',
                    'created_at': now,
                    'updated_at': now,
                }
                self._calls[call_id] = new_call

            logger.info(
                f"Nueva llamada al mozo creada - mesa_id: {mesa_id}, "
                f"payment_method: {payment_method}"
            )

            return dict(new_call), False

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al crear llamada: {str(e)}")
            raise Exception("Error interno del servidor")

    def update_call_status_with_effects(self, call_id: str, new_status: str) -> Optional[Dict]:
        updated = self.update_call_status_by_id(call_id, new_status)
        if updated and new_status == "COMPLETED":
            try:
                mesa_id = updated.get("mesa_id")
                branch_id = updated.get("branch_id")
                if mesa_id:
                    order_service.mark_latest_order_paid_for_mesa(mesa_id, branch_id=branch_id)
            except Exception:
                pass
        return updated

    def get_all_calls(self, status: Optional[str] = None) -> List[Dict]:
        """
        Obtener todas las llamadas al mozo, opcionalmente filtradas por estado

        Args:
            status: Estado opcional para filtrar (PENDING, COMPLETED, CANCELLED)

        Returns:
            Lista de llamadas

        Raises:
            Exception: Si hay error interno
        """
        try:
            if status:
                if status not in self.VALID_STATUSES:
                    raise ValueError(
                        f"status debe ser uno de: {', '.join(self.VALID_STATUSES)}"
                    )

            with self._lock:
                calls = list(self._calls.values())

            if status:
                calls = [call for call in calls if call.get('status') == status]

            calls.sort(key=lambda call: call.get('created_at', ''), reverse=True)

            logger.info(f"Obtenidas {len(calls)} llamadas al mozo (status: {status or 'ALL'})")

            return [dict(call) for call in calls]

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al obtener llamadas: {str(e)}")
            raise Exception("Error interno del servidor")

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
            Exception: Si hay error interno
        """
        try:
            updated_call = self.update_call_status_by_id(call_id, new_status)
            return updated_call

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al actualizar llamada: {str(e)}")
            raise Exception("Error interno del servidor")

    def update_call_status_by_id(self, call_id: str, new_status: str) -> Optional[Dict]:
        if new_status not in self.VALID_STATUSES:
            raise ValueError(
                f"Status debe ser uno de: {', '.join(self.VALID_STATUSES)}"
            )

        with self._lock:
            current = self._calls.get(call_id)
            if not current:
                logger.warning(f"Llamada no encontrada: {call_id}")
                return None

            current_status = current.get('status')

            # Validar transicion
            allowed = self.ALLOWED_TRANSITIONS.get(current_status, [])
            if new_status not in allowed:
                raise ValueError(
                    f"Transicion no permitida: {current_status} -> {new_status}. "
                    f"Transiciones validas desde {current_status}: {allowed or 'ninguna'}"
                )

            current['status'] = new_status
            current['updated_at'] = self._now_iso()
            updated_call = dict(current)

        logger.info(
            f"Estado de llamada actualizado - call_id: {call_id}, "
            f"{current_status} -> {new_status}"
        )

        return updated_call

    def delete_call(self, call_id: str) -> Optional[Dict]:
        """
        Soft-delete: marca la llamada como CANCELLED en vez de borrar la fila.

        Args:
            call_id: ID de la llamada

        Returns:
            Llamada cancelada o None si no existe

        Raises:
            Exception: Si hay error interno
        """
        try:
            with self._lock:
                existing = self._calls.get(call_id)

                if not existing:
                    logger.warning(f"Llamada no encontrada para eliminar: {call_id}")
                    return None

                # Si ya esta cancelada o completada, devolver sin cambios
                if existing.get('status') in ('CANCELLED', 'COMPLETED'):
                    return dict(existing)

                existing['status'] = 'CANCELLED'
                existing['updated_at'] = self._now_iso()
                deleted_call = dict(existing)

            logger.info(f"Llamada al mozo cancelada (soft delete) - call_id: {call_id}")

            return deleted_call

        except Exception as e:
            logger.error(f"Error al cancelar llamada: {str(e)}")
            raise Exception("Error interno del servidor")

    # Metodos privados de validacion

    @staticmethod
    def _validate_required_fields(data: Dict, fields: List[str]) -> None:
        """Validar que los campos requeridos esten presentes"""
        for field in fields:
            if field not in data or data[field] is None or data[field] == "":
                raise ValueError(f"Campo requerido: {field}")


# Singleton del servicio
waiter_service = WaiterService()
