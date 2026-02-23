import time
import httpx
from typing import Callable, TypeVar

T = TypeVar("T")


def execute_with_retry(fn: Callable[[], T], retries: int = 1, delay: float = 0.15) -> T:
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as exc:
            if not _is_transient_network_error(exc):
                raise
            last_exc = exc
            if attempt >= retries:
                raise
            time.sleep(delay)
            delay *= 2
    if last_exc:
        raise last_exc
    raise RuntimeError("execute_with_retry failed unexpectedly")


def _is_transient_network_error(exc: Exception) -> bool:
    if isinstance(exc, (httpx.TransportError, httpx.TimeoutException)):
        return True

    message = str(exc).lower()
    transient_patterns = (
        "lookup timed out",
        "temporary failure in name resolution",
        "name or service not known",
        "failed to resolve",
        "timed out",
        "timeout",
        "connection reset",
        "network is unreachable",
    )
    return any(pattern in message for pattern in transient_patterns)
