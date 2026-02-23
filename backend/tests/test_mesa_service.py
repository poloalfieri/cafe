import pytest

from app.services import mesa_service as mesa_service_module


def test_get_or_create_session_requires_branch():
    with pytest.raises(ValueError):
        mesa_service_module.mesa_service.get_or_create_session(
            mesa_id="1",
            branch_id=None,
            expiry_minutes=30,
        )


def test_get_or_create_session_requires_existing_mesa(monkeypatch):
    monkeypatch.setattr(mesa_service_module.mesa_service, "get_mesa_by_id", lambda *_a, **_k: None)
    with pytest.raises(ValueError):
        mesa_service_module.mesa_service.get_or_create_session(
            mesa_id="1",
            branch_id="b1",
            expiry_minutes=30,
        )


def test_get_or_create_session_inactive_mesa(monkeypatch):
    monkeypatch.setattr(
        mesa_service_module.mesa_service,
        "get_mesa_by_id",
        lambda *_a, **_k: {"mesa_id": "1", "is_active": False},
    )
    with pytest.raises(ValueError):
        mesa_service_module.mesa_service.get_or_create_session(
            mesa_id="1",
            branch_id="b1",
            expiry_minutes=30,
        )


def test_get_or_create_session_reuses_valid_token(monkeypatch):
    mesa_row = {
        "mesa_id": "1",
        "is_active": True,
        "token": "token-123",
        "token_expires_at": "2999-01-01T00:00:00Z",
    }
    monkeypatch.setattr(mesa_service_module.mesa_service, "get_mesa_by_id", lambda *_a, **_k: mesa_row)

    result = mesa_service_module.mesa_service.get_or_create_session(
        mesa_id="1",
        branch_id="b1",
        expiry_minutes=30,
    )

    assert result["token"] == "token-123"
    assert result["mesa_id"] == "1"


def test_get_or_create_session_generates_new_token(monkeypatch):
    mesa_row = {
        "mesa_id": "1",
        "is_active": True,
        "token": "token-expired",
        "token_expires_at": "2000-01-01T00:00:00Z",
    }
    monkeypatch.setattr(mesa_service_module.mesa_service, "get_mesa_by_id", lambda *_a, **_k: mesa_row)
    monkeypatch.setattr(
        mesa_service_module.mesa_service,
        "generate_token_for_mesa",
        lambda *_a, **_k: {"mesa_id": "1", "token": "token-new"},
    )

    result = mesa_service_module.mesa_service.get_or_create_session(
        mesa_id="1",
        branch_id="b1",
        expiry_minutes=30,
    )

    assert result["token"] == "token-new"
