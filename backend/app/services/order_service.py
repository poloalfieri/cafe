"""
Servicio de Pedidos - Lógica de negocio para órdenes
"""
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
from ..db.connection import get_db
from ..db.models import Order, OrderStatus
from ..utils.token_manager import validate_token, renew_token, generate_token
from ..utils.logger import setup_logger
import uuid

logger = setup_logger(__name__)


class OrderService:
    """Servicio para manejar operaciones de pedidos"""
    
    def get_all_orders(self) -> List[Dict]:
        """
        Obtener todos los pedidos
        
        Returns:
            Lista de pedidos serializados
            
        Raises:
            Exception: Si hay error al consultar la base de datos
        """
        try:
            db = get_db()
            orders = db.query(Order).all()
            return [self._serialize_order(order) for order in orders]
            
        except SQLAlchemyError as e:
            logger.error(f"Error al obtener pedidos: {str(e)}")
            raise Exception(f"Error al consultar pedidos: {str(e)}")
    
    def get_order_by_id(self, order_id: int) -> Optional[Dict]:
        """
        Obtener un pedido específico
        
        Args:
            order_id: ID del pedido
            
        Returns:
            Pedido serializado o None si no existe
        """
        try:
            db = get_db()
            order = db.query(Order).filter(Order.id == order_id).first()
            
            if not order:
                return None
            
            return self._serialize_order(order)
            
        except SQLAlchemyError as e:
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
            db = get_db()
            orders = db.query(Order).filter(Order.mesa_id == mesa_id).all()
            return [self._serialize_order(order) for order in orders]
            
        except SQLAlchemyError as e:
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
            db = get_db()
            orders = db.query(Order).filter(Order.status == status).all()
            return [self._serialize_order(order) for order in orders]
            
        except SQLAlchemyError as e:
            logger.error(f"Error al obtener pedidos por estado {status}: {str(e)}")
            raise Exception(f"Error al consultar pedidos: {str(e)}")
    
    def create_order(self, mesa_id: str, items: List[Dict], token: str = None) -> Dict:
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
        # Requerir token válido de mesa
        if not token:
            raise PermissionError("Token requerido")
        if not validate_token(mesa_id, token):
            raise PermissionError("Token inválido o expirado")
        
        # Validar items
        if not items or len(items) == 0:
            raise ValueError("El pedido debe tener al menos un item")
        
        # Calcular total
        total_amount = self._calculate_total(items)
        
        try:
            db = get_db()
            
            # Generar token para el pedido
            order_token = str(uuid.uuid4())
            
            # Crear pedido
            new_order = Order(
                mesa_id=mesa_id,
                status=OrderStatus.PENDING,
                token=order_token,
                total_amount=total_amount,
                items=items,
                created_at=datetime.utcnow()
            )
            
            db.add(new_order)
            db.commit()
            db.refresh(new_order)
            
            logger.info(f"Pedido creado: ID {new_order.id}, Mesa {mesa_id}, Total ${total_amount}")
            
            return self._serialize_order(new_order)
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error al crear pedido: {str(e)}")
            raise Exception(f"Error al crear pedido: {str(e)}")
    
    def update_order_status(self, order_id: int, new_status: OrderStatus) -> Optional[Dict]:
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
        try:
            db = get_db()
            order = db.query(Order).filter(Order.id == order_id).first()
            
            if not order:
                return None
            
            # Validar transición de estado
            if not self._is_valid_status_transition(order.status, new_status):
                raise ValueError(f"Transición inválida de {order.status} a {new_status}")
            
            old_status = order.status
            order.status = new_status
            
            # Actualizar timestamp si es pago completado
            if new_status == OrderStatus.PAID:
                order.paid_at = datetime.utcnow()
            
            db.commit()
            db.refresh(order)
            
            logger.info(f"Pedido {order_id}: Estado actualizado de {old_status} a {new_status}")
            
            return self._serialize_order(order)
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error al actualizar estado del pedido {order_id}: {str(e)}")
            raise Exception(f"Error al actualizar pedido: {str(e)}")
    
    def add_items_to_order(self, order_id: int, new_items: List[Dict]) -> Optional[Dict]:
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
            db = get_db()
            order = db.query(Order).filter(Order.id == order_id).first()
            
            if not order:
                return None
            
            # No permitir modificar pedidos pagados
            if order.status in [OrderStatus.PAID, OrderStatus.COMPLETED]:
                raise ValueError("No se pueden agregar items a un pedido pagado")
            
            # Agregar nuevos items
            current_items = order.items or []
            current_items.extend(new_items)
            order.items = current_items
            
            # Recalcular total
            order.total_amount = self._calculate_total(current_items)
            
            db.commit()
            db.refresh(order)
            
            logger.info(f"Items agregados al pedido {order_id}")
            
            return self._serialize_order(order)
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error al agregar items al pedido {order_id}: {str(e)}")
            raise Exception(f"Error al modificar pedido: {str(e)}")
    
    def cancel_order(self, order_id: int, reason: str = None) -> Optional[Dict]:
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
            db = get_db()
            order = db.query(Order).filter(Order.id == order_id).first()
            
            if not order:
                return None
            
            # No permitir cancelar pedidos completados
            if order.status == OrderStatus.COMPLETED:
                raise ValueError("No se puede cancelar un pedido completado")
            
            order.status = OrderStatus.CANCELLED
            order.cancellation_reason = reason
            order.cancelled_at = datetime.utcnow()
            
            db.commit()
            db.refresh(order)
            
            logger.info(f"Pedido {order_id} cancelado. Razón: {reason}")
            
            return self._serialize_order(order)
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error al cancelar pedido {order_id}: {str(e)}")
            raise Exception(f"Error al cancelar pedido: {str(e)}")
    
    def renew_order_token(self, mesa_id: str) -> str:
        """
        Renovar token de acceso de una mesa
        
        Args:
            mesa_id: ID de la mesa
            
        Returns:
            Nuevo token
        """
        new_token = renew_token(mesa_id)
        logger.info(f"Token renovado para mesa {mesa_id}")
        return new_token
    
    # Métodos privados
    
    def _calculate_total(self, items: List[Dict]) -> float:
        """Calcular el total de un pedido"""
        total = 0.0
        for item in items:
            price = float(item.get("price", 0))
            quantity = int(item.get("quantity", 1))
            total += price * quantity
        return round(total, 2)
    
    def _is_valid_status_transition(self, current: OrderStatus, new: OrderStatus) -> bool:
        """Validar si una transición de estado es válida"""
        valid_transitions = {
            OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
            OrderStatus.CONFIRMED: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
            OrderStatus.IN_PROGRESS: [OrderStatus.READY, OrderStatus.CANCELLED],
            OrderStatus.READY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
            OrderStatus.DELIVERED: [OrderStatus.PAYMENT_PENDING, OrderStatus.PAID],
            OrderStatus.PAYMENT_PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED],
            OrderStatus.PAID: [OrderStatus.COMPLETED],
            OrderStatus.COMPLETED: [],  # No se puede cambiar desde completado
            OrderStatus.CANCELLED: []   # No se puede cambiar desde cancelado
        }
        
        return new in valid_transitions.get(current, [])
    
    def _serialize_order(self, order: Order) -> Dict:
        """Serializar un pedido a diccionario"""
        items = order.items or []
        
        return {
            "id": order.id,
            "mesa_id": order.mesa_id,
            "status": order.status.value if hasattr(order.status, 'value') else order.status,
            "token": order.token,
            "items": items,
            "total": float(order.total_amount) if order.total_amount else self._calculate_total(items),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "paid_at": order.paid_at.isoformat() if order.paid_at else None,
            "cancelled_at": order.cancelled_at.isoformat() if hasattr(order, 'cancelled_at') and order.cancelled_at else None,
            "cancellation_reason": getattr(order, 'cancellation_reason', None)
        }


# Instancia singleton del servicio
order_service = OrderService()
