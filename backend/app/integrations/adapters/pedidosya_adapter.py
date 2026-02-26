"""
Adapter para PedidosYa.

Autenticación: token estático en header X-PY-Integration-Token.
Deduplicación: campo 'id' del body del webhook.

Placeholder: todas las llamadas outbound son stubs hasta contar con credenciales reales.
Los detalles de autenticación y endpoints se ajustan con los docs de onboarding de PedidosYa.
"""

import secrets
from typing import Dict, List, Optional

from ...utils.logger import setup_logger
from ..provider_adapter import NormalizedEvent, ProviderAdapter

logger = setup_logger(__name__)

TOKEN_HEADER = "X-PY-Integration-Token"


class PedidosYaAdapter(ProviderAdapter):
    provider_name = "pedidosya"

    STATUS_MAP_INBOUND: Dict[str, str] = {
        "RECEIVED": "PAYMENT_APPROVED",   # orden nueva, cajero debe confirmar
        "CONFIRMED": "IN_PREPARATION",
        "DISPATCHED": "READY",
        "DELIVERED": "DELIVERED",
        "CANCELLED": "CANCELLED",
        "REJECTED": "CANCELLED",
    }

    STATUS_MAP_OUTBOUND: Dict[str, str] = {
        "IN_PREPARATION": "CONFIRMED",
        "READY": "DISPATCHED",
        "CANCELLED": "REJECTED",
        "DELIVERED": "DELIVERED",
    }

    # -------------------------------------------------------------------------
    # Inbound
    # -------------------------------------------------------------------------

    def verify_webhook_signature(self, raw_body: bytes, headers: Dict) -> bool:
        """
        Verificar token de integración de PedidosYa.

        Si integration_token está vacío (dev/placeholder): log warning y retornar True.
        Usa secrets.compare_digest para evitar timing attacks.
        """
        integration_token = headers.get("_integration_token", "")  # inyectado por controller

        if not integration_token:
            logger.warning(
                "[pedidosya] No integration_token configurado — omitiendo verificación (dev mode)"
            )
            return True

        received_token = headers.get(TOKEN_HEADER, "")
        if not received_token:
            logger.warning("[pedidosya] Header %s ausente", TOKEN_HEADER)
            return False

        valid = secrets.compare_digest(
            integration_token.encode("utf-8"),
            received_token.encode("utf-8"),
        )
        if not valid:
            logger.warning("[pedidosya] Token de integración inválido")
        return valid

    def parse_webhook_event(self, raw_body: dict, headers: dict) -> NormalizedEvent:
        """
        Parsear payload de PedidosYa.

        PedidosYa envía el estado de la orden en body['status'].
        El campo 'id' es el provider_order_id.
        """
        status = raw_body.get("status", "")
        provider_order_id = str(raw_body.get("id", raw_body.get("order_id", "")))

        if status in ("CANCELLED", "REJECTED"):
            event_type = "order_cancelled"
        elif status == "RECEIVED":
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
        Convertir pedido de PedidosYa al formato interno.

        Estructura esperada de PedidosYa (placeholder — ajustar según docs reales):
        {
          "id": "py-order-456",
          "status": "RECEIVED",
          "totalAmount": 2000,
          "user": {"name": "María García"},
          "details": [
            {"id": "item-1", "name": "Pizza", "amount": 1, "unitPrice": 2000,
             "optionGroups": [{"options": [{"name": "Extra queso"}]}]}
          ],
          "deliveryAddress": {...}
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
        # PedidosYa usa 'details' para los items
        for detail in provider_order.get("details", provider_order.get("products", [])):
            pid = str(detail.get("id", ""))
            name = detail.get("name", "Producto sin nombre")
            qty = int(detail.get("amount", detail.get("quantity", detail.get("qty", 1))))
            price = float(detail.get("unitPrice", detail.get("price", 0)))

            # Extraer opciones de optionGroups si existen
            options = []
            for og in detail.get("optionGroups", []):
                for opt in og.get("options", []):
                    options.append({"name": opt.get("name", str(opt))})

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
                item["selectedOptions"] = options

            items.append(item)

        total = float(provider_order.get("totalAmount", provider_order.get("total", 0)))
        if not total and items:
            total = sum(float(i["price"]) * i["quantity"] for i in items)

        user = provider_order.get("user", {})
        customer_name = user.get("name", "") if isinstance(user, dict) else ""

        return {
            "provider_order_id": provider_order_id,
            "source": "pedidosya",
            "source_data": provider_order,
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
            "mesa_id": f"pedidosya-{provider_order_id}",
            "items": items,
            "total_amount": total,
            "status": "PAYMENT_APPROVED",
            "notes": f"Pedido PedidosYa #{provider_order_id}" + (
                f" — {customer_name}" if customer_name else ""
            ),
        }

    # -------------------------------------------------------------------------
    # Outbound (stubs — reemplazar con API calls reales en onboarding)
    # -------------------------------------------------------------------------

    def confirm_order(self, provider_order_id: str, credentials: dict) -> dict:
        if self._is_stub_mode(credentials):
            logger.info(
                "[pedidosya][STUB] confirm_order provider_order_id=%s — sin credenciales reales",
                provider_order_id,
            )
            return {"ok": True, "stub": True}

        logger.info("[pedidosya] confirm_order provider_order_id=%s", provider_order_id)
        # TODO (onboarding): POST https://api.pedidosya.com/v3/restaurant/orders/{id}/confirm
        # headers = {"Authorization": f"Bearer {credentials.get('api_key', '')}"}
        # response = requests.post(url, headers=headers, timeout=10)
        # response.raise_for_status()
        return {"ok": True, "stub": True, "note": "API call pendiente de onboarding"}

    def reject_order(
        self,
        provider_order_id: str,
        credentials: dict,
        reason: str = "RESTAURANT_CANCELLED",
    ) -> dict:
        if self._is_stub_mode(credentials):
            logger.info(
                "[pedidosya][STUB] reject_order provider_order_id=%s reason=%s — sin credenciales reales",
                provider_order_id,
                reason,
            )
            return {"ok": True, "stub": True}

        logger.info(
            "[pedidosya] reject_order provider_order_id=%s reason=%s",
            provider_order_id,
            reason,
        )
        # TODO (onboarding): POST https://api.pedidosya.com/v3/restaurant/orders/{id}/reject
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
                "[pedidosya] update_order_status: estado interno '%s' no tiene mapeo outbound",
                internal_status,
            )
            return {"ok": True, "skipped": True, "reason": "no_outbound_mapping"}

        if self._is_stub_mode(credentials):
            logger.info(
                "[pedidosya][STUB] update_order_status provider_order_id=%s action=%s — sin credenciales reales",
                provider_order_id,
                provider_action,
            )
            return {"ok": True, "stub": True}

        logger.info(
            "[pedidosya] update_order_status provider_order_id=%s action=%s",
            provider_order_id,
            provider_action,
        )
        # TODO (onboarding): llamada API según provider_action
        return {"ok": True, "stub": True, "note": "API call pendiente de onboarding"}

    def fetch_recent_orders(
        self, credentials: dict, since_minutes: int = 10
    ) -> List[dict]:
        if self._is_stub_mode(credentials):
            logger.debug("[pedidosya][STUB] fetch_recent_orders — sin credenciales reales")
            return []

        logger.info("[pedidosya] fetch_recent_orders since_minutes=%d", since_minutes)
        # TODO (onboarding): GET https://api.pedidosya.com/v3/restaurant/orders?...
        return []
