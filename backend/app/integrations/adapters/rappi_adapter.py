"""
Adapter para Rappi.

Firma: HMAC-SHA256 en header X-Rappi-Hmac-Signature.
Deduplicación: header X-Rappi-Request-Id.

Placeholder: todas las llamadas outbound son stubs hasta contar con credenciales reales.
Los detalles de firma y endpoints se ajustan con los docs de onboarding de Rappi.
"""

import hashlib
import hmac
import uuid
from typing import Dict, List, Optional

from ...utils.logger import setup_logger
from ..provider_adapter import MappedItem, NormalizedEvent, ProviderAdapter

logger = setup_logger(__name__)

HMAC_HEADER = "X-Rappi-Hmac-Signature"
REQUEST_ID_HEADER = "X-Rappi-Request-Id"


class RappiAdapter(ProviderAdapter):
    provider_name = "rappi"

    STATUS_MAP_INBOUND: Dict[str, str] = {
        "created": "PAYMENT_APPROVED",      # orden nueva, cajero debe confirmar
        "accepted": "IN_PREPARATION",
        "ready_for_pickup": "READY",
        "delivered": "DELIVERED",
        "cancelled": "CANCELLED",
        "rejected": "CANCELLED",
    }

    STATUS_MAP_OUTBOUND: Dict[str, str] = {
        "IN_PREPARATION": "ACCEPTED",
        "READY": "READY_FOR_PICKUP",
        "CANCELLED": "REJECTED",
        "DELIVERED": "DELIVERED",
    }

    # -------------------------------------------------------------------------
    # Inbound
    # -------------------------------------------------------------------------

    def verify_webhook_signature(self, raw_body: bytes, headers: Dict) -> bool:
        """
        Verificar HMAC-SHA256 del webhook de Rappi.

        Si webhook_secret está vacío (dev/placeholder): log warning y retornar True.
        """
        webhook_secret = headers.get("_webhook_secret", "")  # inyectado por el controller

        if not webhook_secret:
            logger.warning(
                "[rappi] No webhook_secret configurado — omitiendo verificación de firma (dev mode)"
            )
            return True

        signature = headers.get(HMAC_HEADER, "")
        if not signature:
            logger.warning("[rappi] Header %s ausente", HMAC_HEADER)
            return False

        computed = hmac.new(
            webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        valid = hmac.compare_digest(computed, signature)
        if not valid:
            logger.warning(
                "[rappi] Firma inválida — computed=%s, received=%s",
                computed[:8] + "...",
                signature[:8] + "...",
            )
        return valid

    def parse_webhook_event(self, raw_body: dict, headers: dict) -> NormalizedEvent:
        """
        Parsear payload de Rappi.

        Rappi envía distintos event types; normalizamos a order_created/updated/cancelled.
        El campo 'id' del body es el provider_order_id.
        """
        status = raw_body.get("status", "")
        provider_order_id = str(raw_body.get("id", raw_body.get("order_id", "")))

        if status == "cancelled" or status == "rejected":
            event_type = "order_cancelled"
        elif status == "created":
            event_type = "order_created"
        else:
            event_type = "order_updated"

        return NormalizedEvent(
            provider=self.provider_name,
            event_type=event_type,
            provider_order_id=provider_order_id,
            raw_order=raw_body,
            restaurant_id=raw_body.get("_restaurant_id", ""),  # inyectado por controller
            branch_id=raw_body.get("_branch_id"),
        )

    def map_provider_order_to_internal(
        self,
        provider_order: dict,
        restaurant_id: str,
        branch_id: Optional[str],
        product_mappings: List[Dict],
    ) -> dict:
        """
        Convertir pedido de Rappi al formato interno.

        Estructura esperada de Rappi (placeholder — ajustar según docs reales):
        {
          "id": "rappi-order-123",
          "status": "created",
          "total": 1500,
          "customer": {"name": "Juan Pérez", "phone": "..."},
          "products": [
            {"id": "prod-1", "name": "Hamburguesa", "qty": 2, "price": 750,
             "options": [{"name": "Sin cebolla"}]}
          ],
          "delivery_address": {...},
          "estimated_pickup_time": "2024-01-01T12:30:00Z"
        }
        """
        provider_order_id = str(provider_order.get("id", ""))

        # Construir mapa de product_mappings para lookup rápido
        mapping_lookup: Dict[str, int] = {
            m["provider_product_id"]: m["menu_product_id"]
            for m in product_mappings
            if m.get("provider_product_id")
        }

        items = []
        for product in provider_order.get("products", []):
            pid = str(product.get("id", ""))
            name = product.get("name", "Producto sin nombre")
            qty = int(product.get("qty", product.get("quantity", 1)))
            price = float(product.get("price", 0))
            options = product.get("options", [])

            menu_product_id = mapping_lookup.get(pid)
            item: dict = {
                "name": name,
                "quantity": qty,
                "price": str(price),
                "provider_product_id": pid or None,
            }
            if menu_product_id:
                item["id"] = menu_product_id
                item["stock_tracked"] = True
            else:
                item["stock_tracked"] = False

            if options:
                item["selectedOptions"] = [
                    {"name": opt.get("name", str(opt))} for opt in options
                ]

            items.append(item)

        total = float(provider_order.get("total", sum(
            float(i["price"]) * i["quantity"] for i in items
        )))

        customer = provider_order.get("customer", {})
        customer_name = customer.get("name", "") if isinstance(customer, dict) else ""

        return {
            "provider_order_id": provider_order_id,
            "source": "rappi",
            "source_data": provider_order,
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
            "mesa_id": f"rappi-{provider_order_id}",
            "items": items,
            "total_amount": total,
            "status": "PAYMENT_APPROVED",
            "notes": f"Pedido Rappi #{provider_order_id}" + (
                f" — {customer_name}" if customer_name else ""
            ),
        }

    # -------------------------------------------------------------------------
    # Outbound (stubs — reemplazar con API calls reales en onboarding)
    # -------------------------------------------------------------------------

    def confirm_order(self, provider_order_id: str, credentials: dict) -> dict:
        if self._is_stub_mode(credentials):
            logger.info(
                "[rappi][STUB] confirm_order provider_order_id=%s — sin credenciales reales",
                provider_order_id,
            )
            return {"ok": True, "stub": True}

        logger.info("[rappi] confirm_order provider_order_id=%s", provider_order_id)
        # TODO (onboarding): POST https://services.rappi.com/api/cpgs/v1/orders/{id}/accept
        # headers = {"Authorization": f"Bearer {self._get_token(credentials)}"}
        # response = requests.post(url, headers=headers, timeout=10)
        # response.raise_for_status()
        # return response.json()
        return {"ok": True, "stub": True, "note": "API call pendiente de onboarding"}

    def reject_order(
        self,
        provider_order_id: str,
        credentials: dict,
        reason: str = "RESTAURANT_CANCELLED",
    ) -> dict:
        if self._is_stub_mode(credentials):
            logger.info(
                "[rappi][STUB] reject_order provider_order_id=%s reason=%s — sin credenciales reales",
                provider_order_id,
                reason,
            )
            return {"ok": True, "stub": True}

        logger.info(
            "[rappi] reject_order provider_order_id=%s reason=%s",
            provider_order_id,
            reason,
        )
        # TODO (onboarding): POST https://services.rappi.com/api/cpgs/v1/orders/{id}/reject
        return {"ok": True, "stub": True, "note": "API call pendiente de onboarding"}

    def update_order_status(
        self,
        provider_order_id: str,
        internal_status: str,
        credentials: dict,
    ) -> dict:
        provider_action = self.STATUS_MAP_OUTBOUND.get(internal_status)
        if not provider_action:
            logger.warning(
                "[rappi] update_order_status: estado interno '%s' no tiene mapeo outbound",
                internal_status,
            )
            return {"ok": True, "skipped": True, "reason": "no_outbound_mapping"}

        if self._is_stub_mode(credentials):
            logger.info(
                "[rappi][STUB] update_order_status provider_order_id=%s action=%s — sin credenciales reales",
                provider_order_id,
                provider_action,
            )
            return {"ok": True, "stub": True}

        logger.info(
            "[rappi] update_order_status provider_order_id=%s action=%s",
            provider_order_id,
            provider_action,
        )
        # TODO (onboarding): llamada API según provider_action
        return {"ok": True, "stub": True, "note": "API call pendiente de onboarding"}

    def fetch_recent_orders(
        self, credentials: dict, since_minutes: int = 10
    ) -> List[dict]:
        if self._is_stub_mode(credentials):
            logger.debug("[rappi][STUB] fetch_recent_orders — sin credenciales reales")
            return []

        logger.info("[rappi] fetch_recent_orders since_minutes=%d", since_minutes)
        # TODO (onboarding): GET https://services.rappi.com/api/cpgs/v1/orders?...
        return []
