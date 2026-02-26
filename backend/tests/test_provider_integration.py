"""
Tests para la integración de proveedores de delivery (Rappi, PedidosYa).

Cubre:
  - Adapters: verificación de firma, mapeo de estados, mapeo de órdenes
  - Inbox: deduplicación, procesamiento, skip por disabled
  - Outbox: creación de jobs, reintentos, DLQ
  - Webhook controller: respuesta inmediata 200, idempotencia
  - order_service: outbox job creado al actualizar estado de orden de proveedor

Las llamadas a Supabase y APIs de proveedores son mockeadas.
"""

import hashlib
import hmac
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional
from unittest.mock import MagicMock, patch, call

import pytest

# Asegurar que el backend está en PYTHONPATH
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Mock de módulos externos no instalados en el entorno de tests
# (flask_socketio, eventlet, mercadopago, etc.)
_mock_socketio_module = MagicMock()
_mock_eventlet_module = MagicMock()
for _mod in ("flask_socketio", "eventlet", "mercadopago"):
    sys.modules.setdefault(_mod, MagicMock())

# ---------------------------------------------------------------------------
# Tests de adapters
# ---------------------------------------------------------------------------

class TestRappiAdapter:
    """Tests para RappiAdapter."""

    def setup_method(self):
        from app.integrations.adapters.rappi_adapter import RappiAdapter
        self.adapter = RappiAdapter()

    def test_verify_signature_no_secret_returns_true(self):
        """Sin secret configurado, siempre retorna True (dev mode)."""
        result = self.adapter.verify_webhook_signature(b'{"id": "1"}', {})
        assert result is True

    def test_verify_signature_valid_hmac(self):
        """HMAC válido retorna True."""
        secret = "test-webhook-secret"
        body = b'{"id": "order-1", "status": "created"}'
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

        headers = {
            "_webhook_secret": secret,
            "X-Rappi-Hmac-Signature": sig,
        }
        assert self.adapter.verify_webhook_signature(body, headers) is True

    def test_verify_signature_invalid_hmac(self):
        """HMAC inválido retorna False."""
        headers = {
            "_webhook_secret": "real-secret",
            "X-Rappi-Hmac-Signature": "wrong-signature",
        }
        assert self.adapter.verify_webhook_signature(b'body', headers) is False

    def test_parse_webhook_event_order_created(self):
        """Parsear evento de nueva orden Rappi."""
        body = {"id": "rappi-123", "status": "created", "total": 1500}
        event = self.adapter.parse_webhook_event(body, {})

        assert event.provider == "rappi"
        assert event.event_type == "order_created"
        assert event.provider_order_id == "rappi-123"
        assert event.raw_order == body

    def test_parse_webhook_event_cancelled(self):
        """Parsear evento de cancelación Rappi."""
        body = {"id": "rappi-456", "status": "cancelled"}
        event = self.adapter.parse_webhook_event(body, {})

        assert event.event_type == "order_cancelled"
        assert event.provider_order_id == "rappi-456"

    def test_status_map_inbound(self):
        """Verificar mapeo completo de estados inbound."""
        m = self.adapter.STATUS_MAP_INBOUND
        assert m["created"] == "PAYMENT_APPROVED"
        assert m["accepted"] == "IN_PREPARATION"
        assert m["ready_for_pickup"] == "READY"
        assert m["delivered"] == "DELIVERED"
        assert m["cancelled"] == "CANCELLED"
        assert m["rejected"] == "CANCELLED"

    def test_status_map_outbound(self):
        """Verificar mapeo de estados outbound."""
        m = self.adapter.STATUS_MAP_OUTBOUND
        assert m["IN_PREPARATION"] == "ACCEPTED"
        assert m["READY"] == "READY_FOR_PICKUP"
        assert m["CANCELLED"] == "REJECTED"
        assert m["DELIVERED"] == "DELIVERED"

    def test_map_provider_order_to_internal_basic(self):
        """Mapear orden Rappi con items sin mapeo explícito."""
        provider_order = {
            "id": "rappi-order-1",
            "status": "created",
            "total": 1500,
            "products": [
                {"id": "prod-1", "name": "Hamburguesa", "qty": 2, "price": 750},
            ],
        }
        result = self.adapter.map_provider_order_to_internal(
            provider_order, "restaurant-uuid", "branch-uuid", product_mappings=[]
        )

        assert result["source"] == "rappi"
        assert result["provider_order_id"] == "rappi-order-1"
        assert result["status"] == "PAYMENT_APPROVED"
        assert result["mesa_id"] == "rappi-rappi-order-1"
        assert len(result["items"]) == 1
        assert result["items"][0]["name"] == "Hamburguesa"
        assert result["items"][0]["stock_tracked"] is False  # sin mapeo

    def test_map_provider_order_with_explicit_mapping(self):
        """Mapear orden Rappi con product mapping explícito."""
        provider_order = {
            "id": "rappi-order-2",
            "status": "created",
            "total": 1500,
            "products": [{"id": "rappi-prod-1", "name": "Pizza", "qty": 1, "price": 1500}],
        }
        mappings = [{"provider_product_id": "rappi-prod-1", "menu_product_id": 42}]
        result = self.adapter.map_provider_order_to_internal(
            provider_order, "r-uuid", "b-uuid", product_mappings=mappings
        )

        item = result["items"][0]
        assert item.get("id") == 42
        assert item["stock_tracked"] is True

    def test_confirm_order_stub_no_credentials(self):
        """confirm_order retorna stub sin credenciales reales."""
        result = self.adapter.confirm_order("order-1", credentials={})
        assert result["ok"] is True
        assert result["stub"] is True

    def test_reject_order_stub_no_credentials(self):
        """reject_order retorna stub sin credenciales reales."""
        result = self.adapter.reject_order("order-1", credentials={})
        assert result["ok"] is True
        assert result["stub"] is True

    def test_update_order_status_no_outbound_mapping(self):
        """update_order_status retorna skipped si no hay mapeo outbound."""
        result = self.adapter.update_order_status("order-1", "PAYMENT_PENDING", {})
        assert result.get("skipped") is True

    def test_fetch_recent_orders_stub(self):
        """fetch_recent_orders retorna [] sin credenciales."""
        result = self.adapter.fetch_recent_orders(credentials={})
        assert result == []


