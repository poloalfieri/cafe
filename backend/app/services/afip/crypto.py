import base64
import os
from functools import lru_cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


_NONCE_SIZE = 12


@lru_cache(maxsize=1)
def _get_master_key() -> bytes:
    encoded = (os.getenv("AFIP_MASTER_KEY_B64") or "").strip()
    if not encoded:
        raise ValueError("AFIP_MASTER_KEY_B64 no está configurada")

    try:
        key = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError("AFIP_MASTER_KEY_B64 no es base64 válido") from exc

    if len(key) != 32:
        raise ValueError("AFIP_MASTER_KEY_B64 debe decodificar a 32 bytes")
    return key


def encrypt_str(plaintext: str) -> str:
    if plaintext is None:
        raise ValueError("plaintext no puede ser None")

    key = _get_master_key()
    nonce = os.urandom(_NONCE_SIZE)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    payload = nonce + ciphertext
    return base64.b64encode(payload).decode("ascii")


def decrypt_str(ciphertext_b64: str) -> str:
    if not ciphertext_b64:
        raise ValueError("ciphertext_b64 requerido")

    key = _get_master_key()
    try:
        payload = base64.b64decode(ciphertext_b64, validate=True)
    except Exception as exc:
        raise ValueError("ciphertext_b64 no es base64 válido") from exc

    if len(payload) <= _NONCE_SIZE:
        raise ValueError("ciphertext inválido")

    nonce = payload[:_NONCE_SIZE]
    ciphertext = payload[_NONCE_SIZE:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
