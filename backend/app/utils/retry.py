import time
import httpx
from typing import Callable, TypeVar

T = TypeVar("T")


def execute_with_retry(fn: Callable[[], T], retries: int = 2, delay: float = 0.15) -> T:
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except httpx.ReadError as exc:
            last_exc = exc
            if attempt >= retries:
                raise
            time.sleep(delay)
            delay *= 2
    if last_exc:
        raise last_exc
    raise RuntimeError("execute_with_retry failed unexpectedly")
