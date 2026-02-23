import types

from flask import Flask
from app.middleware import tenant as tenant_module
from app.db import supabase_client


def test_global_path_allows_bypass():
    app = Flask(__name__)
    with app.test_request_context(path="/health"):
        assert tenant_module.is_global_path("/health") is True
        assert tenant_module.tenant_middleware() is None


def test_tenant_requires_internal_key_in_production(monkeypatch):
    app = Flask(__name__)
    monkeypatch.setattr(tenant_module, "FLASK_ENV", "production")
    monkeypatch.setattr(tenant_module, "INTERNAL_PROXY_KEY", "secret")

    with app.test_request_context(path="/menu", headers={"X-Restaurant-Slug": "demo"}):
        resp = tenant_module.tenant_middleware()
        assert resp is not None
        assert resp[1] == 401


def test_tenant_requires_slug(monkeypatch):
    app = Flask(__name__)
    monkeypatch.setattr(tenant_module, "FLASK_ENV", "development")
    monkeypatch.setattr(tenant_module, "INTERNAL_PROXY_KEY", "secret")

    with app.test_request_context(path="/menu", headers={"X-Internal-Key": "secret"}):
        resp = tenant_module.tenant_middleware()
        assert resp is not None
        assert resp[1] == 400


def test_tenant_invalid_slug_returns_404(monkeypatch):
    app = Flask(__name__)

    def fake_select(*_args, **_kwargs):
        return types.SimpleNamespace(
            eq=lambda *_a, **_k: types.SimpleNamespace(
                single=lambda: types.SimpleNamespace(execute=lambda: types.SimpleNamespace(data=None))
            )
        )

    monkeypatch.setattr(supabase_client.supabase, "table", lambda *_a, **_k: types.SimpleNamespace(select=fake_select))
    monkeypatch.setattr(tenant_module, "FLASK_ENV", "development")
    monkeypatch.setattr(tenant_module, "INTERNAL_PROXY_KEY", "secret")

    with app.test_request_context(path="/menu", headers={"X-Internal-Key": "secret", "X-Restaurant-Slug": "nope"}):
        resp = tenant_module.tenant_middleware()
        assert resp is not None
        assert resp[1] == 404
