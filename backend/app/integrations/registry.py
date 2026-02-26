"""
Registro de adapters de proveedores.

Uso: get_adapter("rappi") → RappiAdapter()
"""

from typing import Dict

from .provider_adapter import ProviderAdapter
from .adapters.rappi_adapter import RappiAdapter
from .adapters.pedidosya_adapter import PedidosYaAdapter

_REGISTRY: Dict[str, ProviderAdapter] = {
    "rappi": RappiAdapter(),
    "pedidosya": PedidosYaAdapter(),
}


def get_adapter(provider: str) -> ProviderAdapter:
    """
    Retornar el adapter para un proveedor dado.

    Raises:
        ValueError: si el proveedor no está registrado.
    """
    adapter = _REGISTRY.get(provider)
    if not adapter:
        raise ValueError(
            f"Proveedor '{provider}' no registrado. "
            f"Disponibles: {list(_REGISTRY.keys())}"
        )
    return adapter


def get_all_providers():
    """Retornar lista de nombres de proveedores registrados."""
    return list(_REGISTRY.keys())