class TestPedidosYaAdapter:
    """Tests para PedidosYaAdapter."""

    def setup_method(self):
        from app.integrations.adapters.pedidosya_adapter import PedidosYaAdapter
        self.adapter = PedidosYaAdapter()

    def test_verify_token_no_token_returns_true(self):
        """Sin token configurado, siempre retorna True (dev mode)."""
        result = self.adapter.verify_webhook_signature(b'{}', {})
        assert result is True

    def test_verify_token_valid(self):
        """Token válido retorna True."""
        headers = {
            "_integration_token": "secret-token",
            "X-PY-Integration-Token": "secret-token",
        }
        assert self.adapter.verify_webhook_signature(b'{}', headers) is True

    def test_verify_token_invalid(self):
        """Token inválido retorna False."""
        headers = {
            "_integration_token": "real-token",
            "X-PY-Integration-Token": "wrong-token",
        }
        assert self.adapter.verify_webhook_signature(b'{}', headers) is False

    def test_status_map_inbound(self):
        """Verificar mapeo completo de estados inbound PedidosYa."""
        m = self.adapter.STATUS_MAP_INBOUND
        assert m["RECEIVED"] == "PAYMENT_APPROVED"
        assert m["CONFIRMED"] == "IN_PREPARATION"
        assert m["DISPATCHED"] == "READY"
        assert m["DELIVERED"] == "DELIVERED"
        assert m["CANCELLED"] == "CANCELLED"

    def test_map_provider_order_pedidosya(self):
        """Mapear orden PedidosYa al formato interno."""
        provider_order = {
            "id": "py-order-1",
            "status": "RECEIVED",
            "totalAmount": 2000,
            "details": [
                {"id": "item-1", "name": "Pizza", "amount": 1, "unitPrice": 2000}
            ],
            "user": {"name": "María García"},
        }
        result = self.adapter.map_provider_order_to_internal(
            provider_order, "r-uuid", "b-uuid", product_mappings=[]
        )

        assert result["source"] == "pedidosya"
        assert result["provider_order_id"] == "py-order-1"
        assert result["mesa_id"] == "pedidosya-py-order-1"
        assert result["total_amount"] == 2000.0
        assert "María García" in result["notes"]


