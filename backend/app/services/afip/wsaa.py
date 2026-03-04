import base64
import os
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import requests
from zeep import Client, Settings
from zeep.transports import Transport

from ...db.supabase_client import supabase
from ...utils.retry import execute_with_retry
from .crypto import decrypt_str
from .exceptions import AfipExternalError, AfipNotReadyError


WSAA_WSDL_BY_ENV = {
    "homo": "https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL",
    "prod": "https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL",
}

_WSAA_TIMEOUT_SECONDS = 12
_CACHE_SKEW_SECONDS = 120
_MAX_RETRIES = 1


def _normalize_env(environment: str) -> str:
    raw = (environment or "").strip().lower()
    if raw in {"homo", "homologacion", "homologación", "homologation"}:
        return "homo"
    if raw in {"prod", "produccion", "producción", "production"}:
        return "prod"
    raise AfipNotReadyError("Ambiente AFIP inválido", {"environment": environment})


def _parse_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _get_cached_token(
    restaurant_id: str,
    environment: str,
    service: str,
) -> Optional[Dict[str, str]]:
    def _run():
        return (
            supabase.table("restaurant_afip_tokens")
            .select("token, sign, expires_at")
            .eq("restaurant_id", restaurant_id)
            .eq("environment", environment)
            .eq("service", service)
            .limit(1)
            .execute()
        )

    response = execute_with_retry(_run, retries=1, delay=0.2)
    row = (response.data or [None])[0]
    if not row:
        return None

    expires_at = _parse_datetime(row.get("expires_at"))
    now = datetime.now(timezone.utc) + timedelta(seconds=_CACHE_SKEW_SECONDS)
    if not expires_at or expires_at <= now:
        return None

    token = row.get("token")
    sign = row.get("sign")
    if not token or not sign:
        return None
    return {"token": token, "sign": sign}


def _load_restaurant_credentials(restaurant_id: str) -> Dict[str, str]:
    def _run():
        return (
            supabase.table("restaurant_afip_config")
            .select(
                "enabled, cuit, cert_pem_enc, key_pem_enc, key_pass_enc"
            )
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )

    response = execute_with_retry(_run, retries=1, delay=0.2)
    row = (response.data or [None])[0]
    if not row:
        raise AfipNotReadyError("AFIP no configurado para el restaurante")

    if not bool(row.get("enabled")):
        raise AfipNotReadyError("AFIP está deshabilitado para el restaurante")

    try:
        cert_pem = decrypt_str(row.get("cert_pem_enc") or "")
        key_pem = decrypt_str(row.get("key_pem_enc") or "")
        key_pass_enc = row.get("key_pass_enc")
        key_pass = decrypt_str(key_pass_enc) if key_pass_enc else None
    except Exception as exc:
        raise AfipNotReadyError("No se pudo descifrar certificado/clave AFIP") from exc

    cuit = str(row.get("cuit") or "").strip()
    if not cuit:
        raise AfipNotReadyError("CUIT AFIP no configurado")

    return {
        "cuit": cuit,
        "cert_pem": cert_pem,
        "key_pem": key_pem,
        "key_pass": key_pass or "",
    }


def _build_login_ticket_request(service: str) -> str:
    now = datetime.now(timezone.utc)
    generation_time = now - timedelta(seconds=60)
    expiration_time = now + timedelta(minutes=10)
    unique_id = int(now.timestamp())

    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<loginTicketRequest version=\"1.0\">"
        "<header>"
        f"<uniqueId>{unique_id}</uniqueId>"
        f"<generationTime>{generation_time.isoformat(timespec='seconds')}</generationTime>"
        f"<expirationTime>{expiration_time.isoformat(timespec='seconds')}</expirationTime>"
        "</header>"
        f"<service>{service}</service>"
        "</loginTicketRequest>"
    )


def _safe_unlink(path: Optional[str]) -> None:
    if not path:
        return
    try:
        os.unlink(path)
    except OSError:
        pass


