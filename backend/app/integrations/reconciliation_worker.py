"""
Worker de reconciliación: loop eventlet que verifica órdenes perdidas cada 5 minutos.

Para cada sucursal habilitada, llama adapter.fetch_recent_orders() y crea
eventos en el inbox para cualquier orden que no esté ya en nuestra DB.

Iniciado en create_app() vía eventlet.spawn(run_reconciliation_worker).
"""

import eventlet

from ..db.supabase_client import supabase
from ..utils.logger import setup_logger
from ..utils.retry import execute_with_retry
from .inbox_service import _get_existing_order, save_inbox_event, process_inbox_event
from .registry import get_adapter, get_all_providers

logger = setup_logger(__name__)

RECONCILIATION_INTERVAL_SECONDS = 300  # 5 minutos
SINCE_MINUTES = 10                     # ventana de tiempo para buscar órdenes recientes


def run_reconciliation_worker() -> None:
    """
    Loop principal del worker de reconciliación.
    Primero duerme 5 min (para no ejecutarse en el arranque), luego reconcilia.
    """
    logger.info(
        "[reconciliation_worker] Iniciando (cada %ds)", RECONCILIATION_INTERVAL_SECONDS
    )
    while True:
        eventlet.sleep(RECONCILIATION_INTERVAL_SECONDS)  # dormir primero
        try:
            reconcile_all_enabled_branches()
        except Exception as e:
            logger.error(
                "[reconciliation_worker] Error no manejado: %s", str(e), exc_info=True
            )


def reconcile_all_enabled_branches() -> None:
    """
    Verificar órdenes recientes en todos los providers habilitados.
    Para cada orden no existente en nuestra DB: crear inbox event y procesar.
    """
    try:
        resp = execute_with_retry(
            lambda: supabase.table("provider_integration_accounts")
            .select("*")
            .eq("enabled", True)
            .execute()
        )
        accounts = resp.data or []

        if not accounts:
            logger.debug("[reconciliation_worker] No hay providers habilitados")
            return

        for account in accounts:
            provider = account.get("provider")
            restaurant_id = account.get("restaurant_id")
            branch_id = account.get("branch_id")
            credentials = account.get("credentials") or {}

            try:
                _reconcile_account(provider, restaurant_id, branch_id, credentials)
            except Exception as e:
                logger.error(
                    "[reconciliation_worker] Error reconciliando account: provider=%s restaurant=%s branch=%s: %s",
                    provider,
                    restaurant_id,
                    branch_id,
                    str(e),
                )

    except Exception as e:
        logger.error("[reconciliation_worker] Error obteniendo accounts: %s", str(e))


def _reconcile_account(
    provider: str,
    restaurant_id: str,
    branch_id,
    credentials: dict,
) -> None:
    """Reconciliar un account específico (provider + sucursal)."""
    try:
        adapter = get_adapter(provider)
    except ValueError:
        logger.warning(
            "[reconciliation_worker] Adapter desconocido: provider=%s", provider
        )
        return

    logger.info(
        "[reconciliation_worker] Reconciliando: provider=%s restaurant=%s branch=%s",
        provider,
        restaurant_id,
        branch_id,
    )

    try:
        recent_orders = adapter.fetch_recent_orders(
            credentials=credentials,
            since_minutes=SINCE_MINUTES,
        )
    except Exception as e:
        logger.warning(
            "[reconciliation_worker] Error fetching recent orders: provider=%s: %s",
            provider,
            str(e),
        )
        return

    if not recent_orders:
        logger.debug(
            "[reconciliation_worker] Sin órdenes recientes: provider=%s restaurant=%s",
            provider,
            restaurant_id,
        )
        return

    new_count = 0
    for raw_order in recent_orders:
        try:
            # Extraer provider_order_id (los adapters deben tenerlo en campo 'id')
            provider_order_id = str(raw_order.get("id", raw_order.get("order_id", "")))
            if not provider_order_id:
                continue

            # Verificar si ya existe en nuestra DB
            existing = _get_existing_order(provider_order_id, restaurant_id)
            if existing:
                continue

            # No existe → crear inbox event y procesar
            dedupe_key = f"{provider}:reconcile:{provider_order_id}"
            inbox_id, is_duplicate = save_inbox_event(
                provider=provider,
                event_type="order_created",
                dedupe_key=dedupe_key,
                raw_headers={},
                raw_body=raw_order,
                restaurant_id=restaurant_id,
                branch_id=branch_id,
            )

            if inbox_id and not is_duplicate:
                new_count += 1
                # Procesar sincrónicamente en el worker (no necesitamos spawn extra aquí)
                process_inbox_event(inbox_id)

        except Exception as e:
            logger.warning(
                "[reconciliation_worker] Error procesando orden reconciliada: provider=%s provider_order_id=%s: %s",
                provider,
                raw_order.get("id", "?"),
                str(e),
            )

    if new_count:
        logger.info(
            "[reconciliation_worker] Nuevas órdenes reconciliadas: provider=%s restaurant=%s count=%d",
            provider,
            restaurant_id,
            new_count,
        )
