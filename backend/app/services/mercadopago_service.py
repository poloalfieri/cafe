import mercadopago
import json
from datetime import datetime, timedelta
from ..config import Config
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


def _resolve_effective_branch_id(branch_id, max_depth=5):
    """
    Follow the mp_config_source_branch_id chain to find the effective branch
    whose payment_configs should be used.
    Includes cycle protection (max hops).
    """
    from ..db.supabase_client import supabase

    visited = set()
    current = branch_id

    for _ in range(max_depth):
        if current in visited:
            logger.error(
                f"Cycle detected in mp_config_source_branch_id: "
                f"startBranch={branch_id}, path={' -> '.join(visited)} -> {current}"
            )
            raise ValueError("Invalid branch payment configuration (cycle detected)")
        visited.add(current)

        resp = (
            supabase.table("branches")
            .select("mp_config_source_branch_id")
            .eq("id", current)
            .limit(1)
            .execute()
        )
        row = (resp.data or [None])[0]
        if not row or not row.get("mp_config_source_branch_id"):
            return current  # this is the final effective branch
        current = row["mp_config_source_branch_id"]

    logger.error(
        f"Max hops exceeded in mp_config_source_branch_id: "
        f"startBranch={branch_id}, path={' -> '.join(visited)}"
    )
    raise ValueError("Invalid branch payment configuration (cycle detected)")


def get_mp_config_from_db(restaurant_id, branch_id=None):
    """
    Fetch MercadoPago config from payment_configs with fallback:
      1) Resolve mp_config_source_branch_id to find effective branch
      2) branch-level (restaurant_id + effective_branch_id)
      3) restaurant-level (restaurant_id + branch_id IS NULL)
    Returns dict with access_token, public_key, webhook_secret, etc. or None.
    """
    from ..db.supabase_client import supabase

    effective_branch_id = branch_id

    # Resolve source branch chain if applicable
    if branch_id:
        effective_branch_id = _resolve_effective_branch_id(branch_id)

    # Try branch-specific config first
    if effective_branch_id:
        resp = (
            supabase.table("payment_configs")
            .select("*")
            .eq("restaurant_id", restaurant_id)
            .eq("branch_id", effective_branch_id)
            .eq("provider", "mercadopago")
            .eq("enabled", True)
            .limit(1)
            .execute()
        )
        if resp.data and len(resp.data) > 0:
            return resp.data[0]

    # Fallback to restaurant-level config
    resp = (
        supabase.table("payment_configs")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .is_("branch_id", "null")
        .eq("provider", "mercadopago")
        .eq("enabled", True)
        .limit(1)
        .execute()
    )
    if resp.data and len(resp.data) > 0:
        return resp.data[0]

    return None


class MercadoPagoService:
    def __init__(self, access_token=None):
        """
        Initialize with explicit access_token, or fall back to global env
        (for development/backward compatibility only).
        """
        self.access_token = access_token or Config.MERCADO_PAGO_ACCESS_TOKEN
        if self.access_token:
            self.sdk = mercadopago.SDK(self.access_token)
        else:
            self.sdk = None

    @staticmethod
    def for_restaurant(restaurant_id, branch_id=None):
        """
        Factory: create MercadoPagoService using credentials from payment_configs.
        Falls back to global env if no DB config found.
        """
        config = get_mp_config_from_db(restaurant_id, branch_id)
        if config and config.get("access_token"):
            return MercadoPagoService(access_token=config["access_token"])
        # Fallback to global env (development only)
        logger.warning(
            f"No payment_configs found for restaurant={restaurant_id}, "
            f"branch={branch_id}. Using global env token as fallback."
        )
        return MercadoPagoService()

    def create_preference(self, order_data):
        """
        Crear una preferencia de pago en Mercado Pago usando el SDK oficial

        Args:
            order_data: dict con informacion del pedido
                - total_amount: float
                - items: list
                - order_id: str
                - mesa_id: str
                - restaurant_id: str (optional)
                - branch_id: str (optional)

        Returns:
            dict con la respuesta de Mercado Pago
        """
        if not self.sdk:
            return {"success": False, "error": "MercadoPago no configurado (sin access_token)"}

        try:
            # Build items for Mercado Pago
            items = []
            for item in order_data["items"]:
                items.append({
                    "title": item["name"],
                    "quantity": item["quantity"],
                    "unit_price": float(item["price"])
                })

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
        Obtener informacion de un pago especifico usando el SDK
        """
        if not self.sdk:
            return {"success": False, "error": "MercadoPago no configurado"}

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
        """
        if not self.sdk:
            return {"success": False, "error": "MercadoPago no configurado"}

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
        Validar la firma del webhook de Mercado Pago.
        Uses webhook_secret from Config or from payment_configs.
        """
        try:
            webhook_secret = Config.MERCADO_PAGO_WEBHOOK_SECRET
            if not webhook_secret:
                logger.warning("No webhook secret configured, skipping validation")
                return True

            # TODO: implement real HMAC-SHA256 validation
            # For now, return True for backward compatibility
            return True
        except Exception as e:
            logger.error(f"Error validando firma: {str(e)}")
            return False
