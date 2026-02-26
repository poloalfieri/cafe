"""
Worker del outbox: loop eventlet que procesa jobs pendientes cada 10 segundos.

Iniciado en create_app() vía eventlet.spawn(run_outbox_worker).
Compatible con el modo eventlet de gunicorn (-w 1 -k eventlet).
"""

import eventlet

from ..utils.logger import setup_logger
from .outbox_service import process_pending_jobs

logger = setup_logger(__name__)

POLL_INTERVAL_SECONDS = 10


def run_outbox_worker() -> None:
    """
    Loop principal del worker.
    Duerme POLL_INTERVAL_SECONDS entre ciclos.
    Los errores no terminan el loop — se loggean y se continúa.
    """
    logger.info("[outbox_worker] Iniciando worker (poll cada %ds)", POLL_INTERVAL_SECONDS)
    while True:
        try:
            process_pending_jobs()
        except Exception as e:
            logger.error("[outbox_worker] Error no manejado en ciclo: %s", str(e), exc_info=True)
        eventlet.sleep(POLL_INTERVAL_SECONDS)
