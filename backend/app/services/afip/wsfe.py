import time
from functools import lru_cache
from typing import Any, Dict

import requests
from zeep import Client, Settings
from zeep.helpers import serialize_object
from zeep.transports import Transport

from .exceptions import AfipExternalError


WSFE_WSDL_BY_ENV = {
    "homo": "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL",
    "prod": "https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL",
}

_SOAP_TIMEOUT_SECONDS = 12
_MAX_RETRIES = 1


def _normalize_env(environment: str) -> str:
    raw = (environment or "").strip().lower()
    if raw in {"homo", "homologacion", "homologación", "homologation"}:
        return "homo"
    if raw in {"prod", "produccion", "producción", "production"}:
        return "prod"
    raise AfipExternalError("Ambiente AFIP inválido", {"environment": environment})


@lru_cache(maxsize=2)
def _get_wsfe_client(environment: str) -> Client:
    env = _normalize_env(environment)
    session = requests.Session()
    transport = Transport(
        session=session,
        timeout=_SOAP_TIMEOUT_SECONDS,
        operation_timeout=_SOAP_TIMEOUT_SECONDS,
    )
    settings = Settings(strict=False, xml_huge_tree=True)
    return Client(WSFE_WSDL_BY_ENV[env], transport=transport, settings=settings)


def _run_with_retry(fn):
    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            return fn()
        except Exception as exc:
            last_error = exc
            transient = isinstance(
                exc,
                (
                    requests.exceptions.Timeout,
                    requests.exceptions.ConnectionError,
                ),
            ) or "timed out" in str(exc).lower()
            if not transient or attempt >= _MAX_RETRIES:
                break
            time.sleep(0.35 * (attempt + 1))

    raise AfipExternalError(
        "Error consultando WSFEv1",
        {"reason": str(last_error) if last_error else "unknown"},
    )


def fe_comp_ultimo_autorizado(
    token: str,
    sign: str,
    cuit: str,
    pto_vta: int,
    cbte_tipo: int,
    environment: str,
) -> int:
    client = _get_wsfe_client(environment)
    auth = {"Token": token, "Sign": sign, "Cuit": int(cuit)}

    response = _run_with_retry(
        lambda: client.service.FECompUltimoAutorizado(
            Auth=auth,
            PtoVta=int(pto_vta),
            CbteTipo=int(cbte_tipo),
        )
    )
    parsed = serialize_object(response)
    if isinstance(parsed, dict):
        return int(parsed.get("CbteNro") or 0)
    return int(parsed or 0)


def fe_cae_solicitar(payload: Dict[str, Any], environment: str) -> Dict[str, Any]:
    client = _get_wsfe_client(environment)
    response = _run_with_retry(
        lambda: client.service.FECAESolicitar(
            Auth=payload["Auth"],
            FeCAEReq=payload["FeCAEReq"],
        )
    )
    return serialize_object(response)
