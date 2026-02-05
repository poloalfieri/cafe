"""
Servicio para manejar lógica de negocio de pagos
Separa la lógica de negocio del controller HTTP
"""

from ..db.connection import get_db
from ..db.models import Order, OrderStatus, PaymentStatus
from ..services.mercadopago_service import MercadoPagoService
from ..services.menu_service import menu_service
from ..utils.logger import setup_logger
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import uuid
from typing import Dict, Optional

logger = setup_logger(__name__)
mp_service = MercadoPagoService()


class PaymentService:
    """Servicio para manejar lógica de negocio de pagos"""
    
    @staticmethod
    def init_payment(monto: float, mesa_id: str, descripcion: str, items: list = None) -> Dict:
        """
        Inicializar pago con Mercado Pago Checkout Pro
        
        Args:
            monto: Monto del pago
            mesa_id: ID de la mesa
            descripcion: Descripción del pago
            
        Returns:
            Dict con información del pago inicializado
            
        Raises:
            ValueError: Si los datos son inválidos
            Exception: Si hay error en DB o Mercado Pago
        """
        # Validar datos ANTES del try-except para que ValueError se propague
        PaymentService._validate_required_fields(
            {"mesa_id": mesa_id, "items": items},
            ["mesa_id", "items"]
        )
        PaymentService._validate_items(items)
        
        priced_items, total_amount = PaymentService._price_items_from_menu(items)
        
        db = get_db()
        
        try:
            # Crear pedido en la base de datos
            order_token = str(uuid.uuid4())
            new_order = Order(
                mesa_id=mesa_id,
                status=OrderStatus.PAYMENT_PENDING,
                token=order_token,
                total_amount=total_amount,
                items=priced_items
            )
            
            db.add(new_order)
            db.commit()
            db.refresh(new_order)
            
            # Crear preferencia en Mercado Pago
            order_data = {
                "order_id": new_order.id,
                "total_amount": total_amount,
                "items": priced_items,
                "mesa_id": mesa_id
            }
            
            mp_response = mp_service.create_preference(order_data)
            
            if not mp_response["success"]:
                # Si falla la creación de preferencia, eliminar el pedido
                db.delete(new_order)
                db.commit()
                raise Exception(mp_response["error"])
            
            # Actualizar el pedido con la información de la preferencia
            new_order.payment_preference_id = mp_response["preference_id"]
            new_order.payment_init_point = mp_response["init_point"]
            db.commit()
            
            logger.info(f"Pago inicializado - mesa_id: {mesa_id}, monto: {total_amount}, order_id: {new_order.id}")
            
            return {
                "success": True,
                "order_id": new_order.id,
                "order_token": order_token,
                "init_point": mp_response["init_point"],
                "preference_id": mp_response["preference_id"]
            }
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error de base de datos al inicializar pago: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            db.rollback()
            logger.error(f"Error al inicializar pago: {str(e)}")
            raise
    
    @staticmethod
    def create_preference(total_amount: float, items: list, mesa_id: str) -> Dict:
        """
        Crear preferencia de pago para un pedido
        
        Args:
            total_amount: Monto total
            items: Lista de items
            mesa_id: ID de la mesa
            
        Returns:
            Dict con información de la preferencia
            
        Raises:
            ValueError: Si los datos son inválidos
        """
        # Validar datos ANTES del try-except para que ValueError se propague
        PaymentService._validate_required_fields(
            {"items": items, "mesa_id": mesa_id},
            ["items", "mesa_id"]
        )
        PaymentService._validate_items(items)
        priced_items, computed_total = PaymentService._price_items_from_menu(items)
        
        try:
            order_data = {
                "total_amount": computed_total,
                "items": priced_items,
                "mesa_id": mesa_id
            }
            
            mp_response = mp_service.create_preference(order_data)
            
            if not mp_response["success"]:
                raise Exception(mp_response["error"])
            
            logger.info(f"Preferencia creada - mesa_id: {mesa_id}, monto: {computed_total}")
            
            return {
                "success": True,
                "init_point": mp_response["init_point"],
                "preference_id": mp_response["preference_id"],
                "total_amount": computed_total
            }
            
        except Exception as e:
            logger.error(f"Error al crear preferencia: {str(e)}")
            raise
    
    @staticmethod
    def handle_payment_success(payment_id: str, external_reference: str) -> Dict:
        """
        Manejar pago exitoso
        
        Args:
            payment_id: ID del pago en Mercado Pago
            external_reference: ID de la orden
            
        Returns:
            Dict con información de la orden
        """
        if not payment_id or not external_reference:
            raise ValueError("payment_id y external_reference son requeridos")
        
        db = get_db()
        
        try:
            order = db.query(Order).filter(Order.id == external_reference).first()
            
            if not order:
                raise ValueError("Orden no encontrada")
            
            # Obtener información del pago desde Mercado Pago
            payment_info = mp_service.get_payment_info(payment_id)
            
            if not payment_info["success"]:
                raise Exception("Error al obtener información del pago")
            
            payment_data = payment_info["payment"]
            
            # Actualizar el pedido
            order.payment_id = payment_id
            order.payment_status = PaymentStatus(payment_data["status"])
            order.payment_approved_at = datetime.utcnow()
            order.status = OrderStatus.PAYMENT_APPROVED
            
            db.commit()
            
            logger.info(f"Pago aprobado - order_id: {order.id}, payment_id: {payment_id}")
            
            return {
                "success": True,
                "order_id": order.id
            }
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Error de base de datos en payment_success: {str(e)}")
            raise Exception("Error en la base de datos")
        except Exception as e:
            logger.error(f"Error en payment_success: {str(e)}")
            raise
    
    @staticmethod
    def handle_payment_failure(payment_id: Optional[str], external_reference: Optional[str]) -> None:
        """
        Manejar pago fallido
        
        Args:
            payment_id: ID del pago (puede ser None)
            external_reference: ID de la orden (puede ser None)
        """
        if not external_reference:
            logger.warning("Payment failure sin external_reference")
            return
        
        db = get_db()
        
        try:
            order = db.query(Order).filter(Order.id == external_reference).first()
            
            if order:
                order.payment_status = PaymentStatus.REJECTED
                order.payment_rejected_at = datetime.utcnow()
                order.status = OrderStatus.PAYMENT_REJECTED
                db.commit()
                
                logger.info(f"Pago rechazado - order_id: {order.id}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error en payment_failure: {str(e)}")
            raise
    
    @staticmethod
    def handle_payment_pending(payment_id: Optional[str], external_reference: Optional[str]) -> Optional[str]:
        """
        Manejar pago pendiente
        
        Args:
            payment_id: ID del pago (puede ser None)
            external_reference: ID de la orden (puede ser None)
            
        Returns:
            order_id si existe, None si no
        """
        if not external_reference:
            logger.warning("Payment pending sin external_reference")
            return None
        
        db = get_db()
        
        try:
            order = db.query(Order).filter(Order.id == external_reference).first()
            
            if order:
                order.payment_status = PaymentStatus.PENDING
                db.commit()
                
                logger.info(f"Pago pendiente - order_id: {order.id}")
                return order.id
            
            return None
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error en payment_pending: {str(e)}")
            raise
    
    # Métodos privados de validación
    
    @staticmethod
    def _validate_required_fields(data: Dict, fields: list) -> None:
        """Validar que los campos requeridos estén presentes"""
        for field in fields:
            if field not in data or data[field] is None or data[field] == "":
                raise ValueError(f"Campo requerido: {field}")
    
    @staticmethod
    def _validate_amount(amount: float) -> None:
        """Validar que el monto sea válido"""
        try:
            amount_float = float(amount)
            if amount_float <= 0:
                raise ValueError("El monto debe ser mayor a 0")
        except (ValueError, TypeError):
            raise ValueError("El monto debe ser un número válido")
    
    @staticmethod
    def _validate_items(items: list) -> None:
        """Validar que los items sean válidos"""
        if not isinstance(items, list):
            raise ValueError("Items debe ser una lista")
            
        if len(items) == 0:
            raise ValueError("Debe proporcionar al menos un item")
        
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                raise ValueError(f"Item {idx} debe ser un objeto")
            
            required_item_fields = ["id", "quantity"]
            for field in required_item_fields:
                if field not in item:
                    raise ValueError(f"Item {idx}: campo requerido '{field}'")
            
            try:
                quantity = int(item.get("quantity", 0))
                if quantity <= 0:
                    raise ValueError
            except Exception:
                raise ValueError(f"Item {idx}: quantity inválido")

    @staticmethod
    def _price_items_from_menu(items: list) -> tuple[list, float]:
        """Recalcular precios usando el menú del servidor"""
        priced_items = []
        total = 0.0
        
        for idx, item in enumerate(items):
            try:
                item_id = int(item.get("id"))
            except Exception:
                raise ValueError(f"Item {idx}: id inválido")
            
            menu_item = menu_service.get_item_by_id(item_id)
            if not menu_item:
                raise ValueError(f"Item {idx}: producto no encontrado")
            if menu_item.get("available") is False:
                raise ValueError(f"Item {idx}: producto no disponible")
            
            quantity = int(item.get("quantity", 0))
            price = float(menu_item["price"])
            line_total = price * quantity
            total += line_total
            
            priced_items.append({
                "id": str(menu_item["id"]),
                "name": menu_item["name"],
                "quantity": quantity,
                "price": price
            })
        
        return priced_items, round(total, 2)


# Instancia singleton
payment_service = PaymentService() 
