"""
Interfaz base (ABC) para adapters de proveedores de delivery (Rappi, PedidosYa).

Todos los adapters concretos deben implementar esta interfaz.
Las llamadas a APIs externas deben retornar {"ok": True, "stub": True}
cuando no hay credenciales configuradas (modo disabled/dev).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class NormalizedEvent:
    """Evento normalizado proveniente de un webhook de proveedor."""
    provider: str                     # 'rappi' | 'pedidosya'
    event_type: str                   # 'order_created' | 'order_updated' | 'order_cancelled'
    provider_order_id: str            # ID de la orden en el sistema del proveedor
    raw_order: dict                   # payload crudo de la orden del proveedor
    restaurant_id: str
    branch_id: Optional[str] = None


@dataclass
class MappedItem:
    """Item de una orden delivery mapeado (o no) a producto interno."""
    name: str
    quantity: int
    unit_price: float
    provider_product_id: Optional[str] = None
    menu_product_id: Optional[int] = None   # None = sin mapeo (item opaco)
    options: List[dict] = field(default_factory=list)
    stock_tracked: bool = False             # True solo si hay mapeo explícito


class ProviderAdapter(ABC):
    """
    Interfaz base para adapters de proveedores de delivery.

    Patrón de credenciales (igual que payment_configs para MercadoPago):
    - Credenciales de plataforma (globales): ENV vars en Config
    - Credenciales por restaurante/sucursal: provider_integration_accounts.credentials JSONB
    - Cadena de lookup: branch → restaurant → ENV vars

    Modo disabled/stub: si credentials está vacío o no hay creds reales,
    las llamadas outbound loggean la intención y retornan {"ok": True, "stub": True}.
    """

    provider_name: str

    # Mapeo de estados del proveedor → estados internos del sistema
    # Sobreescribir en cada adapter concreto
    STATUS_MAP_INBOUND: Dict[str, str] = {}

    # Mapeo de estados internos → acciones para el proveedor (para el outbox worker)
    STATUS_MAP_OUTBOUND: Dict[str, str] = {}

    # -------------------------------------------------------------------------
    # Inbound: recepción de webhooks
    # -------------------------------------------------------------------------

    @abstractmethod
    def verify_webhook_signature(self, raw_body: bytes, headers: Dict) -> bool:
        """
        Verificar la firma/autenticidad del webhook entrante.

        Si no hay secret configurado (dev mode): log warning y retornar True.
        Si hay secret pero la firma es inválida: retornar False (→ 401).
        """

    @abstractmethod
    def parse_webhook_event(self, raw_body: dict, headers: dict) -> NormalizedEvent:
        """
        Parsear el body crudo del webhook a un NormalizedEvent.

        Debe extraer: provider_order_id, event_type, raw_order.
        restaurant_id y branch_id se inyectan desde el caller (query params).
        """

    @abstractmethod
    def map_provider_order_to_internal(
        self,
        provider_order: dict,
        restaurant_id: str,
        branch_id: Optional[str],
        product_mappings: List[Dict],
    ) -> dict:
        """
        Convertir un pedido del proveedor al formato interno para create_order_from_provider().

        Args:
            provider_order: payload crudo de la orden del proveedor
            restaurant_id: UUID del restaurante
            branch_id: UUID de la sucursal (puede ser None)
            product_mappings: filas de provider_product_mappings para este branch/restaurant
                              [{"provider_product_id": "...", "menu_product_id": 123}, ...]

        Returns:
            dict compatible con order_service.create_order_from_provider()
        """

    def map_provider_status_to_internal(self, provider_status: str) -> Optional[str]:
        """Mapear estado del proveedor → estado interno. None si no hay mapeo."""
        return self.STATUS_MAP_INBOUND.get(provider_status)

    # -------------------------------------------------------------------------
    # Outbound: acciones hacia el proveedor
    # -------------------------------------------------------------------------

    @abstractmethod
    def confirm_order(self, provider_order_id: str, credentials: dict) -> dict:
        """
        Confirmar orden al proveedor (cajero aceptó → IN_PREPARATION).

        Retorna {"ok": True, "stub": True} si no hay credenciales reales.
        Lanza excepción si la API del proveedor retorna error.
        """

    @abstractmethod
    def reject_order(
        self,
        provider_order_id: str,
        credentials: dict,
        reason: str = "RESTAURANT_CANCELLED",
    ) -> dict:
        """
        Rechazar orden al proveedor (cajero rechazó → CANCELLED).

        Retorna {"ok": True, "stub": True} si no hay credenciales reales.
        """

    @abstractmethod
    def update_order_status(
        self,
        provider_order_id: str,
        internal_status: str,
        credentials: dict,
    ) -> dict:
        """
        Actualizar estado de la orden en el proveedor (READY, DELIVERED).

        Usa STATUS_MAP_OUTBOUND para convertir internal_status → acción del proveedor.
        Retorna {"ok": True, "stub": True} si no hay credenciales reales.
        """

    @abstractmethod
    def fetch_recent_orders(
        self, credentials: dict, since_minutes: int = 10
    ) -> List[dict]:
        """
        Obtener órdenes recientes del proveedor (para reconciliación).

        Retorna lista de payloads crudos de órdenes.
        Retorna [] si no hay credenciales reales o el proveedor no soporta este endpoint.
        """

    # -------------------------------------------------------------------------
    # Helpers comunes
    # -------------------------------------------------------------------------

    def _is_stub_mode(self, credentials: dict) -> bool:
        """True si no hay credenciales reales configuradas (modo dev/disabled)."""
        if not credentials:
            return True
        has_any_credential = any(
            v for v in credentials.values() if isinstance(v, str) and v.strip()
        )
        return not has_any_credential
