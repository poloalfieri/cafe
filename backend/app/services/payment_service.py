"""
Servicio para manejar lógica de negocio de pagos (Supabase)
"""
from datetime import datetime, timezone
from typing import Dict, Optional
import uuid

from ..db.supabase_client import supabase
from ..db.models import OrderStatus, PaymentStatus
from ..services.mercadopago_service import MercadoPagoService
from ..services.menu_service import menu_service
from ..utils.logger import setup_logger
from ..utils.token_manager import invalidate_token

logger = setup_logger(__name__)
# Global fallback instance (used only when restaurant context is unavailable)
mp_service = MercadoPagoService()


class PaymentService:
    """Servicio para manejar lógica de negocio de pagos"""
    _payment_ids: Dict[str, str] = {}

    @staticmethod
    def init_payment(monto: float, mesa_id: str, branch_id: Optional[str], descripcion: str, items: list = None) -> Dict:
        """
        Inicializar pago con Mercado Pago Checkout Pro
        """
        PaymentService._validate_required_fields(
            {"mesa_id": mesa_id, "items": items, "branch_id": branch_id},
            ["mesa_id", "items", "branch_id"],
        )
        PaymentService._validate_items(items)

        priced_items, total_amount = PaymentService._price_items_from_menu(items)
        order_token = str(uuid.uuid4())
        now_iso = PaymentService._now_iso()

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

            restaurant_id = mesa.get("restaurant_id")
            mesa_branch_id = mesa.get("branch_id")

            insert_data = {
                "mesa_id": mesa_id,
                "status": OrderStatus.PAYMENT_PENDING.value,
                "token": order_token,
                "total_amount": total_amount,
                "items": priced_items,
                "payment_method": "mercadopago",
                "creation_date": now_iso,
                "updated_at": now_iso,
                "restaurant_id": restaurant_id,
                "branch_id": mesa_branch_id,
            }
            response = supabase.table("orders").insert(insert_data).execute()
            if not response.data:
                raise Exception("No se pudo crear el pedido")

            new_order = response.data[0]

            order_data = {
                "order_id": new_order["id"],
                "total_amount": total_amount,
                "items": priced_items,
                "mesa_id": mesa_id,
            }

            # Use per-restaurant MercadoPago credentials
            restaurant_mp = MercadoPagoService.for_restaurant(
                restaurant_id, mesa_branch_id
            )
            mp_response = restaurant_mp.create_preference(order_data)

            if not mp_response.get("success"):
                supabase.table("orders").delete().eq("id", new_order["id"]).execute()
                raise Exception(mp_response.get("error", "Error al crear preferencia"))

            supabase.table("orders").update(
                {"updated_at": PaymentService._now_iso()}
            ).eq("id", new_order["id"]).execute()

            logger.info(
                f"Pago inicializado - mesa_id: {mesa_id}, monto: {total_amount}, order_id: {new_order['id']}"
            )

            return {
                "success": True,
                "order_id": new_order["id"],
                "order_token": order_token,
                "init_point": mp_response["init_point"],
                "preference_id": mp_response["preference_id"],
            }

        except Exception as e:
            logger.error(f"Error al inicializar pago: {str(e)}")
            raise

    @staticmethod
    def create_preference(total_amount: float, items: list, mesa_id: str) -> Dict:
        """
        Crear preferencia de pago para un pedido
        """
        PaymentService._validate_required_fields(
            {"items": items, "mesa_id": mesa_id},
            ["items", "mesa_id"],
        )
        PaymentService._validate_items(items)
        priced_items, computed_total = PaymentService._price_items_from_menu(items)

        order_data = {
            "total_amount": computed_total,
            "items": priced_items,
            "mesa_id": mesa_id,
        }

        mp_response = mp_service.create_preference(order_data)

        if not mp_response.get("success"):
            raise Exception(mp_response.get("error", "Error al crear preferencia"))

        logger.info(f"Preferencia creada - mesa_id: {mesa_id}, monto: {computed_total}")

        return {
            "success": True,
            "init_point": mp_response["init_point"],
            "preference_id": mp_response["preference_id"],
            "total_amount": computed_total,
        }

    @staticmethod
    def handle_payment_success(payment_id: str, external_reference: str) -> Dict:
        """
        Manejar pago exitoso
        """
        if not payment_id or not external_reference:
            raise ValueError("payment_id y external_reference son requeridos")

        order = PaymentService._get_order(external_reference)
        if not order:
            raise ValueError("Orden no encontrada")

        # Use per-restaurant credentials when available
        restaurant_id = order.get("restaurant_id")
        order_branch_id = order.get("branch_id")
        if restaurant_id:
            order_mp = MercadoPagoService.for_restaurant(restaurant_id, order_branch_id)
        else:
            order_mp = mp_service
        payment_info = order_mp.get_payment_info(payment_id)
        if not payment_info.get("success"):
            raise Exception("Error al obtener información del pago")

        payment_data = payment_info["payment"]
        now_iso = PaymentService._now_iso()

        update_data = {
            "status": OrderStatus.PAYMENT_APPROVED.value,
            "updated_at": now_iso,
        }

        response = (
            supabase.table("orders")
            .update(update_data)
            .eq("id", external_reference)
            .execute()
        )

        if not response.data:
            raise Exception("No se pudo actualizar el pedido")

        PaymentService._payment_ids[external_reference] = payment_id

        logger.info(
            f"Pago aprobado - order_id: {external_reference}, payment_id: {payment_id}"
        )

        try:
            if order.get("branch_id"):
                invalidate_token(order.get("mesa_id"), order.get("branch_id"))
            logger.info(
                f"Token de mesa invalidado tras pago aprobado: mesa_id={order.get('mesa_id')}"
            )
        except Exception as e:
            logger.warning(
                f"No se pudo invalidar token de mesa {order.get('mesa_id')}: {str(e)}"
            )

        return {
            "success": True,
            "order_id": external_reference,
        }

    @staticmethod
    def handle_payment_failure(payment_id: Optional[str], external_reference: Optional[str]) -> None:
        """
        Manejar pago fallido
        """
        if not external_reference:
            logger.warning("Payment failure sin external_reference")
            return

        now_iso = PaymentService._now_iso()
        update_data = {
            "status": OrderStatus.PAYMENT_REJECTED.value,
            "updated_at": now_iso,
        }

        supabase.table("orders").update(update_data).eq("id", external_reference).execute()

        logger.info(f"Pago rechazado - order_id: {external_reference}")

    @staticmethod
    def handle_payment_pending(payment_id: Optional[str], external_reference: Optional[str]) -> Optional[str]:
        """
        Manejar pago pendiente
        """
        if not external_reference:
            logger.warning("Payment pending sin external_reference")
            return None

        update_data = {
            "status": OrderStatus.PAYMENT_PENDING.value,
            "updated_at": PaymentService._now_iso(),
        }

        response = (
            supabase.table("orders")
            .update(update_data)
            .eq("id", external_reference)
            .execute()
        )

        if response.data:
            logger.info(f"Pago pendiente - order_id: {external_reference}")
            return external_reference

        return None

    @staticmethod
    def accept_order(order_id: str) -> Dict:
        """
        Aceptar un pedido y pasar a IN_PREPARATION
        """
        order = PaymentService._get_order(order_id)
        if not order:
            raise ValueError("Orden no encontrada")

        update_data = {
            "status": OrderStatus.IN_PREPARATION.value,
            "updated_at": PaymentService._now_iso(),
        }

        response = (
            supabase.table("orders")
            .update(update_data)
            .eq("id", order_id)
            .execute()
        )

        if not response.data:
            raise Exception("No se pudo actualizar el pedido")

        return response.data[0]

    @staticmethod
    def reject_order(order_id: str) -> Dict:
        """
        Rechazar un pedido y procesar reembolso si corresponde
        """
        order = PaymentService._get_order(order_id)
        if not order:
            raise ValueError("Orden no encontrada")

        refund_id = None
        payment_id = PaymentService._payment_ids.get(order_id)
        if payment_id:
            # Use per-restaurant credentials for refund
            restaurant_id = order.get("restaurant_id")
            order_branch_id = order.get("branch_id")
            if restaurant_id:
                refund_mp = MercadoPagoService.for_restaurant(restaurant_id, order_branch_id)
            else:
                refund_mp = mp_service
            refund_response = refund_mp.refund_payment(payment_id)
            if not refund_response.get("success"):
                raise Exception(refund_response.get("error", "Error al reembolsar"))
            refund_id = refund_response.get("refund_id")

        now_iso = PaymentService._now_iso()
        update_data = {
            "status": OrderStatus.PAYMENT_REJECTED.value,
            "updated_at": now_iso,
        }

        response = (
            supabase.table("orders")
            .update(update_data)
            .eq("id", order_id)
            .execute()
        )

        if not response.data:
            raise Exception("No se pudo actualizar el pedido")

        return response.data[0]

    @staticmethod
    def get_order_status(order_id: str) -> Optional[Dict]:
        order = PaymentService._get_order(order_id)
        if not order:
            return None

        items = order.get("items") or []
        total_amount = 0.0
        for item in items:
            try:
                total_amount += float(item.get("price", 0)) * int(item.get("quantity", 1))
            except Exception:
                continue

        created_at = order.get("created_at") or order.get("creation_date")
        status = order.get("status")
        payment_status = PaymentService._derive_payment_status(status)

        return {
            "order_id": order.get("id"),
            "status": status,
            "payment_status": payment_status,
            "total_amount": float(total_amount),
            "created_at": created_at,
        }

    @staticmethod
    def _get_order(order_id: str) -> Optional[Dict]:
        try:
            response = supabase.table("orders").select("*").eq("id", order_id).execute()
            data = response.data or []
            return data[0] if data else None
        except Exception as e:
            logger.error(f"Error obteniendo orden {order_id}: {str(e)}")
            return None

    @staticmethod
    def _validate_required_fields(data: Dict, fields: list) -> None:
        for field in fields:
            if field not in data or data[field] is None or data[field] == "":
                raise ValueError(f"Campo requerido: {field}")

    @staticmethod
    def _validate_items(items: list) -> None:
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

            priced_items.append(
                {
                    "id": str(menu_item["id"]),
                    "name": menu_item["name"],
                    "quantity": quantity,
                    "price": price,
                }
            )

        return priced_items, round(total, 2)

    @staticmethod
    def _derive_payment_status(status: Optional[str]) -> Optional[str]:
        if not status:
            return None
        if status == OrderStatus.PAYMENT_PENDING.value:
            return PaymentStatus.PENDING.value
        if status == OrderStatus.PAYMENT_REJECTED.value:
            return PaymentStatus.REJECTED.value
        return PaymentStatus.APPROVED.value

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


payment_service = PaymentService()