class TestRegistry:
    """Tests del registry de adapters."""

    def test_get_adapter_rappi(self):
        from app.integrations.registry import get_adapter
        adapter = get_adapter("rappi")
        assert adapter.provider_name == "rappi"

    def test_get_adapter_pedidosya(self):
        from app.integrations.registry import get_adapter
        adapter = get_adapter("pedidosya")
        assert adapter.provider_name == "pedidosya"

    def test_get_adapter_unknown_raises(self):
        from app.integrations.registry import get_adapter
        with pytest.raises(ValueError, match="no registrado"):
            get_adapter("unknown_provider")


# ---------------------------------------------------------------------------
# Tests de outbox_service
# ---------------------------------------------------------------------------

class TestOutboxService:
    """Tests para el servicio de outbox."""

    @patch("app.integrations.outbox_service.supabase")
    @patch("app.integrations.outbox_service.execute_with_retry")
    def test_create_outbox_job_success(self, mock_retry, mock_supabase):
        """create_outbox_job retorna job_id al insertar exitosamente."""
        from app.integrations.outbox_service import create_outbox_job

        job_id = str(uuid.uuid4())
        mock_retry.return_value = MagicMock(data=[{"id": job_id}])

        result = create_outbox_job(
            provider="rappi",
            action="confirm_order",
            restaurant_id="r-uuid",
            order_id="o-uuid",
            provider_order_id="rappi-123",
        )

        assert result == job_id
        mock_retry.assert_called_once()

    @patch("app.integrations.outbox_service.supabase")
    @patch("app.integrations.outbox_service.execute_with_retry")
    def test_create_outbox_job_returns_none_on_error(self, mock_retry, mock_supabase):
        """create_outbox_job retorna None si hay error."""
        from app.integrations.outbox_service import create_outbox_job

        mock_retry.side_effect = Exception("DB error")

        result = create_outbox_job(
            provider="rappi",
            action="confirm_order",
            restaurant_id="r-uuid",
        )

        assert result is None

    @patch("app.integrations.outbox_service.supabase")
    @patch("app.integrations.outbox_service.execute_with_retry")
    @patch("app.integrations.outbox_service._execute_job")
    def test_process_pending_jobs_calls_execute(
        self, mock_execute, mock_retry, mock_supabase
    ):
        """process_pending_jobs llama _execute_job para cada job pendiente."""
        from app.integrations.outbox_service import process_pending_jobs

        job = {
            "id": "job-1",
            "provider": "rappi",
            "action": "confirm_order",
            "provider_order_id": "rappi-123",
            "attempt_count": 0,
            "max_attempts": 5,
            "restaurant_id": "r-uuid",
            "branch_id": None,
            "payload": {},
            "order_id": "o-1",
        }

        # Primera llamada: no hay stale jobs; segunda: jobs pendientes
        mock_retry.side_effect = [
            MagicMock(data=[]),   # stale running jobs query
            MagicMock(data=[job]),  # pending jobs query
        ]

        process_pending_jobs()

        mock_execute.assert_called_once_with(job)


# ---------------------------------------------------------------------------
# Tests del inbox_service
# ---------------------------------------------------------------------------

