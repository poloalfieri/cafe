import pytest

from app.services import order_service as order_service_module


def test_create_order_requires_token():
    with pytest.raises(PermissionError):
        order_service_module.order_service.create_order(
            mesa_id="1",
            items=[{"id": "10", "quantity": 1}],
            token=None,
            branch_id="b1",
        )


def test_create_order_requires_branch():
    with pytest.raises(ValueError):
        order_service_module.order_service.create_order(
            mesa_id="1",
            items=[{"id": "10", "quantity": 1}],
            token="mesa-token",
            branch_id=None,
        )


def test_create_order_invalid_token(monkeypatch):
    monkeypatch.setattr(order_service_module, "validate_token", lambda *_args, **_kwargs: False)
    with pytest.raises(PermissionError):
        order_service_module.order_service.create_order(
            mesa_id="1",
            items=[{"id": "10", "quantity": 1}],
            token="mesa-token",
            branch_id="b1",
        )


def test_create_order_calls_create_order_for_mesa(monkeypatch):
    monkeypatch.setattr(order_service_module, "validate_token", lambda *_args, **_kwargs: True)

    called = {}

    def fake_create_order_for_mesa(self, mesa_id, items, branch_id, restaurant_id=None):
        called["mesa_id"] = mesa_id
        called["items"] = items
        called["branch_id"] = branch_id
        called["restaurant_id"] = restaurant_id
        return {"id": "order-1"}

    monkeypatch.setattr(order_service_module.OrderService, "_create_order_for_mesa", fake_create_order_for_mesa)

    result = order_service_module.order_service.create_order(
        mesa_id="1",
        items=[{"id": "10", "quantity": 1}],
        token="mesa-token",
        branch_id="b1",
    )

    assert result["id"] == "order-1"
    assert called["mesa_id"] == "1"
    assert called["branch_id"] == "b1"
    assert called["restaurant_id"] is None


def test_create_order_by_staff_requires_restaurant():
    with pytest.raises(ValueError):
        order_service_module.order_service.create_order_by_staff(
            mesa_id="1",
            items=[{"id": "10", "quantity": 1}],
            branch_id="b1",
            restaurant_id=None,
        )


def test_create_order_by_staff_requires_branch():
    with pytest.raises(ValueError):
        order_service_module.order_service.create_order_by_staff(
            mesa_id="1",
            items=[{"id": "10", "quantity": 1}],
            branch_id=None,
            restaurant_id="r1",
        )


def test_create_order_by_staff_calls_create_order_for_mesa(monkeypatch):
    called = {}

    def fake_create_order_for_mesa(self, mesa_id, items, branch_id, restaurant_id=None):
        called["mesa_id"] = mesa_id
        called["branch_id"] = branch_id
        called["restaurant_id"] = restaurant_id
        return {"id": "order-2"}

    monkeypatch.setattr(order_service_module.OrderService, "_create_order_for_mesa", fake_create_order_for_mesa)

    result = order_service_module.order_service.create_order_by_staff(
        mesa_id="2",
        items=[{"id": "11", "quantity": 2}],
        branch_id="b2",
        restaurant_id="r2",
    )

    assert result["id"] == "order-2"
    assert called["mesa_id"] == "2"
    assert called["branch_id"] == "b2"
    assert called["restaurant_id"] == "r2"


def test_resolve_status_key_valid():
    status = order_service_module.order_service._resolve_status_key("paid")
    assert status.value == "PAID"


def test_resolve_status_key_invalid():
    with pytest.raises(ValueError):
        order_service_module.order_service._resolve_status_key("not-a-status")


def test_normalize_payment_method():
    assert order_service_module.order_service._normalize_payment_method(" cash ") == "CASH"
    assert order_service_module.order_service._normalize_payment_method(None) is None
    with pytest.raises(ValueError):
        order_service_module.order_service._normalize_payment_method("invalid")
