import base64
import importlib
import json
from urllib.parse import parse_qs, urlparse


def _reload_crypto():
    import app.services.afip.crypto as crypto_module

    return importlib.reload(crypto_module)


def test_encrypt_decrypt_roundtrip(monkeypatch):
    key = base64.b64encode(b"a" * 32).decode("ascii")
    monkeypatch.setenv("AFIP_MASTER_KEY_B64", key)
    crypto = _reload_crypto()

    plaintext = "contenido-secreto"
    encrypted = crypto.encrypt_str(plaintext)

    assert encrypted != plaintext
    assert crypto.decrypt_str(encrypted) == plaintext


def test_encrypt_fails_with_invalid_key(monkeypatch):
    monkeypatch.setenv("AFIP_MASTER_KEY_B64", base64.b64encode(b"short").decode("ascii"))
    crypto = _reload_crypto()

    try:
        crypto.encrypt_str("abc")
        assert False, "Expected ValueError when key length is invalid"
    except ValueError as exc:
        assert "32 bytes" in str(exc)


def test_build_qr_url_contains_expected_payload():
    from app.services.afip.qr import build_qr_url

    qr_url = build_qr_url(
        {
            "fecha": "2026-02-23",
            "cuit": "20123456789",
            "ptoVta": 3,
            "tipoCmp": 6,
            "nroCmp": 15,
            "importe": 12345.67,
            "moneda": "PES",
            "ctz": 1,
            "tipoDocRec": 99,
            "nroDocRec": 0,
            "codAut": "12345678901234",
        }
    )

    parsed = urlparse(qr_url)
    query = parse_qs(parsed.query)
    assert parsed.scheme == "https"
    assert parsed.netloc == "www.arca.gob.ar"
    assert "p" in query

    encoded = query["p"][0]
    raw_json = base64.b64decode(encoded).decode("utf-8")
    payload = json.loads(raw_json)
    assert payload["ver"] == 1
    assert payload["cuit"] == 20123456789
    assert payload["ptoVta"] == 3
    assert payload["tipoCmp"] == 6
    assert payload["tipoCodAut"] == "E"