class TestInboxService:
    """Tests para el servicio de inbox."""

    @patch("app.integrations.inbox_service.execute_with_retry")
    def test_save_inbox_event_new_event(self, mock_retry):
        """save_inbox_event retorna (id, False) para evento nuevo."""
        from app.integrations.inbox_service import save_inbox_event

        inbox_id = str(uuid.uuid4())
        mock_retry.return_value = MagicMock(data=[{"id": inbox_id}])

        result_id, is_dup = save_inbox_event(
            provider="rappi",
            event_type="order_created",
            dedupe_key="rappi:req-123",
            raw_headers={},
            raw_body={"id": "order-1"},
            restaurant_id="r-uuid",
            branch_id="b-uuid",
        )

        assert result_id == inbox_id
        assert is_dup is False

    @patch("app.integrations.inbox_service.execute_with_retry")
    def test_save_inbox_event_duplicate(self, mock_retry):
        """save_inbox_event retorna (None, True) para evento duplicado."""
        from app.integrations.inbox_service import save_inbox_event

        # ON CONFLICT DO NOTHING → data vacío
        mock_retry.return_value = MagicMock(data=[])

        result_id, is_dup = save_inbox_event(
            provider="rappi",
            event_type="order_created",
            dedupe_key="rappi:req-123",
            raw_headers={},
            raw_body={},
            restaurant_id="r-uuid",
            branch_id=None,
        )

        assert result_id is None
        assert is_dup is True

    @patch("app.integrations.inbox_service._mark_inbox_status")
    @patch("app.integrations.inbox_service._get_integration_account")
    @patch("app.integrations.inbox_service.execute_with_retry")
    def test_process_inbox_event_disabled_provider(
        self, mock_retry, mock_get_account, mock_mark
    ):
        """Si el provider está disabled, marcar inbox como skipped."""
        from app.integrations.inbox_service import process_inbox_event

        inbox_id = str(uuid.uuid4())

        # Simular evento en inbox
        mock_retry.side_effect = [
            MagicMock(data=[{
                "id": inbox_id,
                "provider": "rappi",
                "restaurant_id": "r-uuid",
                "branch_id": "b-uuid",
                "raw_body": {"id": "order-1", "status": "created"},
                "raw_headers": {},
                "event_type": "order_created",
            }]),  # read event
            MagicMock(data=[]),  # mark as processing
        ]

        # Provider deshabilitado
        mock_get_account.return_value = {"enabled": False}

        process_inbox_event(inbox_id)

        mock_mark.assert_called_with(inbox_id, "skipped", "Provider deshabilitado o no configurado")

    @patch("app.integrations.inbox_service._mark_inbox_status")
    @patch("app.integrations.inbox_service._create_provider_order")
    @patch("app.integrations.inbox_service._get_product_mappings")
    @patch("app.integrations.inbox_service._get_existing_order")
    @patch("app.integrations.inbox_service._get_integration_account")
    @patch("app.integrations.inbox_service.execute_with_retry")
    def test_process_inbox_event_creates_order(
        self,
        mock_retry,
        mock_get_account,
        mock_get_existing,
        mock_get_mappings,
        mock_create_order,
        mock_mark,
    ):
        """Evento nuevo de Rappi crea una orden en la DB."""
        from app.integrations.inbox_service import process_inbox_event

        inbox_id = str(uuid.uuid4())
        order_id = str(uuid.uuid4())

        mock_retry.side_effect = [
            MagicMock(data=[{
                "id": inbox_id,
                "provider": "rappi",
                "restaurant_id": "r-uuid",
                "branch_id": "b-uuid",
                "raw_body": {
                    "id": "rappi-order-1",
                    "status": "created",
                    "total": 1500,
                    "products": [{"id": "p1", "name": "Burger", "qty": 1, "price": 1500}],
                },
                "raw_headers": {},
                "event_type": "order_created",
            }]),
            MagicMock(data=[]),  # mark processing
        ]

        mock_get_account.return_value = {"enabled": True, "credentials": {}}
        mock_get_existing.return_value = None  # orden no existe
        mock_get_mappings.return_value = []
        mock_create_order.return_value = {
            "id": order_id,
            "branch_id": "b-uuid",
            "mesa_id": "rappi-rappi-order-1",
        }

        # Parchear flask_socketio en sys.modules para que el import local funcione en tests
        mock_socketio_module = MagicMock()
        mock_socketio_instance = MagicMock()
        mock_socketio_module.SocketIO.return_value = mock_socketio_instance
        with patch.dict("sys.modules", {"flask_socketio": mock_socketio_module}):
            process_inbox_event(inbox_id)

        mock_create_order.assert_called_once()
        mock_mark.assert_called_with(inbox_id, "processed")

    @patch("app.integrations.inbox_service._mark_inbox_status")
    @patch("app.integrations.inbox_service._get_existing_order")
    @patch("app.integrations.inbox_service._get_integration_account")
    @patch("app.integrations.inbox_service.execute_with_retry")
    def test_process_inbox_event_skips_duplicate_order(
        self, mock_retry, mock_get_account, mock_get_existing, mock_mark
    ):
        """Si la orden ya existe, marcar inbox como skipped (dedup secundario)."""
        from app.integrations.inbox_service import process_inbox_event

        inbox_id = str(uuid.uuid4())

        mock_retry.side_effect = [
            MagicMock(data=[{
                "id": inbox_id,
                "provider": "rappi",
                "restaurant_id": "r-uuid",
                "branch_id": "b-uuid",
                "raw_body": {"id": "rappi-order-existing", "status": "created"},
                "raw_headers": {},
                "event_type": "order_created",
            }]),
            MagicMock(data=[]),  # mark processing
        ]
        mock_get_account.return_value = {"enabled": True, "credentials": {}}
        mock_get_existing.return_value = {"id": "existing-order-uuid", "status": "PAYMENT_APPROVED"}

        process_inbox_event(inbox_id)

        # Debe marcarse como skipped, no crear orden
        mock_mark.assert_called_with(inbox_id, "skipped", "Orden ya existente: existing-order-uuid")


