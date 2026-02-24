import pytest

from app.services import waiter_service as waiter_service_module


@pytest.fixture(autouse=True)
def _clear_waiter_calls():
    waiter_service_module.waiter_service._calls.clear()


def test_waiter_call_requires_mesa_and_branch():
    with pytest.raises(ValueError):
        waiter_service_module.waiter_service.create_waiter_call(
            {"branch_id": "b1"},
            mesa_id=None,
            branch_id="b1",
            token=None,
            skip_token_validation=True,
        )

    with pytest.raises(ValueError):
        waiter_service_module.waiter_service.create_waiter_call(
            {"mesa_id": "1"},
            mesa_id="1",
            branch_id=None,
            token=None,
            skip_token_validation=True,
        )


def test_waiter_call_defaults_payment_method():
    call, already_pending = waiter_service_module.waiter_service.create_waiter_call(
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
        waiter_service_module.waiter_service.create_waiter_call(
            {"mesa_id": "1", "branch_id": "b1", "payment_method": "INVALID"},
            mesa_id="1",
            branch_id="b1",
            token=None,
            skip_token_validation=True,
        )


def test_waiter_call_deduplicates_pending():
    # First call -> created
    call1, already1 = waiter_service_module.waiter_service.create_waiter_call(
        {"mesa_id": "5", "branch_id": "b1", "payment_method": "CASH"},
        mesa_id="5",
        branch_id="b1",
        token=None,
        skip_token_validation=True,
    )
    assert already1 is False

    # Second call for same mesa while PENDING -> should return existing
    call2, already2 = waiter_service_module.waiter_service.create_waiter_call(
        {"mesa_id": "5", "branch_id": "b1", "payment_method": "CARD"},
        mesa_id="5",
        branch_id="b1",
        token=None,
        skip_token_validation=True,
    )
    assert already2 is True
    assert call2["id"] == call1["id"]


def test_waiter_calls_filter_by_branch():
    # Ensure there is at least one call in another branch
    waiter_service_module.waiter_service.create_waiter_call(
        {"mesa_id": "7", "branch_id": "b2", "payment_method": "CASH"},
        mesa_id="7",
        branch_id="b2",
        token=None,
        skip_token_validation=True,
    )
    calls_b2 = waiter_service_module.waiter_service.get_all_calls(branch_id="b2")
    assert all(call.get("branch_id") == "b2" for call in calls_b2)


def test_waiter_call_invalid_token_raises_permission_error(monkeypatch):
    monkeypatch.setattr(waiter_service_module, "validate_token", lambda *_a, **_k: False)

    with pytest.raises(PermissionError):
        waiter_service_module.waiter_service.create_waiter_call(
            {"mesa_id": "9", "branch_id": "b1", "payment_method": "ASSISTANCE"},
            mesa_id="9",
            branch_id="b1",
            token="invalid-token",
            skip_token_validation=False,
        )
