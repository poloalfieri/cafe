import os
import re
from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import psycopg2
from cryptography import x509
from cryptography.hazmat.primitives import serialization

from ..db.supabase_client import supabase
from ..utils.retry import execute_with_retry
from .afip import (
    AfipError,
    AfipExternalError,
    AfipNotReadyError,
    AfipRejectedError,
    build_qr_image_b64,
    build_qr_url,
    decrypt_str,
    encrypt_str,
)
from .afip.wsaa import get_token_sign
from .afip.wsfe import fe_cae_solicitar, fe_comp_ultimo_autorizado


_CUIT_RE = re.compile(r"^\d{11}$")
_TWO_DECIMALS = Decimal("0.01")
_SIX_DECIMALS = Decimal("0.000001")
_IVA_ALLOWED = {"MONOTRIBUTO", "RI"}
_CBTE_KIND_TO_TIPO = {"A": 1, "B": 6, "C": 11}
_CBTE_TIPO_TO_KIND = {1: "A", 6: "B", 11: "C"}
_NC_KIND_TO_TIPO = {"A": 3, "B": 8, "C": 13}
_NC_TIPO_TO_KIND = {3: "A", 8: "B", 13: "C"}
_ALL_CBTE_TIPO_TO_KIND = {**_CBTE_TIPO_TO_KIND, **_NC_TIPO_TO_KIND}
_DEFAULT_MON_ID = "PES"
_DEFAULT_MON_COTIZ = Decimal("1")
_AR_TZ = ZoneInfo("America/Buenos_Aires")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ar_now() -> datetime:
    return datetime.now(_AR_TZ)


def _normalize_environment(environment: Optional[str]) -> str:
    raw = (environment or "").strip().lower()
    if raw in {"homo", "homologacion", "homologación", "homologation"}:
        return "homo"
    if raw in {"prod", "produccion", "producción", "production"}:
        return "prod"
    raise AfipNotReadyError("environment inválido", {"environment": environment})


