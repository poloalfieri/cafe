"""
Servicio de Outbox para acciones hacia proveedores de delivery.

Todas las llamadas a APIs de proveedores pasan por este outbox:
  - El cajero NO llama la API del proveedor directamente
  - Crea un job en provider_outbox_jobs
  - El outbox_worker lo ejecuta en background con reintentos

Política de reintentos:
  - Max 5 intentos
  - Backoff exponencial: next_retry_at = now + 30s * 2^attempt_count
  - Jobs 'running' por más de 5 min se resetean (stale lock recovery)
  - Jobs que agotan reintentos quedan en status='failed' con last_error
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from ..db.supabase_client import supabase
from ..utils.logger import setup_logger
from ..utils.retry import execute_with_retry

logger = setup_logger(__name__)

STALE_RUNNING_MINUTES = 5
BACKOFF_BASE_SECONDS = 30
MAX_JOBS_PER_CYCLE = 20  # jobs a procesar por ciclo del worker


def create_outbox_job(
    provider: str,
    action: str,
    restaurant_id: str,
    order_id: Optional[str] = None,
    provider_order_id: Optional[str] = None,
    payload: Optional[dict] = None,
    branch_id: Optional[str] = None,
) -> Optional[str]:
    """
    Crear un job en el outbox para ejecutar una acción hacia un proveedor.

    Args:
        provider: 'rappi' | 'pedidosya'
        action: 'confirm_order' | 'reject_order' | 'update_status'
        restaurant_id: UUID del restaurante
        order_id: UUID de la orden interna (opcional)
        provider_order_id: ID de la orden en el proveedor
        payload: datos adicionales para el job (ej. reason para reject)
        branch_id: UUID de la sucursal

    Returns:
        job_id si se creó exitosamente, None si hubo error
    """
    try:
        data = {
            "provider": provider,
            "action": action,
            "order_id": order_id,
            "provider_order_id": provider_order_id,
            "payload": payload or {},
            "status": "pending",
            "attempt_count": 0,
            "max_attempts": 5,
            "next_retry_at": datetime.now(timezone.utc).isoformat(),
            "restaurant_id": restaurant_id,
            "branch_id": branch_id,
        }

        resp = execute_with_retry(
            lambda: supabase.table("provider_outbox_jobs").insert(data).execute()
        )
        rows = resp.data or []
        if not rows:
            logger.error(
                "[outbox] No se pudo crear job: provider=%s action=%s", provider, action
            )
            return None

        job_id = rows[0].get("id")
        logger.info(
            "[outbox] Job creado: job_id=%s provider=%s action=%s order_id=%s provider_order_id=%s",
            job_id,
            provider,
            action,
            order_id,
            provider_order_id,
        )
        return job_id

    except Exception as e:
        logger.error(
            "[outbox] Error creando job provider=%s action=%s: %s", provider, action, str(e)
        )
        return None


def process_pending_jobs() -> None:
    """
    Procesar jobs pendientes del outbox.

    Llamado por el outbox_worker cada 10 segundos.
    Recupera hasta MAX_JOBS_PER_CYCLE jobs y los ejecuta.
    """
    try:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # 1. Recuperar jobs 'running' stale (posible crash del worker anterior)
        stale_cutoff = (now - timedelta(minutes=STALE_RUNNING_MINUTES)).isoformat()
        _reset_stale_running_jobs(stale_cutoff)

        # 2. Obtener jobs 'pending' listos para procesar
        resp = execute_with_retry(
            lambda: supabase.table("provider_outbox_jobs")
            .select("*")
            .eq("status", "pending")
            .lte("next_retry_at", now_iso)
            .limit(MAX_JOBS_PER_CYCLE)
            .execute()
        )
        jobs = resp.data or []

        if not jobs:
            return

        logger.info("[outbox] Procesando %d jobs pendientes", len(jobs))

        for job in jobs:
            _execute_job(job)

    except Exception as e:
        logger.error("[outbox] Error en process_pending_jobs: %s", str(e), exc_info=True)


def _reset_stale_running_jobs(stale_cutoff_iso: str) -> None:
    """Resetear jobs 'running' que llevan más de STALE_RUNNING_MINUTES minutos."""
    try:
        resp = execute_with_retry(
            lambda: supabase.table("provider_outbox_jobs")
            .select("id, provider, action, attempt_count")
            .eq("status", "running")
            .lt("updated_at", stale_cutoff_iso)
            .execute()
        )
        stale_jobs = resp.data or []
        for job in stale_jobs:
            logger.warning(
                "[outbox] Job stale detectado: job_id=%s provider=%s action=%s attempt=%d — reseteando a pending",
                job.get("id"),
                job.get("provider"),
                job.get("action"),
                job.get("attempt_count", 0),
            )
            execute_with_retry(
                lambda: supabase.table("provider_outbox_jobs")
                .update({
                    "status": "pending",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", job["id"])
                .execute()
            )
    except Exception as e:
        logger.warning("[outbox] Error reseteando stale jobs: %s", e)


def _execute_job(job: dict) -> None:
    """Ejecutar un job individual con manejo de errores y reintentos."""
    from .inbox_service import _get_integration_account
    from .registry import get_adapter

    job_id = job.get("id")
    provider = job.get("provider")
    action = job.get("action")
    provider_order_id = job.get("provider_order_id")
    order_id = job.get("order_id")
    restaurant_id = job.get("restaurant_id")
    branch_id = job.get("branch_id")
    payload = job.get("payload") or {}
    attempt_count = int(job.get("attempt_count", 0))
    max_attempts = int(job.get("max_attempts", 5))

    logger.info(
        "[outbox] Ejecutando job: job_id=%s provider=%s action=%s attempt=%d",
        job_id,
        provider,
        action,
        attempt_count + 1,
    )

    # Marcar como running
    now_iso = datetime.now(timezone.utc).isoformat()
    execute_with_retry(
        lambda: supabase.table("provider_outbox_jobs")
        .update({
            "status": "running",
            "attempt_count": attempt_count + 1,
            "updated_at": now_iso,
        })
        .eq("id", job_id)
        .execute()
    )

    try:
        # Obtener adapter
        adapter = get_adapter(provider)

        # Obtener credenciales del restaurante/sucursal
        account = _get_integration_account(restaurant_id, branch_id, provider)
        credentials = (account or {}).get("credentials") or {}

        # Ejecutar la acción según el tipo de job
        result = {}

        if action == "confirm_order":
            result = adapter.confirm_order(provider_order_id, credentials)

        elif action == "reject_order":
            reason = payload.get("reason", "RESTAURANT_CANCELLED")
            result = adapter.reject_order(provider_order_id, credentials, reason)

        elif action == "update_status":
            internal_status = payload.get("internal_status", "")
            if not internal_status:
                raise ValueError("Falta internal_status en payload del job update_status")
            result = adapter.update_order_status(provider_order_id, internal_status, credentials)

        else:
            raise ValueError(f"Acción de job desconocida: '{action}'")

        # Éxito
        logger.info(
            "[outbox] Job completado: job_id=%s provider=%s action=%s result=%s",
            job_id,
            provider,
            action,
            result,
        )
        execute_with_retry(
            lambda: supabase.table("provider_outbox_jobs")
            .update({
                "status": "completed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", job_id)
            .execute()
        )

    except Exception as e:
        error_msg = str(e)
        logger.warning(
            "[outbox] Error en job: job_id=%s provider=%s action=%s attempt=%d/%d error=%s",
            job_id,
            provider,
            action,
            attempt_count + 1,
            max_attempts,
            error_msg,
        )

        new_attempt = attempt_count + 1
        if new_attempt >= max_attempts:
            # Agotar reintentos → DLQ (failed)
            logger.error(
                "[outbox] Job agotó reintentos: job_id=%s provider=%s action=%s — marcando FAILED",
                job_id,
                provider,
                action,
            )
            execute_with_retry(
                lambda: supabase.table("provider_outbox_jobs")
                .update({
                    "status": "failed",
                    "last_error": error_msg[:1000],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", job_id)
                .execute()
            )
        else:
            # Backoff exponencial: 30s * 2^attempt_count
            backoff_seconds = BACKOFF_BASE_SECONDS * (2 ** new_attempt)
            next_retry = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)
            logger.info(
                "[outbox] Reintento programado: job_id=%s next_retry=%s backoff=%ds",
                job_id,
                next_retry.isoformat(),
                backoff_seconds,
            )
            execute_with_retry(
                lambda: supabase.table("provider_outbox_jobs")
                .update({
                    "status": "pending",
                    "last_error": error_msg[:1000],
                    "next_retry_at": next_retry.isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", job_id)
                .execute()
            )
