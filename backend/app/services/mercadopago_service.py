import mercadopago
import json
from datetime import datetime, timedelta
from ..config import Config
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class MercadoPagoService:
    def __init__(self):
        self.access_token = Config.MERCADO_PAGO_ACCESS_TOKEN
        self.sdk = mercadopago.SDK(self.access_token)
    
    def create_preference(self, order_data):
        """
        Crear una preferencia de pago en Mercado Pago usando el SDK oficial
        
        Args:
            order_data: dict con información del pedido
                - total_amount: float
                - items: list
                - order_id: str
                - mesa_id: str
        x
        Returns:
            dict con la respuesta de Mercado Pago
        """
        try:
            # Construir items para Mercado Pago
            items = []
            for item in order_data["items"]:
                items.append({
                    "title": item["name"],
                    "quantity": item["quantity"],
                    "unit_price": float(item["price"])
                })
            
            # Crear preferencia usando el SDK
            preference_data = {
                "items": items,
                "external_reference": str(order_data["order_id"]),
                "notification_url": f"{Config.BASE_URL}/payment/webhooks/mercadopago",
                "back_urls": {
                    "success": f"{Config.FRONTEND_URL}/payment/success",
                    "failure": f"{Config.FRONTEND_URL}/payment/error",
                    "pending": f"{Config.FRONTEND_URL}/payment/pending"
                },
                "auto_return": "approved",
                "expires": True,
                "expiration_date_to": (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z",
                "statement_descriptor": "CAFE LOCAL",
                "additional_info": f"Pedido para Mesa {order_data['mesa_id']}",
                "payer": {
                    "name": f"Cliente Mesa {order_data['mesa_id']}",
                    "email": "cliente@restaurante.com"
                }
            }
            
            logger.info(f"Creando preferencia para orden {order_data['order_id']}")
            
            # Usar el SDK de Mercado Pago
            preference_response = self.sdk.preference().create(preference_data)
            
            if preference_response["status"] == 201:
                preference = preference_response["response"]
                logger.info(f"Preferencia creada exitosamente: {preference['id']}")
                return {
                    "success": True,
                    "preference_id": preference["id"],
                    "init_point": preference["init_point"],
                    "sandbox_init_point": preference.get("sandbox_init_point")
                }
            else:
                logger.error(f"Error creando preferencia: {preference_response}")
                return {
                    "success": False,
                    "error": f"Error creando preferencia: {preference_response}"
                }
                
        except Exception as e:
            logger.error(f"Error en create_preference: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_payment_info(self, payment_id):
        """
        Obtener información de un pago específico usando el SDK
        
        Args:
            payment_id: str - ID del pago en Mercado Pago
        
        Returns:
            dict con la información del pago
        """
        try:
            payment_response = self.sdk.payment().get(payment_id)
            
            if payment_response["status"] == 200:
                return {
                    "success": True,
                    "payment": payment_response["response"]
                }
            else:
                logger.error(f"Error obteniendo pago {payment_id}: {payment_response}")
                return {
                    "success": False,
                    "error": f"Error obteniendo pago: {payment_response}"
                }
                
        except Exception as e:
            logger.error(f"Error en get_payment_info: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def refund_payment(self, payment_id, amount=None):
        """
        Reembolsar un pago usando el SDK
        
        Args:
            payment_id: str - ID del pago en Mercado Pago
            amount: float - Monto a reembolsar (opcional, si no se especifica se reembolsa todo)
        
        Returns:
            dict con la respuesta del reembolso
        """
        try:
            refund_data = {}
            if amount:
                refund_data["amount"] = amount
            
            refund_response = self.sdk.refund().create(payment_id, refund_data)
            
            if refund_response["status"] == 201:
                refund = refund_response["response"]
                logger.info(f"Reembolso exitoso para pago {payment_id}: {refund['id']}")
                return {
                    "success": True,
                    "refund_id": refund["id"],
                    "amount": refund.get("amount"),
                    "status": refund.get("status")
                }
            else:
                logger.error(f"Error reembolsando pago {payment_id}: {refund_response}")
                return {
                    "success": False,
                    "error": f"Error reembolsando pago: {refund_response}"
                }
                
        except Exception as e:
            logger.error(f"Error en refund_payment: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def validate_webhook_signature(self, data, signature):
        """
        Validar la firma del webhook de Mercado Pago
        
        Args:
            data: str - Datos del webhook
            signature: str - Firma del webhook
        
        Returns:
            bool - True si la firma es válida
        """
        try:
            # En producción, deberías validar la firma usando el webhook secret
            # Por ahora, retornamos True para desarrollo
            return True
        except Exception as e:
            logger.error(f"Error validando firma: {str(e)}")
            return False 