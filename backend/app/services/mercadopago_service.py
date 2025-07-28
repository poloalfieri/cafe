import requests
import json
from datetime import datetime
from ..config import Config
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class MercadoPagoService:
    def __init__(self):
        self.access_token = Config.MERCADO_PAGO_ACCESS_TOKEN
        self.base_url = "https://api.mercadopago.com"
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
    
    def create_preference(self, order_data):
        """
        Crear una preferencia de pago en Mercado Pago
        
        Args:
            order_data: dict con información del pedido
                - total_amount: float
                - items: list
                - order_id: str
                - mesa_id: str
        
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
            
            # Crear preferencia
            preference_data = {
                "items": items,
                "external_reference": str(order_data["order_id"]),
                "notification_url": f"{Config.BASE_URL}/webhooks/mercadopago",
                "back_urls": {
                    "success": f"{Config.BASE_URL}/payment/success",
                    "failure": f"{Config.BASE_URL}/payment/failure",
                    "pending": f"{Config.BASE_URL}/payment/pending"
                },
                "auto_return": "approved",
                "expires": True,
                "expiration_date_to": (datetime.utcnow().replace(hour=23, minute=59, second=59) + 
                                     datetime.timedelta(days=1)).isoformat() + "Z",
                "statement_descriptor": "CAFE LOCAL",
                "additional_info": f"Pedido para Mesa {order_data['mesa_id']}"
            }
            
            logger.info(f"Creando preferencia para orden {order_data['order_id']}")
            
            response = requests.post(
                f"{self.base_url}/checkout/preferences",
                headers=self.headers,
                json=preference_data
            )
            
            if response.status_code == 201:
                data = response.json()
                logger.info(f"Preferencia creada exitosamente: {data['id']}")
                return {
                    "success": True,
                    "preference_id": data["id"],
                    "init_point": data["init_point"],
                    "sandbox_init_point": data.get("sandbox_init_point")
                }
            else:
                logger.error(f"Error creando preferencia: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"Error {response.status_code}: {response.text}"
                }
                
        except Exception as e:
            logger.error(f"Error en create_preference: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_payment_info(self, payment_id):
        """
        Obtener información de un pago específico
        
        Args:
            payment_id: str - ID del pago en Mercado Pago
        
        Returns:
            dict con la información del pago
        """
        try:
            response = requests.get(
                f"{self.base_url}/v1/payments/{payment_id}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "payment": response.json()
                }
            else:
                logger.error(f"Error obteniendo pago {payment_id}: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"Error {response.status_code}: {response.text}"
                }
                
        except Exception as e:
            logger.error(f"Error en get_payment_info: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def refund_payment(self, payment_id, amount=None):
        """
        Reembolsar un pago
        
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
            
            response = requests.post(
                f"{self.base_url}/v1/payments/{payment_id}/refunds",
                headers=self.headers,
                json=refund_data
            )
            
            if response.status_code == 201:
                data = response.json()
                logger.info(f"Reembolso exitoso para pago {payment_id}: {data['id']}")
                return {
                    "success": True,
                    "refund_id": data["id"],
                    "amount": data.get("amount"),
                    "status": data.get("status")
                }
            else:
                logger.error(f"Error reembolsando pago {payment_id}: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"Error {response.status_code}: {response.text}"
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