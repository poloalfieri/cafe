import os
import types
import time

import pytest
from flask import Flask

# Ensure required env vars exist before importing auth module (supabase client init)
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")

from app.middleware import auth as auth_module  # noqa: E402
from app.services.waiter_service import waiter_service  # noqa: E402
from app.db import supabase_client  # noqa: E402


def _make_user(app_role=None, user_role=None):
    return types.SimpleNamespace(
        id="user-1",
        email="test@example.com",
        app_metadata={"role": app_role, "org_id": "org-1", "branch_id": "branch-1"},
        user_metadata={"role": user_role},
    )


def test_get_token_from_request_parses_bearer():
    app = Flask(__name__)
    with app.test_request_context(headers={"Authorization": "Bearer abc.def.ghi"}):
        token = auth_module.get_token_from_request()
        assert token == "abc.def.ghi"


def test_decode_token_exp():
    # Token with payload {"exp": <now+60>}
    exp = int(time.time()) + 60
    payload = f'{{"exp": {exp}}}'.encode("utf-8")
    import base64
    b64 = base64.urlsafe_b64encode(payload).rstrip(b"=")
    token = f"aaa.{b64.decode('utf-8')}.bbb"
    assert auth_module._decode_token_exp(token) == exp


def test_verify_token_uses_app_metadata_only(monkeypatch):
    user = _make_user(app_role="admin", user_role="desarrollador")

    def fake_get_user(_token):
        return types.SimpleNamespace(user=user)

    monkeypatch.setattr(supabase_client.supabase.auth, "get_user", fake_get_user)
    auth_module._auth_cache.clear()

    verified = auth_module.verify_token("dummy.jwt.token.admin")
    assert verified["role"] == "admin"


def test_verify_token_ignores_user_metadata(monkeypatch):
    user = _make_user(app_role=None, user_role="admin")

    def fake_get_user(_token):
        return types.SimpleNamespace(user=user)

    monkeypatch.setattr(supabase_client.supabase.auth, "get_user", fake_get_user)
    auth_module._auth_cache.clear()

    verified = auth_module.verify_token("dummy.jwt.token.user_meta")
    assert verified["role"] is None


def test_waiter_call_defaults_to_assistance():
    call, already_pending = waiter_service.create_waiter_call(
        {"mesa_id": "1", "branch_id": "b1"},
        mesa_id="1",
        branch_id="b1",
        token=None,
        skip_token_validation=True,
    )
    assert already_pending is False
    assert call["payment_method"] == "ASSISTANCE"


def test_waiter_call_rejects_invalid_method():
    with pytest.raises(ValueError):
        waiter_service.create_waiter_call(
            {"mesa_id": "1", "branch_id": "b1", "payment_method": "INVALID"},
            mesa_id="1",
            branch_id="b1",
            token=None,
            skip_token_validation=True,
        )
