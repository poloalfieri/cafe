"""
Servicio de Pedidos - Lógica de negocio para órdenes (Supabase)
"""
from typing import List, Dict, Optional, Union
from datetime import datetime, timezone
import uuid

from ..db.supabase_client import supabase
from ..db.models import OrderStatus
from ..utils.token_manager import validate_token, renew_token, invalidate_token
from ..utils.logger import setup_logger
from ..utils.retry import execute_with_retry

logger = setup_logger(__name__)


class OrderService:
    """Servicio para manejar operaciones de pedidos"""

    def get_all_orders(self, branch_id: Optional[str] = None) -> List[Dict]:
        """
        Obtener todos los pedidos

        Returns:
            Lista de pedidos serializados

        Raises:
            Exception: Si hay error al consultar la base de datos
        """
        try:
            query = supabase.table("orders").select("*")
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = execute_with_retry(query.execute)
            orders = response.data or []
            orders.sort(
                key=lambda order: order.get("created_at")
                or order.get("creation_date")
                or "",
                reverse=True,
            )
            return [self._serialize_order(order) for order in orders]

        except Exception as e:
            logger.error(f"Error al obtener pedidos: {str(e)}")
            raise Exception(f"Error al consultar pedidos: {str(e)}")

    def get_order_by_id(self, order_id: str) -> Optional[Dict]:
        """
        Obtener un pedido específico

        Args:
            order_id: ID del pedido

        Returns:
            Pedido serializado o None si no existe
        """
        try:
            order = self._get_order_raw(order_id)
            if not order:
                return None
            return self._serialize_order(order)

        except Exception as e:
            logger.error(f"Error al obtener pedido {order_id}: {str(e)}")
            raise Exception(f"Error al consultar pedido: {str(e)}")

    def get_orders_by_mesa(self, mesa_id: str) -> List[Dict]:
        """
        Obtener pedidos de una mesa específica

        Args:
            mesa_id: ID de la mesa

        Returns:
            Lista de pedidos de la mesa
        """
        try:
            def _run():
                return (
                    supabase.table("orders")
                    .select("*")
                    .eq("mesa_id", mesa_id)
                    .execute()
                )
            response = execute_with_retry(_run)
            orders = response.data or []
            orders.sort(
                key=lambda order: order.get("created_at")
                or order.get("creation_date")
                or "",
                reverse=True,
            )
            return [self._serialize_order(order) for order in orders]

        except Exception as e:
            logger.error(f"Error al obtener pedidos de mesa {mesa_id}: {str(e)}")
            raise Exception(f"Error al consultar pedidos: {str(e)}")

    def get_orders_by_status(self, status: OrderStatus) -> List[Dict]:
        """
        Obtener pedidos por estado

        Args:
            status: Estado del pedido

        Returns:
            Lista de pedidos con ese estado
        """
        try:
            status_value = status.value if hasattr(status, "value") else str(status)
            def _run():
                return (
                    supabase.table("orders")
                    .select("*")
                    .eq("status", status_value)
                    .execute()
                )
            response = execute_with_retry(_run)
            orders = response.data or []
            orders.sort(
                key=lambda order: order.get("created_at")
                or order.get("creation_date")
                or "",
                reverse=True,
            )
            return [self._serialize_order(order) for order in orders]

        except Exception as e:
            logger.error(f"Error al obtener pedidos por estado {status}: {str(e)}")
            raise Exception(f"Error al consultar pedidos: {str(e)}")

    def get_orders_by_status_key(self, status_key: str) -> List[Dict]:
        status = self._resolve_status_key(status_key)
        return self.get_orders_by_status(status)

    def set_payment_method_for_latest_order(self, mesa_id: str, payment_method: str, branch_id: Optional[str] = None) -> None:
        """
        Actualizar el método de pago del último pedido de una mesa.
        """
        try:
            def _run():
                query = (
                    supabase.table("orders")
                    .select("id, creation_date")
                    .eq("mesa_id", mesa_id)
                )
                if branch_id:
                    query = query.eq("branch_id", branch_id)
                return query.order("creation_date", desc=True).limit(1).execute()
            response = execute_with_retry(_run)
            data = response.data or []
            if not data:
                return
            order_id = data[0].get("id")
            if not order_id:
                return
            supabase.table("orders").update({"payment_method": payment_method}).eq("id", order_id).execute()
        except Exception as e:
            logger.warning(f"No se pudo actualizar payment_method para mesa {mesa_id}: {str(e)}")

    def mark_latest_order_paid_for_mesa(self, mesa_id: str, branch_id: Optional[str] = None) -> Optional[Dict]:
        """
        Marcar como PAID el último pedido de una mesa.
        """
        try:
            query = (
                supabase.table("orders")
                .select("*")
                .eq("mesa_id", mesa_id)
            )
            if branch_id:
                query = query.eq("branch_id", branch_id)
            response = query.order("creation_date", desc=True).limit(1).execute()
            order = (response.data or [None])[0]
            if not order:
                return None
            if order.get("status") == OrderStatus.PAID.value:
                return self._serialize_order(order)

            try:
                updated = self.update_order_status(order.get("id"), OrderStatus.PAID)
                if updated:
                    return updated
            except ValueError:
                pass

            # Forzar el pago si la transición falla o no se actualizó
            response = (
                supabase.table("orders")
                .update({"status": OrderStatus.PAID.value})
                .eq("id", order.get("id"))
                .execute()
            )
            updated = (response.data or [None])[0]
            if updated and updated.get("branch_id"):
                try:
                    invalidate_token(updated.get("mesa_id"), updated.get("branch_id"))
                except Exception:
                    pass
            return self._serialize_order(updated) if updated else None
        except Exception as e:
            logger.error(f"No se pudo marcar PAID el último pedido de mesa {mesa_id}: {str(e)}")
            return None

    def create_order(self, mesa_id: str, items: List[Dict], token: str = None, branch_id: Optional[str] = None) -> Dict:
        """
        Crear un nuevo pedido

        Args:
            mesa_id: ID de la mesa
            items: Lista de items del pedido
            token: Token de autenticación de la mesa (opcional)

        Returns:
            Pedido creado

        Raises:
            ValueError: Si los datos son inválidos
            PermissionError: Si el token es inválido
            Exception: Si hay error al crear
        """
        if not token:
            raise PermissionError("Token requerido")
        if not branch_id:
            raise ValueError("branch_id requerido")
        if not validate_token(mesa_id, branch_id, token):
            raise PermissionError("Token inválido o expirado")

        if not items or len(items) == 0:
            raise ValueError("El pedido debe tener al menos un item")

        total_amount = self._calculate_total(items)
        order_token = str(uuid.uuid4())
        now_iso = self._now_iso()

        try:
            mesa_resp = (
                supabase.table("mesas")
                .select("restaurant_id, branch_id")
                .eq("mesa_id", mesa_id)
                .eq("branch_id", branch_id)
                .limit(1)
                .execute()
            )
            mesa = (mesa_resp.data or [None])[0]
            if not mesa:
                raise ValueError("Mesa no encontrada")
            insert_data = {
                "mesa_id": mesa_id,
                "status": OrderStatus.PAYMENT_PENDING.value,
                "token": order_token,
                "items": items,
                "total_amount": total_amount,
                "creation_date": now_iso,
                "restaurant_id": mesa.get("restaurant_id"),
                "branch_id": mesa.get("branch_id"),
            }

            response = supabase.table("orders").insert(insert_data).execute()

            if not response.data:
                raise Exception("No se pudo crear el pedido")

            new_order = response.data[0]
            logger.info(
                f"Pedido creado: ID {new_order.get('id')}, Mesa {mesa_id}, Total ${total_amount}"
            )

            return self._serialize_order(new_order)

        except Exception as e:
            logger.error(f"Error al crear pedido: {str(e)}")
            raise Exception(f"Error al crear pedido: {str(e)}")

    def update_order_status(self, order_id: str, new_status: Union[OrderStatus, str]) -> Optional[Dict]:
        """
        Actualizar el estado de un pedido

        Args:
            order_id: ID del pedido
            new_status: Nuevo estado

        Returns:
            Pedido actualizado o None si no existe

        Raises:
            ValueError: Si la transición de estado es inválida
        """
        status_value = new_status.value if hasattr(new_status, "value") else str(new_status)
        try:
            order = self._get_order_raw(order_id)
            if not order:
                return None

            current_status = order.get("status")
            if not self._is_valid_status_transition(current_status, status_value):
                raise ValueError(
                    f"Transición inválida de {current_status} a {status_value}"
                )

            update_data = {
                "status": status_value,
            }

            if status_value == OrderStatus.PAID.value:
                try:
                    if order.get("branch_id"):
                        invalidate_token(order.get("mesa_id"), order.get("branch_id"))
                    logger.info(
                        f"Token de mesa invalidado tras pago manual: mesa_id={order.get('mesa_id')}"
                    )
                except Exception as e:
                    logger.warning(
                        f"No se pudo invalidar token de mesa {order.get('mesa_id')}: {str(e)}"
                    )

            response = (
                supabase.table("orders")
                .update(update_data)
                .eq("id", order_id)
                .execute()
            )

            if not response.data:
                return None

            updated_order = response.data[0]

            logger.info(
                f"Pedido {order_id}: Estado actualizado de {current_status} a {status_value}"
            )

            return self._serialize_order(updated_order)

        except ValueError:
            raise
        except Exception as e:
            logger.error(
                f"Error al actualizar estado del pedido {order_id}: {str(e)}"
            )
            raise Exception(f"Error al actualizar pedido: {str(e)}")

    def update_order_status_by_key(self, order_id: str, status_key: str) -> Optional[Dict]:
        status = self._resolve_status_key(status_key)
        return self.update_order_status(order_id, status)

    def add_items_to_order(self, order_id: str, new_items: List[Dict]) -> Optional[Dict]:
        """
        Agregar items a un pedido existente

        Args:
            order_id: ID del pedido
            new_items: Nuevos items a agregar

        Returns:
            Pedido actualizado o None si no existe

        Raises:
            ValueError: Si el pedido ya está pagado
        """
        try:
            order = self._get_order_raw(order_id)
            if not order:
                return None

            current_status = order.get("status")
            if current_status in [
                OrderStatus.PAID.value,
                OrderStatus.PAYMENT_APPROVED.value,
                OrderStatus.IN_PREPARATION.value,
                OrderStatus.READY.value,
                OrderStatus.DELIVERED.value,
            ]:
                raise ValueError("No se pueden agregar items a un pedido ya pagado")

            current_items = order.get("items") or []
            current_items.extend(new_items)
            total_amount = self._calculate_total(current_items)
            update_data = {
                "items": current_items,
                "total_amount": total_amount,
            }

            response = (
                supabase.table("orders")
                .update(update_data)
                .eq("id", order_id)
                .execute()
            )

            if not response.data:
                return None

            logger.info(f"Items agregados al pedido {order_id}")

            return self._serialize_order(response.data[0])

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al agregar items al pedido {order_id}: {str(e)}")
            raise Exception(f"Error al modificar pedido: {str(e)}")

    def cancel_order(self, order_id: str, reason: str = None) -> Optional[Dict]:
        """
        Cancelar un pedido

        Args:
            order_id: ID del pedido
            reason: Razón de cancelación

        Returns:
            Pedido cancelado o None si no existe

        Raises:
            ValueError: Si el pedido no puede ser cancelado
        """
        try:
            order = self._get_order_raw(order_id)
            if not order:
                return None

            if order.get("status") == OrderStatus.DELIVERED.value:
                raise ValueError("No se puede cancelar un pedido entregado")

            update_data = {
                "status": OrderStatus.PAYMENT_REJECTED.value,
            }

            response = (
                supabase.table("orders")
                .update(update_data)
                .eq("id", order_id)
                .execute()
            )

            if not response.data:
                return None

            logger.info(f"Pedido {order_id} cancelado. Razón: {reason}")
            try:
                if order.get("branch_id"):
                    invalidate_token(order.get("mesa_id"), order.get("branch_id"))
                logger.info(
                    f"Token de mesa invalidado tras cancelación: mesa_id={order.get('mesa_id')}"
                )
            except Exception as e:
                logger.warning(
                    f"No se pudo invalidar token de mesa {order.get('mesa_id')}: {str(e)}"
                )

            return self._serialize_order(response.data[0])

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error al cancelar pedido {order_id}: {str(e)}")
            raise Exception(f"Error al cancelar pedido: {str(e)}")

    def renew_order_token(self, mesa_id: str, branch_id: str) -> str:
        """
        Renovar token de acceso de una mesa

        Args:
            mesa_id: ID de la mesa

        Returns:
            Nuevo token
        """
        new_token = renew_token(mesa_id, branch_id)
        logger.info(f"Token renovado para mesa {mesa_id}")
        return new_token

    def _get_order_raw(self, order_id: str) -> Optional[Dict]:
        try:
            def _run():
                return (
                    supabase.table("orders")
                    .select("*")
                    .eq("id", order_id)
                    .execute()
                )
            response = execute_with_retry(_run)
            data = response.data or []
            return data[0] if data else None
        except Exception as e:
            logger.error(f"Error al obtener pedido {order_id}: {str(e)}")
            return None

    def _calculate_total(self, items: List[Dict]) -> float:
        total = 0.0
        for item in items:
            price = float(item.get("price", 0))
            quantity = int(item.get("quantity", 1))
            total += price * quantity
        return round(total, 2)

    def _is_valid_status_transition(self, current: Optional[str], new: str) -> bool:
        if not current or current == new:
            return True

        valid_transitions = {
            OrderStatus.PAYMENT_PENDING.value: [
                OrderStatus.PAYMENT_APPROVED.value,
                OrderStatus.PAYMENT_REJECTED.value,
                OrderStatus.PAID.value,
            ],
            OrderStatus.PAYMENT_APPROVED.value: [
                OrderStatus.IN_PREPARATION.value,
                OrderStatus.READY.value,
                OrderStatus.DELIVERED.value,
            ],
            OrderStatus.PAID.value: [
                OrderStatus.IN_PREPARATION.value,
                OrderStatus.READY.value,
                OrderStatus.DELIVERED.value,
            ],
            OrderStatus.IN_PREPARATION.value: [OrderStatus.READY.value],
            OrderStatus.READY.value: [OrderStatus.DELIVERED.value],
            OrderStatus.PAYMENT_REJECTED.value: [],
            OrderStatus.DELIVERED.value: [],
        }

        if current not in valid_transitions:
            return True

        return new in valid_transitions[current]

    def _serialize_order(self, order: Dict) -> Dict:
        items = order.get("items") or []
        total_amount = order.get("total_amount")
        if total_amount is None:
            total_amount = self._calculate_total(items)

        created_at = order.get("created_at") or order.get("creation_date")
        payment_status = order.get("payment_status") or self._derive_payment_status(order.get("status"))

        return {
            "id": order.get("id"),
            "mesa_id": order.get("mesa_id"),
            "status": order.get("status"),
            "items": items,
            "total": float(total_amount) if total_amount is not None else 0,
            "total_amount": float(total_amount) if total_amount is not None else 0,
            "created_at": created_at,
            "payment_status": payment_status,
        }

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _derive_payment_status(status: Optional[str]) -> Optional[str]:
        if not status:
            return None
        if status == OrderStatus.PAYMENT_PENDING.value:
            return "pending"
        if status == OrderStatus.PAYMENT_REJECTED.value:
            return "rejected"
        return "approved"

    @staticmethod
    def _resolve_status_key(status_key: str) -> OrderStatus:
        if not status_key:
            raise ValueError("Estado requerido")
        try:
            return OrderStatus[status_key.upper()]
        except KeyError:
            raise ValueError("Estado inválido")


order_service = OrderService()
