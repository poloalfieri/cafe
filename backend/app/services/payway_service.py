"""
Servicio para integración con Payway
Maneja la creación de preferencias de pago y webhooks
"""

import requests
import json
import uuid
from datetime import datetime
from ..utils.logger import setup_logger
from ..config import Config

logger = setup_logger(__name__)

class PaywayService:
    def __init__(self):
        self.base_url = "https://api.payway.com.ar"
        self.public_key = Config.PAYWAY_PUBLIC_KEY
        self.access_token = Config.PAYWAY_ACCESS_TOKEN
        self.client_id = Config.PAYWAY_CLIENT_ID
        self.client_secret = Config.PAYWAY_CLIENT_SECRET
        
    def _get_headers(self):
        """Obtener headers para las peticiones a Payway"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "x-api-key": self.public_key
        }
    
    def create_payment_preference(self, payment_data):
        """
        Crear una preferencia de pago en Payway
        
        Args:
            payment_data (dict): Datos del pago
                - amount: Monto a cobrar
                - currency: Moneda (ARS)
                - description: Descripción del pago
                - external_reference: Referencia externa
                - payer: Datos del pagador
                - items: Lista de items
                
        Returns:
            dict: Respuesta de Payway con preference_id y init_point
        """
        try:
            # Preparar datos para Payway
            preference_data = {
                "items": [
                    {
                        "id": item.get("id", str(uuid.uuid4())),
                        "title": item.get("name", "Producto"),
                        "quantity": item.get("quantity", 1),
                        "unit_price": item.get("price", 0),
                        "currency_id": "ARS"
                    }
                    for item in payment_data.get("items", [])
                ],
                "payer": {
                    "name": payment_data.get("payer", {}).get("name", "Cliente"),
                    "email": payment_data.get("payer", {}).get("email", "cliente@restaurante.com"),
                    "identification": {
                        "type": "DNI",
                        "number": payment_data.get("payer", {}).get("dni", "12345678")
                    }
                },
                "back_urls": {
                    "success": f"{Config.FRONTEND_URL}/payment/success",
                    "failure": f"{Config.FRONTEND_URL}/payment/error",
                    "pending": f"{Config.FRONTEND_URL}/payment/pending"
                },
                "notification_url": f"{Config.BACKEND_URL}/payment/webhook/payway",
                "external_reference": payment_data.get("external_reference"),
                "expires": True,
                "expiration_date_to": (datetime.now().replace(hour=23, minute=59, second=59)).isoformat(),
                "payment_methods": {
                    "excluded_payment_types": [
                        {"id": "credit_card"},
                        {"id": "debit_card"}
                    ],
                    "excluded_payment_methods": [],
                    "installments": 1
                },
                "statement_descriptor": "RESTAURANTE",
                "auto_return": "approved"
            }
            
            # Crear preferencia en Payway
            response = requests.post(
                f"{self.base_url}/checkout/preferences",
                headers=self._get_headers(),
                json=preference_data,
                timeout=30
            )
            
            response.raise_for_status()
            payway_response = response.json()
            
            logger.info(f"Preferencia Payway creada - ID: {payway_response.get('id')}")
            
            return {
                "success": True,
                "preference_id": payway_response.get("id"),
                "init_point": payway_response.get("init_point"),
                "sandbox_init_point": payway_response.get("sandbox_init_point"),
                "external_reference": payment_data.get("external_reference")
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error comunicándose con Payway: {str(e)}")
            return {
                "success": False,
                "error": f"Error de comunicación con Payway: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error creando preferencia Payway: {str(e)}")
            return {
                "success": False,
                "error": f"Error interno: {str(e)}"
            }
    
    def get_payment_info(self, payment_id):
        """
        Obtener información de un pago específico
        
        Args:
            payment_id (str): ID del pago en Payway
            
        Returns:
            dict: Información del pago
        """
        try:
            response = requests.get(
                f"{self.base_url}/v1/payments/{payment_id}",
                headers=self._get_headers(),
                timeout=30
            )
            
            response.raise_for_status()
            payment_info = response.json()
            
            return {
                "success": True,
                "payment": {
                    "id": payment_info.get("id"),
                    "status": payment_info.get("status"),
                    "external_reference": payment_info.get("external_reference"),
                    "amount": payment_info.get("transaction_amount"),
                    "currency": payment_info.get("currency_id"),
                    "payment_method": payment_info.get("payment_method", {}).get("type"),
                    "created_at": payment_info.get("date_created"),
                    "approved_at": payment_info.get("date_approved")
                }
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error obteniendo información de pago: {str(e)}")
            return {
                "success": False,
                "error": f"Error de comunicación: {str(e)}"
            }
    
    def refund_payment(self, payment_id, amount=None):
        """
        Reembolsar un pago
        
        Args:
            payment_id (str): ID del pago a reembolsar
            amount (float): Monto a reembolsar (opcional, si no se especifica se reembolsa todo)
            
        Returns:
            dict: Resultado del reembolso
        """
        try:
            refund_data = {}
            if amount:
                refund_data["amount"] = amount
            
            response = requests.post(
                f"{self.base_url}/v1/payments/{payment_id}/refunds",
                headers=self._get_headers(),
                json=refund_data,
                timeout=30
            )
            
            response.raise_for_status()
            refund_info = response.json()
            
            logger.info(f"Reembolso procesado - Payment ID: {payment_id}, Refund ID: {refund_info.get('id')}")
            
            return {
                "success": True,
                "refund_id": refund_info.get("id"),
                "amount": refund_info.get("amount"),
                "status": refund_info.get("status")
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error procesando reembolso: {str(e)}")
            return {
                "success": False,
                "error": f"Error de comunicación: {str(e)}"
            }
    
    def validate_webhook_signature(self, payload, signature):
        """
        Validar la firma del webhook de Payway
        
        Args:
            payload (bytes): Cuerpo del webhook
            signature (str): Firma del webhook
            
        Returns:
            bool: True si la firma es válida
        """
        try:
            # En producción, implementar validación de firma
            # Por ahora retornamos True para desarrollo
            return True
        except Exception as e:
            logger.error(f"Error validando firma del webhook: {str(e)}")
            return False 