def _sign_cms_with_openssl(
    tra_xml: str,
    cert_pem: str,
    key_pem: str,
    key_passphrase: str = "",
) -> str:
    tra_path = cert_path = key_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".xml",
            dir="/tmp",
            delete=False,
            encoding="utf-8",
        ) as tra_file:
            tra_file.write(tra_xml)
            tra_path = tra_file.name

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".pem",
            dir="/tmp",
            delete=False,
            encoding="utf-8",
        ) as cert_file:
            cert_file.write(cert_pem)
            cert_path = cert_file.name

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".key",
            dir="/tmp",
            delete=False,
            encoding="utf-8",
        ) as key_file:
            key_file.write(key_pem)
            key_path = key_file.name

        cmd = [
            "openssl",
            "smime",
            "-sign",
            "-in",
            tra_path,
            "-signer",
            cert_path,
            "-inkey",
            key_path,
            "-outform",
            "DER",
            "-nodetach",
            "-binary",
        ]
        stdin_data: bytes | None = None
        if key_passphrase:
            cmd.extend(["-passin", "stdin"])
            stdin_data = key_passphrase.encode("utf-8")

        result = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            input=stdin_data,
        )
        return base64.b64encode(result.stdout).decode("ascii")
    except FileNotFoundError as exc:
        raise AfipExternalError("No se encontró openssl en runtime") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or b"").decode("utf-8", errors="ignore")
        raise AfipExternalError(
            "Falló firma CMS para WSAA",
            {"reason": stderr[-500:]},
        ) from exc
    finally:
        _safe_unlink(tra_path)
        _safe_unlink(cert_path)
        _safe_unlink(key_path)


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
        "No se pudo obtener token/sign desde WSAA",
        {"reason": str(last_error) if last_error else "unknown"},
    )


def _call_wsaa_login_cms(cms_b64: str, environment: str) -> str:
    env = _normalize_env(environment)
    session = requests.Session()
    transport = Transport(
        session=session,
        timeout=_WSAA_TIMEOUT_SECONDS,
        operation_timeout=_WSAA_TIMEOUT_SECONDS,
    )
    settings = Settings(strict=False, xml_huge_tree=True)
    client = Client(WSAA_WSDL_BY_ENV[env], transport=transport, settings=settings)
    return client.service.loginCms(cms_b64)


def _find_text_by_local_name(root: ET.Element, local_name: str) -> str:
    for node in root.iter():
        tag = node.tag.split("}")[-1]
        if tag == local_name:
            return (node.text or "").strip()
    return ""


def _parse_login_ticket_response(response_xml: str) -> Dict[str, str]:
    try:
        root = ET.fromstring(response_xml)
    except Exception as exc:
        raise AfipExternalError("Respuesta WSAA inválida") from exc

    token = _find_text_by_local_name(root, "token")
    sign = _find_text_by_local_name(root, "sign")
    expiration = _find_text_by_local_name(root, "expirationTime")
    if not token or not sign or not expiration:
        raise AfipExternalError("WSAA no devolvió token/sign válidos")

    expires_at = _parse_datetime(expiration)
    if not expires_at:
        raise AfipExternalError("No se pudo parsear expirationTime de WSAA")

    return {
        "token": token,
        "sign": sign,
        "expires_at": expires_at.isoformat(),
    }


def _save_token(
    restaurant_id: str,
    environment: str,
    service: str,
    token: str,
    sign: str,
    expires_at: str,
) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "restaurant_id": restaurant_id,
        "environment": environment,
        "service": service,
        "token": token,
        "sign": sign,
        "expires_at": expires_at,
        "updated_at": now_iso,
    }

    def _run():
        return (
            supabase.table("restaurant_afip_tokens")
            .upsert(payload, on_conflict="restaurant_id,environment,service")
            .execute()
        )

    execute_with_retry(_run, retries=1, delay=0.2)


def get_token_sign(
    restaurant_id: str,
    environment: str,
    service: str = "wsfe",
) -> Dict[str, str]:
    env = _normalize_env(environment)
    cached = _get_cached_token(restaurant_id, env, service)
    if cached:
        return cached

    credentials = _load_restaurant_credentials(restaurant_id)
    tra_xml = _build_login_ticket_request(service)
    cms_b64 = _sign_cms_with_openssl(
        tra_xml=tra_xml,
        cert_pem=credentials["cert_pem"],
        key_pem=credentials["key_pem"],
        key_passphrase=credentials["key_pass"],
    )
    response_xml = _run_with_retry(lambda: _call_wsaa_login_cms(cms_b64, env))
    parsed = _parse_login_ticket_response(response_xml)
    _save_token(
        restaurant_id=restaurant_id,
        environment=env,
        service=service,
        token=parsed["token"],
        sign=parsed["sign"],
        expires_at=parsed["expires_at"],
    )
    return {"token": parsed["token"], "sign": parsed["sign"]}