# ---------------------------------------------------------------------------
# Tests del webhook controller
# ---------------------------------------------------------------------------

class TestProviderWebhookController:
    """Tests de integración para los endpoints webhook."""

    @pytest.fixture
    def client(self):
        """Flask test client mínimo — solo registra el webhook blueprint."""
        # Mock de módulos no instalados en env de tests (antes de importar el bp)
        mock_eventlet = MagicMock()
        mock_eventlet.sleep = MagicMock()
        mock_eventlet.spawn = MagicMock()

        with patch.dict("sys.modules", {"eventlet": mock_eventlet}):
            from flask import Flask
            from app.controllers.provider_webhook_controller import provider_webhooks_bp

            flask_app = Flask(__name__)
            flask_app.config["TESTING"] = True
            flask_app.config["SECRET_KEY"] = "test-secret-key-for-webhooks"
            flask_app.register_blueprint(provider_webhooks_bp)

            with flask_app.test_client() as c:
                yield c

    @patch("app.controllers.provider_webhook_controller._get_integration_account")
    @patch("app.controllers.provider_webhook_controller.save_inbox_event")
    @patch("app.controllers.provider_webhook_controller.process_inbox_event")
    def test_rappi_webhook_returns_200(
        self, mock_process, mock_save, mock_get_account, client
    ):
        """Webhook Rappi responde 200 inmediatamente."""
        inbox_id = str(uuid.uuid4())
        mock_get_account.return_value = {"credentials": {}}
        mock_save.return_value = (inbox_id, False)
        mock_process.return_value = None

        resp = client.post(
            "/providers/webhooks/rappi?restaurantId=r-uuid&branchId=b-uuid",
            json={"id": "rappi-order-1", "status": "created", "products": []},
            content_type="application/json",
        )

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
        assert data["inbox_id"] == inbox_id

    @patch("app.controllers.provider_webhook_controller._get_integration_account")
    @patch("app.controllers.provider_webhook_controller.save_inbox_event")
    def test_rappi_webhook_duplicate_returns_200(
        self, mock_save, mock_get_account, client
    ):
        """Webhook duplicado retorna 200 con duplicate=True."""
        mock_get_account.return_value = {"credentials": {}}
        mock_save.return_value = (None, True)  # es duplicado

        resp = client.post(
            "/providers/webhooks/rappi?restaurantId=r-uuid",
            json={"id": "rappi-order-1", "status": "created"},
            content_type="application/json",
        )

        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get("duplicate") is True

    def test_rappi_webhook_missing_restaurant_id(self, client):
        """Webhook sin restaurantId retorna 400."""
        resp = client.post(
            "/providers/webhooks/rappi",
            json={"id": "order-1"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_rappi_ping_returns_200(self, client):
        """Ping de Rappi retorna 200."""
        resp = client.get("/providers/webhooks/rappi/ping")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["provider"] == "rappi"

    @patch("app.controllers.provider_webhook_controller._get_integration_account")
    def test_rappi_webhook_invalid_signature(self, mock_get_account, client):
        """Webhook con firma inválida retorna 401."""
        mock_get_account.return_value = {
            "credentials": {"webhook_secret": "real-secret"}
        }

        resp = client.post(
            "/providers/webhooks/rappi?restaurantId=r-uuid",
            data=b'{"id":"order-1","status":"created"}',
            content_type="application/json",
            headers={"X-Rappi-Hmac-Signature": "invalid-sig"},
        )

        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Tests de integración: order_service + outbox
# ---------------------------------------------------------------------------

class TestOrderServiceProviderIntegration:
    """Tests para verificar que order_service crea outbox jobs en órdenes de proveedor."""

    @patch("app.services.order_service.supabase")
    @patch("app.services.order_service.execute_with_retry")
    @patch("app.services.order_service.socketio")
    def test_update_status_creates_outbox_job_for_rappi(
        self, mock_socket, mock_retry, mock_supabase
    ):
        """
        Al aceptar una orden Rappi (→ IN_PREPARATION),
        se crea un job en provider_outbox_jobs.
        """
        from app.services.order_service import OrderService

        service = OrderService()
        order_id = str(uuid.uuid4())

        # Simular orden de Rappi
        rappi_order = {
            "id": order_id,
            "status": "PAYMENT_APPROVED",
            "source": "rappi",
            "provider_order_id": "rappi-order-1",
            "restaurant_id": "r-uuid",
            "branch_id": "b-uuid",
            "mesa_id": "rappi-rappi-order-1",
            "total_amount": 1500,
            "items": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        updated_order = {**rappi_order, "status": "IN_PREPARATION"}

        # Mockear _get_order_raw y supabase update
        mock_retry.side_effect = [
            MagicMock(data=[rappi_order]),   # _get_order_raw
        ]
        # supabase.table().update().eq().execute() → updated order
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[updated_order])

        with patch.object(service, "_create_provider_outbox_job") as mock_outbox:
            service.update_order_status(order_id, "IN_PREPARATION")
            mock_outbox.assert_called_once_with(updated_order, "IN_PREPARATION")

    def test_create_provider_outbox_job_confirm(self):
        """_create_provider_outbox_job crea job 'confirm_order' para IN_PREPARATION."""
        from app.services.order_service import OrderService

        service = OrderService()
        order = {
            "id": "o-uuid",
            "source": "rappi",
            "provider_order_id": "rappi-1",
            "restaurant_id": "r-uuid",
            "branch_id": "b-uuid",
        }

        with patch("app.integrations.outbox_service.create_outbox_job") as mock_create:
            service._create_provider_outbox_job(order, "IN_PREPARATION")
            mock_create.assert_called_once_with(
                provider="rappi",
                action="confirm_order",
                restaurant_id="r-uuid",
                order_id="o-uuid",
                provider_order_id="rappi-1",
                payload={},
                branch_id="b-uuid",
            )

    def test_create_provider_outbox_job_reject(self):
        """_create_provider_outbox_job crea job 'reject_order' para CANCELLED."""
        from app.services.order_service import OrderService

        service = OrderService()
        order = {
            "id": "o-uuid",
            "source": "pedidosya",
            "provider_order_id": "py-1",
            "restaurant_id": "r-uuid",
            "branch_id": "b-uuid",
        }

        with patch("app.integrations.outbox_service.create_outbox_job") as mock_create:
            service._create_provider_outbox_job(order, "CANCELLED")
            mock_create.assert_called_once_with(
                provider="pedidosya",
                action="reject_order",
                restaurant_id="r-uuid",
                order_id="o-uuid",
                provider_order_id="py-1",
                payload={"reason": "RESTAURANT_CANCELLED"},
                branch_id="b-uuid",
            )

    def test_create_provider_outbox_job_no_action_for_payment_approved(self):
        """PAYMENT_APPROVED no crea job outbox (es el estado inicial, no una acción)."""
        from app.services.order_service import OrderService

        service = OrderService()
        order = {
            "id": "o-uuid",
            "source": "rappi",
            "provider_order_id": "rappi-1",
            "restaurant_id": "r-uuid",
            "branch_id": None,
        }

        with patch("app.integrations.outbox_service.create_outbox_job") as mock_create:
            service._create_provider_outbox_job(order, "PAYMENT_APPROVED")
            mock_create.assert_not_called()

    def test_serialize_order_includes_source_fields(self):
        """_serialize_order incluye source y provider_order_id en la respuesta."""
        from app.services.order_service import OrderService

        service = OrderService()
        order = {
            "id": "o-uuid",
            "mesa_id": "rappi-order-1",
            "status": "PAYMENT_APPROVED",
            "items": [],
            "total_amount": 1500,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source": "rappi",
            "provider_order_id": "rappi-order-1",
            "restaurant_id": "r-uuid",
            "branch_id": "b-uuid",
        }

        result = service._serialize_order(order)

        assert result["source"] == "rappi"
        assert result["provider_order_id"] == "rappi-order-1"

    def test_serialize_order_defaults_source_to_app(self):
        """_serialize_order retorna source='app' si no está en la orden."""
        from app.services.order_service import OrderService

        service = OrderService()
        order = {
            "id": "o-uuid",
            "mesa_id": "mesa_1",
            "status": "PAID",
            "items": [],
            "total_amount": 500,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = service._serialize_order(order)
        assert result["source"] == "app"
        assert result["provider_order_id"] is None


# ---------------------------------------------------------------------------
# Tests de estado machine (nueva transición PAYMENT_APPROVED → CANCELLED)
# ---------------------------------------------------------------------------

class TestOrderStatusMachine:
    """Tests para verificar transiciones de estado."""

    def test_payment_approved_to_cancelled_is_valid(self):
        """PAYMENT_APPROVED → CANCELLED es una transición válida (para rechazar delivery)."""
        from app.services.order_service import OrderService

        service = OrderService()
        assert service._is_valid_status_transition("PAYMENT_APPROVED", "CANCELLED") is True

    def test_payment_approved_to_in_preparation_is_valid(self):
        """PAYMENT_APPROVED → IN_PREPARATION sigue siendo válido."""
        from app.services.order_service import OrderService

        service = OrderService()
        assert service._is_valid_status_transition("PAYMENT_APPROVED", "IN_PREPARATION") is True

    def test_delivered_to_cancelled_is_invalid(self):
        """DELIVERED → CANCELLED no debe ser válido."""
        from app.services.order_service import OrderService

        service = OrderService()
        assert service._is_valid_status_transition("DELIVERED", "CANCELLED") is False
