import secrets
import time

TOKENS = {}  # En memoria, reemplazar por DB en prod

def generate_token(mesa_id, expiry_minutes=10):
    token = secrets.token_urlsafe(16)
    expiry = int(time.time()) + 60 * expiry_minutes
    TOKENS[mesa_id] = {"token": token, "expiry": expiry}
    return token

def validate_token(mesa_id, token):
    data = TOKENS.get(mesa_id)
    if not data:
        return False
    if data["token"] != token:
        return False
    if data["expiry"] < int(time.time()):
        return False
    return True

def renew_token(mesa_id, expiry_minutes=10):
    return generate_token(mesa_id, expiry_minutes) 