def _to_decimal(value: Any, scale: Decimal = _TWO_DECIMALS) -> Decimal:
    if value is None or value == "":
        return Decimal("0").quantize(scale, rounding=ROUND_HALF_UP)
    try:
        return Decimal(str(value)).quantize(scale, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0").quantize(scale, rounding=ROUND_HALF_UP)


def _to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in {"1", "true", "t", "yes", "si", "sí", "on"}:
        return True
    if text in {"0", "false", "f", "no", "off"}:
        return False
    return default


def _extract_digits(value: Any) -> str:
    if value is None:
        return ""
    return "".join(ch for ch in str(value) if ch.isdigit())


def _format_cbte(pto_vta: int, cbte_nro: int) -> str:
    return f"{int(pto_vta):04d}-{int(cbte_nro):08d}"


def _parse_afip_date(raw_value: Any) -> date:
    raw = str(raw_value or "").strip()
    if not raw:
        return _utc_now().date()
    try:
        if len(raw) == 8 and raw.isdigit():
            return datetime.strptime(raw, "%Y%m%d").date()
        return datetime.fromisoformat(raw).date()
    except Exception:
        return _utc_now().date()


def _as_list(value: Any) -> List[Dict[str, Any]]:
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [value]
    return []


class AfipService:
    @staticmethod
    def _fetch_config_row(restaurant_id: str) -> Optional[Dict[str, Any]]:
        def _run():
            return (
                supabase.table("restaurant_afip_config")
                .select("*")
                .eq("restaurant_id", restaurant_id)
                .limit(1)
                .execute()
            )

        response = execute_with_retry(_run, retries=1, delay=0.2)
        return (response.data or [None])[0]

    @staticmethod
    def _fetch_branch_row(restaurant_id: str, branch_id: str) -> Optional[Dict[str, Any]]:
        def _run():
            return (
                supabase.table("branches")
                .select(
                    "id, name, restaurant_id, afip_pto_vta, afip_share_pto_vta_branch_id"
                )
                .eq("id", branch_id)
                .eq("restaurant_id", restaurant_id)
                .limit(1)
                .execute()
            )

        response = execute_with_retry(_run, retries=1, delay=0.2)
        return (response.data or [None])[0]

    @staticmethod
    def _fetch_branches(restaurant_id: str) -> List[Dict[str, Any]]:
        def _run():
            return (
                supabase.table("branches")
                .select("id, name, afip_pto_vta, afip_share_pto_vta_branch_id")
                .eq("restaurant_id", restaurant_id)
                .order("created_at", desc=False)
                .execute()
            )

        response = execute_with_retry(_run, retries=1, delay=0.2)
        return response.data or []

    @staticmethod
    def _fetch_order_for_restaurant(
        restaurant_id: str,
        order_id: str,
        branch_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        def _run():
            query = (
                supabase.table("orders")
                .select("*")
                .eq("id", order_id)
                .eq("restaurant_id", restaurant_id)
                .limit(1)
            )
            if branch_id:
                query = query.eq("branch_id", branch_id)
            return query.execute()

        response = execute_with_retry(_run, retries=1, delay=0.2)
        return (response.data or [None])[0]

    @staticmethod
    def _fetch_invoice(
        restaurant_id: str,
        invoice_id: str,
        branch_scope_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        def _run():
            query = (
                supabase.table("invoices")
                .select("*")
                .eq("id", invoice_id)
                .eq("restaurant_id", restaurant_id)
                .limit(1)
            )
            if branch_scope_id:
                query = query.eq("branch_id", branch_scope_id)
            return query.execute()

        response = execute_with_retry(_run, retries=1, delay=0.2)
        return (response.data or [None])[0]

    @staticmethod
    def _resolve_effective_pto_vta(
        restaurant_id: str,
        branch_id: str,
    ) -> Tuple[Dict[str, Any], int, Optional[Dict[str, Any]]]:
        branch = AfipService._fetch_branch_row(restaurant_id, branch_id)
        if not branch:
            raise AfipNotReadyError("Sucursal no encontrada")

        share_branch_id = branch.get("afip_share_pto_vta_branch_id")
        if share_branch_id:
            source_branch = AfipService._fetch_branch_row(restaurant_id, share_branch_id)
            if not source_branch:
                raise AfipNotReadyError(
                    "La sucursal fuente para compartir punto de venta no existe",
                    {"branch_id": branch_id, "shared_branch_id": share_branch_id},
                )
            pto_vta = source_branch.get("afip_pto_vta")
            if not pto_vta:
                raise AfipNotReadyError(
                    "La sucursal fuente no tiene afip_pto_vta configurado",
                    {"branch_id": branch_id, "shared_branch_id": share_branch_id},
                )
            return branch, int(pto_vta), source_branch

        pto_vta = branch.get("afip_pto_vta")
        if not pto_vta:
            raise AfipNotReadyError(
                "La sucursal no tiene afip_pto_vta configurado",
                {"branch_id": branch_id},
            )
        return branch, int(pto_vta), None

    @staticmethod
    def _ensure_config_ready(config_row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not config_row:
            raise AfipNotReadyError("AFIP no configurado")
        if not _to_bool(config_row.get("enabled"), default=False):
            raise AfipNotReadyError("AFIP está deshabilitado para este restaurante")
        if not config_row.get("cert_pem_enc") or not config_row.get("key_pem_enc"):
            raise AfipNotReadyError("Faltan certificado o clave AFIP")

        cuit = str(config_row.get("cuit") or "").strip()
        if not _CUIT_RE.match(cuit):
            raise AfipNotReadyError("CUIT AFIP inválido")

        iva_condition = str(config_row.get("iva_condition") or "").strip().upper()
        if iva_condition not in _IVA_ALLOWED:
            raise AfipNotReadyError("Condición IVA inválida")

        environment = _normalize_environment(config_row.get("environment") or "homo")
        return {
            "cuit": cuit,
            "iva_condition": iva_condition,
            "environment": environment,
        }

    @staticmethod
    def _validate_and_prepare_cert(cert_pem: str) -> x509.Certificate:
        cert_text = (cert_pem or "").strip()
        if "BEGIN CERTIFICATE" not in cert_text:
            raise ValueError("Certificado PEM inválido")
        try:
            return x509.load_pem_x509_certificate(cert_text.encode("utf-8"))
        except Exception as exc:
            raise ValueError("No se pudo parsear el certificado PEM") from exc

    @staticmethod
    def _validate_and_prepare_key(
        key_pem: str,
        passphrase: Optional[str],
    ) -> Tuple[Any, str]:
        key_text = (key_pem or "").strip()
        if "BEGIN" not in key_text or "PRIVATE KEY" not in key_text:
            raise ValueError("Clave privada PEM inválida")

        password = passphrase.encode("utf-8") if passphrase else None
        try:
            private_key = serialization.load_pem_private_key(
                key_text.encode("utf-8"),
                password=password,
            )
        except TypeError as exc:
            raise ValueError("La clave privada requiere passphrase") from exc
        except ValueError as exc:
            raise ValueError("No se pudo parsear la clave privada PEM") from exc

        normalized_key = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
        return private_key, normalized_key

    @staticmethod
    def _validate_key_matches_cert(cert: x509.Certificate, private_key: Any) -> None:
        cert_pub = cert.public_key().public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        key_pub = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        if cert_pub != key_pub:
            raise ValueError("El certificado y la clave privada no corresponden")

    @staticmethod
    def get_admin_config(restaurant_id: str) -> Dict[str, Any]:
        config = AfipService._fetch_config_row(restaurant_id)
        branches = AfipService._fetch_branches(restaurant_id)

        branch_map = {branch["id"]: branch for branch in branches}
        serialized_branches = []
        for branch in branches:
            source_id = branch.get("afip_share_pto_vta_branch_id")
            source_branch = branch_map.get(source_id) if source_id else None
            effective_pto = source_branch.get("afip_pto_vta") if source_branch else branch.get("afip_pto_vta")
            serialized_branches.append(
                {
                    "id": branch.get("id"),
                    "name": branch.get("name"),
                    "afip_pto_vta": branch.get("afip_pto_vta"),
                    "afip_share_pto_vta_branch_id": source_id,
                    "effective_afip_pto_vta": effective_pto,
                    "effective_source_branch_id": source_id if source_branch else branch.get("id"),
                }
            )

        has_cert = bool(config and config.get("cert_pem_enc"))
        has_key = bool(config and config.get("key_pem_enc"))
        enabled = bool(config and config.get("enabled"))
        has_any_branch_pto = any(bool(branch.get("effective_afip_pto_vta")) for branch in serialized_branches)

        cert_not_after = None
        if has_cert:
            try:
                cert_pem = decrypt_str(config["cert_pem_enc"])
                cert_obj = x509.load_pem_x509_certificate(cert_pem.encode("utf-8"))
                cert_not_after = cert_obj.not_valid_after_utc.isoformat()
            except Exception:
                pass

        return {
            "configured": bool(config),
            "enabled": enabled,
            "cuit": (config or {}).get("cuit"),
            "iva_condition": (config or {}).get("iva_condition"),
            "environment": (config or {}).get("environment") or "homo",
            "has_certificate": has_cert,
            "has_private_key": has_key,
            "cert_not_after": cert_not_after,
            "ready": bool(enabled and has_cert and has_key and has_any_branch_pto),
            "branches": serialized_branches,
        }

    @staticmethod
    def upsert_admin_config(
        restaurant_id: str,
        payload: Dict[str, Any],
        cert_pem: Optional[str],
        key_pem: Optional[str],
        key_passphrase: Optional[str],
    ) -> Dict[str, Any]:
        existing = AfipService._fetch_config_row(restaurant_id)
        cuit = str(payload.get("cuit") or (existing or {}).get("cuit") or "").strip()
        iva_condition = str(
            payload.get("iva_condition") or (existing or {}).get("iva_condition") or ""
        ).strip().upper()
        environment = _normalize_environment(
            payload.get("environment") or (existing or {}).get("environment") or "homo"
        )
        enabled = _to_bool(
            payload.get("enabled"),
            default=bool((existing or {}).get("enabled", False)),
        )

        if not _CUIT_RE.match(cuit):
            raise ValueError("CUIT inválido. Debe tener 11 dígitos")
        if iva_condition not in _IVA_ALLOWED:
            raise ValueError("iva_condition inválido. Valores: MONOTRIBUTO o RI")

        cert_obj = None
        key_obj = None
        normalized_key_pem = None

        cert_to_store = cert_pem.strip() if cert_pem else None
        if cert_to_store:
            cert_obj = AfipService._validate_and_prepare_cert(cert_to_store)

        if key_pem:
            key_obj, normalized_key_pem = AfipService._validate_and_prepare_key(
                key_pem,
                key_passphrase,
            )

        if cert_obj and key_obj:
            AfipService._validate_key_matches_cert(cert_obj, key_obj)

        cert_pem_enc = encrypt_str(cert_to_store) if cert_to_store else (existing or {}).get("cert_pem_enc")
        key_pem_enc = (
            encrypt_str(normalized_key_pem)
            if normalized_key_pem
            else (existing or {}).get("key_pem_enc")
        )

        if not cert_pem_enc or not key_pem_enc:
            raise ValueError("Debe informar certificado y clave privada para AFIP")

        now_iso = _utc_now().isoformat()
        upsert_payload = {
            "restaurant_id": restaurant_id,
            "cuit": cuit,
            "iva_condition": iva_condition,
            "environment": environment,
            "cert_pem_enc": cert_pem_enc,
            "key_pem_enc": key_pem_enc,
            # Guardamos null para no persistir passphrase innecesariamente.
            "key_pass_enc": None,
            "enabled": bool(enabled),
            "updated_at": now_iso,
        }

        def _run():
            return (
                supabase.table("restaurant_afip_config")
                .upsert(upsert_payload, on_conflict="restaurant_id")
                .execute()
            )

        execute_with_retry(_run, retries=1, delay=0.2)
        return AfipService.get_admin_config(restaurant_id)

    @staticmethod
    def update_branch_pto_vta(
        restaurant_id: str,
        branch_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        branch = AfipService._fetch_branch_row(restaurant_id, branch_id)
        if not branch:
            raise ValueError("Sucursal no encontrada")

        share_branch_id = payload.get("afip_share_pto_vta_branch_id")
        pto_raw = payload.get("afip_pto_vta")

        has_share = share_branch_id is not None and str(share_branch_id).strip() != ""
        has_pto = pto_raw is not None and str(pto_raw).strip() != ""
        if has_share and has_pto:
            raise ValueError("No se puede setear afip_pto_vta y share branch al mismo tiempo")

        update_payload: Dict[str, Any] = {}
        if has_share:
            share_branch_id = str(share_branch_id).strip()
            if share_branch_id == branch_id:
                raise ValueError("No se puede compartir punto de venta con la misma sucursal")
            source_branch = AfipService._fetch_branch_row(restaurant_id, share_branch_id)
            if not source_branch:
                raise ValueError("Sucursal fuente para compartir no encontrada")
            update_payload["afip_share_pto_vta_branch_id"] = share_branch_id
            update_payload["afip_pto_vta"] = None
        elif has_pto:
            try:
                pto_vta = int(str(pto_raw))
            except Exception as exc:
                raise ValueError("afip_pto_vta debe ser numérico") from exc
            if pto_vta <= 0:
                raise ValueError("afip_pto_vta debe ser mayor a 0")
            update_payload["afip_pto_vta"] = pto_vta
            update_payload["afip_share_pto_vta_branch_id"] = None
        else:
            update_payload["afip_pto_vta"] = None
            update_payload["afip_share_pto_vta_branch_id"] = None

        def _run():
            return (
                supabase.table("branches")
                .update(update_payload)
                .eq("id", branch_id)
                .eq("restaurant_id", restaurant_id)
                .execute()
            )

        response = execute_with_retry(_run, retries=1, delay=0.2)
        updated = (response.data or [None])[0]
        if not updated:
            raise ValueError("No se pudo actualizar la sucursal")
        return updated

    @staticmethod
    @contextmanager
    def _advisory_lock(cuit: str, pto_vta: int, cbte_tipo: int):
        database_url = (os.getenv("DATABASE_URL") or "").strip()
        if not database_url.startswith(("postgres://", "postgresql://")):
            raise AfipNotReadyError(
                "DATABASE_URL debe apuntar a PostgreSQL para usar AFIP"
            )

        conn = None
        try:
            conn = psycopg2.connect(database_url)
            conn.autocommit = False
            with conn.cursor() as cursor:
                lock_key = f"{cuit}-{pto_vta}-{cbte_tipo}"
                cursor.execute(
                    "SELECT pg_advisory_xact_lock(hashtext(%s));",
                    (lock_key,),
                )
            yield
            conn.commit()
        except Exception:
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()

    @staticmethod
    def _resolve_cbte_kind_and_tipo(
        iva_condition: str,
        requested_kind: str,
        customer: Dict[str, Any],
    ) -> Tuple[str, int]:
        requested = (requested_kind or "auto").strip().upper()

        if iva_condition == "MONOTRIBUTO":
            if requested in {"A", "B"}:
                raise AfipError(
                    code="AFIP_INVALID_REQUEST",
                    message="Monotributo solo puede emitir Factura C",
                    status_code=400,
                )
            return "C", _CBTE_KIND_TO_TIPO["C"]

        if requested in {"A", "B"}:
            return requested, _CBTE_KIND_TO_TIPO[requested]
        if requested == "C":
            raise AfipError(
                code="AFIP_INVALID_REQUEST",
                message="RI no puede emitir Factura C en este flujo",
                status_code=400,
            )

        customer_iva = str(
            customer.get("iva_condition")
            or customer.get("vat_condition")
            or customer.get("tax_condition")
            or ""
        ).strip().upper()
        receiver_cuit = _extract_digits(customer.get("cuit") or customer.get("doc_nro"))

        if customer_iva in {"RI", "RESPONSABLE_INSCRIPTO"} and _CUIT_RE.match(receiver_cuit):
            return "A", _CBTE_KIND_TO_TIPO["A"]

        return "B", _CBTE_KIND_TO_TIPO["B"]

    @staticmethod
    def _resolve_doc(customer: Dict[str, Any]) -> Tuple[int, int]:
        receiver_cuit = _extract_digits(customer.get("cuit") or customer.get("doc_nro"))
        if _CUIT_RE.match(receiver_cuit):
            return 80, int(receiver_cuit)
        return 99, 0

    @staticmethod
    def _build_amounts(
        totals_payload: Dict[str, Any],
        cbte_kind: str,
    ) -> Dict[str, Any]:
        totals = totals_payload or {}
        imp_total = _to_decimal(
            totals.get("imp_total")
            or totals.get("total")
            or totals.get("total_amount")
            or totals.get("amount")
        )
        if imp_total <= Decimal("0"):
            raise AfipError(
                code="AFIP_INVALID_REQUEST",
                message="total inválido para facturación",
                status_code=400,
            )

        imp_tot_conc = _to_decimal(totals.get("imp_tot_conc") or totals.get("non_taxed"))
        imp_op_ex = _to_decimal(totals.get("imp_op_ex") or totals.get("exempt"))
        imp_trib = _to_decimal(totals.get("imp_trib") or totals.get("tributes"))
        mon_id = str(totals.get("mon_id") or _DEFAULT_MON_ID).strip().upper()
        mon_cotiz = _to_decimal(
            totals.get("mon_cotiz") or totals.get("exchange_rate") or _DEFAULT_MON_COTIZ,
            scale=_SIX_DECIMALS,
        )
        taxable_pool = max(imp_total - imp_tot_conc - imp_op_ex - imp_trib, Decimal("0"))

        iva_items_payload = totals.get("iva_items") or totals.get("iva_breakdown") or []
        iva_items: List[Dict[str, Any]] = []

        if cbte_kind == "C":
            imp_iva = Decimal("0").quantize(_TWO_DECIMALS, rounding=ROUND_HALF_UP)
            imp_neto = taxable_pool.quantize(_TWO_DECIMALS, rounding=ROUND_HALF_UP)
        else:
            imp_neto_input = totals.get("imp_neto") or totals.get("net")
            imp_iva_input = totals.get("imp_iva") or totals.get("iva")
            if isinstance(imp_iva_input, list):
                imp_iva_input = None

            if imp_neto_input not in (None, "") and imp_iva_input not in (None, ""):
                imp_neto = _to_decimal(imp_neto_input)
                imp_iva = _to_decimal(imp_iva_input)
            elif imp_neto_input not in (None, ""):
                imp_neto = _to_decimal(imp_neto_input)
                imp_iva = max(taxable_pool - imp_neto, Decimal("0")).quantize(
                    _TWO_DECIMALS, rounding=ROUND_HALF_UP
                )
            elif imp_iva_input not in (None, ""):
                imp_iva = _to_decimal(imp_iva_input)
                imp_neto = max(taxable_pool - imp_iva, Decimal("0")).quantize(
                    _TWO_DECIMALS, rounding=ROUND_HALF_UP
                )
            else:
                imp_neto = (taxable_pool / Decimal("1.21")).quantize(
                    _TWO_DECIMALS, rounding=ROUND_HALF_UP
                )
                imp_iva = (taxable_pool - imp_neto).quantize(
                    _TWO_DECIMALS, rounding=ROUND_HALF_UP
                )

            for item in iva_items_payload:
                if not isinstance(item, dict):
                    continue
                iva_id = int(item.get("id") or item.get("iva_id") or 5)
                base_imp = _to_decimal(item.get("base") or item.get("base_imp") or imp_neto)
                importe = _to_decimal(item.get("amount") or item.get("importe") or imp_iva)
                iva_items.append(
                    {
                        "Id": iva_id,
                        "BaseImp": float(base_imp),
                        "Importe": float(importe),
                    }
                )

            if not iva_items and imp_iva > Decimal("0"):
                iva_items.append(
                    {
                        "Id": 5,
                        "BaseImp": float(imp_neto),
                        "Importe": float(imp_iva),
                    }
                )

        return {
            "ImpTotal": float(imp_total),
            "ImpTotConc": float(imp_tot_conc),
            "ImpNeto": float(imp_neto),
            "ImpOpEx": float(imp_op_ex),
            "ImpIVA": float(imp_iva),
            "ImpTrib": float(imp_trib),
            "MonId": mon_id or _DEFAULT_MON_ID,
            "MonCotiz": float(mon_cotiz),
            "IvaItems": iva_items,
        }

    @staticmethod
    def _build_fecae_payload(
        token: str,
        sign: str,
        cuit: str,
        pto_vta: int,
        cbte_tipo: int,
        cbte_nro: int,
        doc_tipo: int,
        doc_nro: int,
        amounts: Dict[str, Any],
    ) -> Dict[str, Any]:
        cbte_fch = _ar_now().strftime("%Y%m%d")
        detail: Dict[str, Any] = {
            "Concepto": 1,
            "DocTipo": int(doc_tipo),
            "DocNro": int(doc_nro),
            "CbteDesde": int(cbte_nro),
            "CbteHasta": int(cbte_nro),
            "CbteFch": cbte_fch,
            "ImpTotal": amounts["ImpTotal"],
            "ImpTotConc": amounts["ImpTotConc"],
            "ImpNeto": amounts["ImpNeto"],
            "ImpOpEx": amounts["ImpOpEx"],
            "ImpTrib": amounts["ImpTrib"],
            "ImpIVA": amounts["ImpIVA"],
            "MonId": amounts["MonId"],
            "MonCotiz": amounts["MonCotiz"],
        }

        iva_items = amounts.get("IvaItems") or []
        if iva_items:
            detail["Iva"] = {"AlicIva": iva_items}

        return {
            "Auth": {
                "Token": token,
                "Sign": sign,
                "Cuit": int(cuit),
            },
            "FeCAEReq": {
                "FeCabReq": {
                    "CantReg": 1,
                    "PtoVta": int(pto_vta),
                    "CbteTipo": int(cbte_tipo),
                },
                "FeDetReq": {
                    "FECAEDetRequest": [detail],
                },
            },
        }

    @staticmethod
    def _parse_fe_response(response: Dict[str, Any], fallback_cbte_nro: int) -> Dict[str, Any]:
        cab = response.get("FeCabResp") or {}
        det = response.get("FeDetResp") or {}
        details = _as_list(det.get("FECAEDetResponse"))
        detail = details[0] if details else {}

        errors = []
        global_errors = _as_list((response.get("Errors") or {}).get("Err"))
        for err in global_errors:
            errors.append(
                {
                    "code": str(err.get("Code") or ""),
                    "message": str(err.get("Msg") or ""),
                }
            )

        observations = _as_list((detail.get("Observaciones") or {}).get("Obs"))
        for obs in observations:
            errors.append(
                {
                    "code": str(obs.get("Code") or ""),
                    "message": str(obs.get("Msg") or ""),
                }
            )

        resultado = str(
            detail.get("Resultado")
            or cab.get("Resultado")
            or ""
        ).strip().upper()

        cae = str(detail.get("CAE") or "").strip()
        cae_vto_raw = detail.get("CAEFchVto")
        cbte_nro = int(detail.get("CbteDesde") or fallback_cbte_nro)

        approved = resultado == "A" and bool(cae)
        return {
            "approved": approved,
            "resultado": resultado,
            "cae": cae if cae else "0",
            "cae_vto": _parse_afip_date(cae_vto_raw).isoformat(),
            "cbte_nro": cbte_nro,
            "errors": errors,
        }

    @staticmethod
    def _persist_invoice(record: Dict[str, Any]) -> Dict[str, Any]:
        def _run():
            return supabase.table("invoices").insert(record).execute()

        try:
            response = execute_with_retry(_run, retries=1, delay=0.2)
            invoice = (response.data or [None])[0]
            if not invoice:
                raise AfipExternalError("No se pudo guardar la factura")
            return invoice
        except Exception as exc:
            exc_str = str(exc).lower()
            is_duplicate = (
                "23505" in exc_str
                or "duplicate" in exc_str
                or "unique" in exc_str
            )
            if not is_duplicate:
                raise

            def _lookup():
                return (
                    supabase.table("invoices")
                    .select("*")
                    .eq("cuit", record["cuit"])
                    .eq("pto_vta", record["pto_vta"])
                    .eq("cbte_tipo", record["cbte_tipo"])
                    .eq("cbte_nro", record["cbte_nro"])
                    .limit(1)
                    .execute()
                )

            lookup_response = execute_with_retry(_lookup, retries=1, delay=0.2)
            invoice = (lookup_response.data or [None])[0]
            if invoice:
                return invoice
            raise AfipExternalError("No se pudo recuperar factura existente") from exc

    @staticmethod
    def _build_invoice_printed_fields(invoice: Dict[str, Any]) -> Dict[str, Any]:
        pto_vta = int(invoice.get("pto_vta") or 0)
        cbte_nro = int(invoice.get("cbte_nro") or 0)
        cbte_tipo = int(invoice.get("cbte_tipo") or 0)
        kind = _ALL_CBTE_TIPO_TO_KIND.get(cbte_tipo, str(cbte_tipo))
        return {
            "cbte": _format_cbte(pto_vta, cbte_nro),
            "cbte_tipo": cbte_tipo,
            "cbte_kind": kind,
            "cae": invoice.get("cae"),
            "cae_vto": str(invoice.get("cae_vto")),
            "doc_tipo": int(invoice.get("doc_tipo") or 0),
            "doc_nro": int(invoice.get("doc_nro") or 0),
            "imp_total": float(invoice.get("imp_total") or 0),
            "qr_url": invoice.get("qr_url") or "",
        }

    @staticmethod
    def test_connection(
        restaurant_id: str,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        config_row = AfipService._fetch_config_row(restaurant_id)
        config = AfipService._ensure_config_ready(config_row)

        target_branch_id = branch_id
        if not target_branch_id:
            branches = AfipService._fetch_branches(restaurant_id)
            for branch in branches:
                try:
                    AfipService._resolve_effective_pto_vta(restaurant_id, branch["id"])
                    target_branch_id = branch["id"]
                    break
                except AfipNotReadyError:
                    continue
        if not target_branch_id:
            raise AfipNotReadyError("No hay sucursal con punto de venta AFIP configurado")

        _, pto_vta, _ = AfipService._resolve_effective_pto_vta(restaurant_id, target_branch_id)
        token_sign = get_token_sign(
            restaurant_id=restaurant_id,
            environment=config["environment"],
            service="wsfe",
        )
        ultimo = fe_comp_ultimo_autorizado(
            token=token_sign["token"],
            sign=token_sign["sign"],
            cuit=config["cuit"],
            pto_vta=pto_vta,
            cbte_tipo=_CBTE_KIND_TO_TIPO["C"],
            environment=config["environment"],
        )
        return {
            "ok": True,
            "environment": config["environment"],
            "branch_id": target_branch_id,
            "pto_vta": pto_vta,
            "ultimo_cbte_c": int(ultimo),
        }

    @staticmethod
    def authorize_invoice(
        restaurant_id: str,
        payload: Dict[str, Any],
        user_branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        branch_id = (
            payload.get("branch_id")
            or payload.get("branchId")
            or user_branch_id
        )
        if not branch_id:
            raise AfipError(
                code="AFIP_INVALID_REQUEST",
                message="branch_id requerido",
                status_code=400,
            )

        config_row = AfipService._fetch_config_row(restaurant_id)
        config = AfipService._ensure_config_ready(config_row)
        branch, pto_vta, source_branch = AfipService._resolve_effective_pto_vta(
            restaurant_id,
            branch_id,
        )

        customer = payload.get("customer") or payload.get("customer_info") or {}
        requested_kind = str(payload.get("requested_cbte_kind") or "auto")
        cbte_kind, cbte_tipo = AfipService._resolve_cbte_kind_and_tipo(
            config["iva_condition"],
            requested_kind,
            customer,
        )
        doc_tipo, doc_nro = AfipService._resolve_doc(customer)
        if cbte_kind == "A" and doc_tipo != 80:
            raise AfipError(
                code="AFIP_INVALID_REQUEST",
                message="Factura A requiere CUIT del receptor",
                status_code=400,
            )

        totals_payload = payload.get("totals") or {}
        if not totals_payload and payload.get("total_amount"):
            totals_payload = {"total": payload.get("total_amount")}
        amounts = AfipService._build_amounts(totals_payload, cbte_kind)

        token_sign = get_token_sign(
            restaurant_id=restaurant_id,
            environment=config["environment"],
            service="wsfe",
        )

        with AfipService._advisory_lock(config["cuit"], pto_vta, cbte_tipo):
            ultimo_nro = fe_comp_ultimo_autorizado(
                token=token_sign["token"],
                sign=token_sign["sign"],
                cuit=config["cuit"],
                pto_vta=pto_vta,
                cbte_tipo=cbte_tipo,
                environment=config["environment"],
            )
            cbte_nro = int(ultimo_nro) + 1
            fe_payload = AfipService._build_fecae_payload(
                token=token_sign["token"],
                sign=token_sign["sign"],
                cuit=config["cuit"],
                pto_vta=pto_vta,
                cbte_tipo=cbte_tipo,
                cbte_nro=cbte_nro,
                doc_tipo=doc_tipo,
                doc_nro=doc_nro,
                amounts=amounts,
            )
            fe_response = fe_cae_solicitar(
                payload=fe_payload,
                environment=config["environment"],
            )

        parsed = AfipService._parse_fe_response(fe_response, cbte_nro)
        afip_err_text = " | ".join(
            [f"{err['code']}: {err['message']}" for err in parsed["errors"] if err.get("message")]
        ).strip()

        if parsed["approved"]:
            qr_data = {
                "fecha": _ar_now().strftime("%Y-%m-%d"),
                "cuit": config["cuit"],
                "ptoVta": pto_vta,
                "tipoCmp": cbte_tipo,
                "nroCmp": parsed["cbte_nro"],
                "importe": amounts["ImpTotal"],
                "moneda": amounts["MonId"],
                "ctz": amounts["MonCotiz"],
                "tipoDocRec": doc_tipo,
                "nroDocRec": doc_nro,
                "codAut": parsed["cae"],
            }
            qr_url = build_qr_url(qr_data)
            qr_image_b64 = build_qr_image_b64(qr_url)
            status = "AUTHORIZED"
        else:
            qr_url = ""
            qr_image_b64 = ""
            status = "REJECTED"

        invoice_record = {
            "restaurant_id": restaurant_id,
            "branch_id": branch.get("id"),
            "order_id": payload.get("order_id") or payload.get("orderId"),
            "cuit": config["cuit"],
            "pto_vta": int(pto_vta),
            "cbte_tipo": int(cbte_tipo),
            "cbte_nro": int(parsed["cbte_nro"]),
            "cae": parsed["cae"],
            "cae_vto": parsed["cae_vto"],
            "doc_tipo": int(doc_tipo),
            "doc_nro": int(doc_nro),
            "imp_total": amounts["ImpTotal"],
            "mon_id": amounts["MonId"],
            "mon_cotiz": amounts["MonCotiz"],
            "status": status,
            "qr_url": qr_url,
            "afip_result": parsed["resultado"],
            "afip_err": afip_err_text or None,
            "afip_request": fe_payload["FeCAEReq"],
            "afip_response": fe_response,
        }
        saved_invoice = AfipService._persist_invoice(invoice_record)
        printed_fields = AfipService._build_invoice_printed_fields(saved_invoice)

        if not parsed["approved"]:
            raise AfipRejectedError(
                "Comprobante rechazado por AFIP",
                {
                    "invoice_id": saved_invoice.get("id"),
                    "cbte_nro": parsed["cbte_nro"],
                    "cbte_tipo": cbte_tipo,
                    "errors": parsed["errors"],
                    "afip_result": parsed["resultado"],
                    "afip_err": afip_err_text,
                },
            )

        return {
            "invoice_id": saved_invoice.get("id"),
            "order_id": saved_invoice.get("order_id"),
            "branch_id": saved_invoice.get("branch_id"),
            "shared_pto_source_branch_id": source_branch.get("id") if source_branch else None,
            "cbte_nro": int(saved_invoice.get("cbte_nro")),
            "pto_vta": int(saved_invoice.get("pto_vta")),
            "cbte_tipo": int(saved_invoice.get("cbte_tipo")),
            "cbte_kind": _ALL_CBTE_TIPO_TO_KIND.get(int(saved_invoice.get("cbte_tipo")), str(saved_invoice.get("cbte_tipo"))),
            "cae": saved_invoice.get("cae"),
            "cae_vto": str(saved_invoice.get("cae_vto")),
            "qr_url": saved_invoice.get("qr_url"),
            "qr_image_b64": qr_image_b64,
            "printed_fields": printed_fields,
        }

    @staticmethod
    def get_invoice_for_print(
        restaurant_id: str,
        invoice_id: str,
        branch_scope_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        invoice = AfipService._fetch_invoice(restaurant_id, invoice_id, branch_scope_id)
        if not invoice:
            return None

        order = None
        order_id = invoice.get("order_id")
        if order_id:
            order = AfipService._fetch_order_for_restaurant(
                restaurant_id=restaurant_id,
                order_id=order_id,
                branch_id=branch_scope_id,
            )

        qr_url = invoice.get("qr_url") or ""
        qr_image_b64 = build_qr_image_b64(qr_url) if qr_url else ""

        return {
            "id": invoice.get("id"),
            "restaurant_id": invoice.get("restaurant_id"),
            "branch_id": invoice.get("branch_id"),
            "order_id": invoice.get("order_id"),
            "cuit": invoice.get("cuit"),
            "pto_vta": int(invoice.get("pto_vta") or 0),
            "cbte_tipo": int(invoice.get("cbte_tipo") or 0),
            "cbte_nro": int(invoice.get("cbte_nro") or 0),
            "cae": invoice.get("cae"),
            "cae_vto": str(invoice.get("cae_vto")),
            "doc_tipo": int(invoice.get("doc_tipo") or 0),
            "doc_nro": int(invoice.get("doc_nro") or 0),
            "imp_total": float(invoice.get("imp_total") or 0),
            "mon_id": invoice.get("mon_id"),
            "mon_cotiz": float(invoice.get("mon_cotiz") or 1),
            "status": invoice.get("status"),
            "qr_url": qr_url,
            "qr_image_b64": qr_image_b64,
            "afip_result": invoice.get("afip_result"),
            "afip_err": invoice.get("afip_err"),
            "created_at": invoice.get("created_at"),
            "printed_fields": AfipService._build_invoice_printed_fields(invoice),
            "order": {
                "id": order.get("id"),
                "mesa_id": order.get("mesa_id"),
                "items": order.get("items") or [],
                "total_amount": order.get("total_amount"),
                "created_at": order.get("created_at") or order.get("creation_date"),
            }
            if order
            else None,
        }


    @staticmethod
    def list_invoices(
        restaurant_id: str,
        branch_id: Optional[str] = None,
        status: Optional[str] = None,
        cbte_tipo: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        def _run():
            query = (
                supabase.table("invoices")
                .select("id, restaurant_id, branch_id, order_id, cuit, pto_vta, cbte_tipo, cbte_nro, cae, cae_vto, doc_tipo, doc_nro, imp_total, status, afip_result, afip_err, created_at, associated_invoice_id", count="exact")
                .eq("restaurant_id", restaurant_id)
                .order("created_at", desc=True)
            )
            if branch_id:
                query = query.eq("branch_id", branch_id)
            if status:
                query = query.eq("status", status.upper())
            if cbte_tipo is not None:
                query = query.eq("cbte_tipo", cbte_tipo)
            if date_from:
                query = query.gte("created_at", date_from)
            if date_to:
                query = query.lte("created_at", date_to + "T23:59:59")
            query = query.range(offset, offset + limit - 1)
            return query.execute()

        response = execute_with_retry(_run, retries=1, delay=0.2)
        rows = response.data or []
        total = response.count if hasattr(response, "count") and response.count is not None else len(rows)

        items = []
        for row in rows:
            ct = int(row.get("cbte_tipo") or 0)
            is_nc = ct in _NC_TIPO_TO_KIND
            items.append({
                **row,
                "cbte_kind": _ALL_CBTE_TIPO_TO_KIND.get(ct, str(ct)),
                "is_credit_note": is_nc,
                "cbte_formatted": _format_cbte(
                    int(row.get("pto_vta") or 0),
                    int(row.get("cbte_nro") or 0),
                ),
            })

        return {"items": items, "total": total, "limit": limit, "offset": offset}

    @staticmethod
    def authorize_credit_note(
        restaurant_id: str,
        payload: Dict[str, Any],
        user_branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        original_invoice_id = payload.get("invoice_id")
        if not original_invoice_id:
            raise AfipError(
                code="AFIP_INVALID_REQUEST",
                message="invoice_id de la factura original es requerido",
                status_code=400,
            )

        original = AfipService._fetch_invoice(restaurant_id, original_invoice_id, None)
        if not original:
            raise AfipError(
                code="AFIP_NOT_FOUND",
                message="Factura original no encontrada",
                status_code=404,
            )
        if original.get("status") != "AUTHORIZED":
            raise AfipError(
                code="AFIP_INVALID_REQUEST",
                message="Solo se puede emitir nota de crédito para facturas autorizadas",
                status_code=400,
            )

        orig_cbte_tipo = int(original.get("cbte_tipo") or 0)
        orig_kind = _CBTE_TIPO_TO_KIND.get(orig_cbte_tipo)
        if not orig_kind:
            raise AfipError(
                code="AFIP_INVALID_REQUEST",
                message=f"Tipo de comprobante original no soportado: {orig_cbte_tipo}",
                status_code=400,
            )

        nc_cbte_tipo = _NC_KIND_TO_TIPO[orig_kind]
        branch_id = original.get("branch_id")

        config_row = AfipService._fetch_config_row(restaurant_id)
        config = AfipService._ensure_config_ready(config_row)
        branch, pto_vta, source_branch = AfipService._resolve_effective_pto_vta(
            restaurant_id, branch_id,
        )

        doc_tipo = int(original.get("doc_tipo") or 99)
        doc_nro = int(original.get("doc_nro") or 0)

        totals_payload = payload.get("totals") or {"total": original.get("imp_total")}
        amounts = AfipService._build_amounts(totals_payload, orig_kind)

        token_sign = get_token_sign(
            restaurant_id=restaurant_id,
            environment=config["environment"],
            service="wsfe",
        )

        with AfipService._advisory_lock(config["cuit"], pto_vta, nc_cbte_tipo):
            ultimo_nro = fe_comp_ultimo_autorizado(
                token=token_sign["token"],
                sign=token_sign["sign"],
                cuit=config["cuit"],
                pto_vta=pto_vta,
                cbte_tipo=nc_cbte_tipo,
                environment=config["environment"],
            )
            cbte_nro = int(ultimo_nro) + 1

            fe_payload = AfipService._build_fecae_payload(
                token=token_sign["token"],
                sign=token_sign["sign"],
                cuit=config["cuit"],
                pto_vta=pto_vta,
                cbte_tipo=nc_cbte_tipo,
                cbte_nro=cbte_nro,
                doc_tipo=doc_tipo,
                doc_nro=doc_nro,
                amounts=amounts,
            )

            # Add CbtesAsoc referencing the original invoice
            fe_detail = fe_payload["FeCAEReq"]["FeDetReq"]["FECAEDetRequest"][0]
            fe_detail["CbtesAsoc"] = {
                "CbteAsoc": [{
                    "Tipo": orig_cbte_tipo,
                    "PtoVta": int(original.get("pto_vta") or pto_vta),
                    "Nro": int(original.get("cbte_nro")),
                    "Cuit": int(config["cuit"]),
                    "CbteFch": fe_detail["CbteFch"],
                }]
            }

            fe_response = fe_cae_solicitar(
                payload=fe_payload,
                environment=config["environment"],
            )

        parsed = AfipService._parse_fe_response(fe_response, cbte_nro)
        afip_err_text = " | ".join(
            [f"{err['code']}: {err['message']}" for err in parsed["errors"] if err.get("message")]
        ).strip()

        if parsed["approved"]:
            qr_data = {
                "fecha": _ar_now().strftime("%Y-%m-%d"),
                "cuit": config["cuit"],
                "ptoVta": pto_vta,
                "tipoCmp": nc_cbte_tipo,
                "nroCmp": parsed["cbte_nro"],
                "importe": amounts["ImpTotal"],
                "moneda": amounts["MonId"],
                "ctz": amounts["MonCotiz"],
                "tipoDocRec": doc_tipo,
                "nroDocRec": doc_nro,
                "codAut": parsed["cae"],
            }
            qr_url = build_qr_url(qr_data)
            qr_image_b64 = build_qr_image_b64(qr_url)
            status = "AUTHORIZED"
        else:
            qr_url = ""
            qr_image_b64 = ""
            status = "REJECTED"

        invoice_record = {
            "restaurant_id": restaurant_id,
            "branch_id": branch.get("id"),
            "order_id": original.get("order_id"),
            "cuit": config["cuit"],
            "pto_vta": int(pto_vta),
            "cbte_tipo": int(nc_cbte_tipo),
            "cbte_nro": int(parsed["cbte_nro"]),
            "cae": parsed["cae"],
            "cae_vto": parsed["cae_vto"],
            "doc_tipo": int(doc_tipo),
            "doc_nro": int(doc_nro),
            "imp_total": amounts["ImpTotal"],
            "mon_id": amounts["MonId"],
            "mon_cotiz": amounts["MonCotiz"],
            "status": status,
            "qr_url": qr_url,
            "afip_result": parsed["resultado"],
            "afip_err": afip_err_text or None,
            "afip_request": fe_payload["FeCAEReq"],
            "afip_response": fe_response,
            "associated_invoice_id": original_invoice_id,
        }
        saved_invoice = AfipService._persist_invoice(invoice_record)

        if not parsed["approved"]:
            raise AfipRejectedError(
                "Nota de crédito rechazada por AFIP",
                {
                    "invoice_id": saved_invoice.get("id"),
                    "cbte_nro": parsed["cbte_nro"],
                    "cbte_tipo": nc_cbte_tipo,
                    "errors": parsed["errors"],
                    "afip_result": parsed["resultado"],
                    "afip_err": afip_err_text,
                },
            )

        return {
            "invoice_id": saved_invoice.get("id"),
            "original_invoice_id": original_invoice_id,
            "cbte_nro": int(saved_invoice.get("cbte_nro")),
            "pto_vta": int(saved_invoice.get("pto_vta")),
            "cbte_tipo": int(nc_cbte_tipo),
            "cbte_kind": f"NC {orig_kind}",
            "cae": saved_invoice.get("cae"),
            "cae_vto": str(saved_invoice.get("cae_vto")),
            "qr_url": saved_invoice.get("qr_url"),
            "qr_image_b64": qr_image_b64,
        }


afip_service = AfipService()
