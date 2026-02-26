-- Inbox de eventos de webhooks entrantes (PedidosYa, Rappi)
-- Garantiza idempotencia: cada evento se guarda una sola vez (dedupe_key UNIQUE)
-- El procesamiento es async; el webhook responde 200 inmediatamente

CREATE TABLE IF NOT EXISTS order_events_inbox (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL,                  -- 'rappi' | 'pedidosya'
    event_type TEXT,                         -- 'order_created' | 'order_updated' | 'order_cancelled'
    dedupe_key TEXT NOT NULL,                -- 'rappi:{request_id}' | 'pedidosya:{order_id}'
    raw_headers JSONB,                       -- headers del request original (para debugging)
    raw_body JSONB,                          -- body completo del webhook
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | processed | skipped | failed
    error_message TEXT,                      -- detalle del error si status='failed'
    restaurant_id UUID,
    branch_id UUID,
    UNIQUE(dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_inbox_status_received
    ON order_events_inbox(status, received_at);

CREATE INDEX IF NOT EXISTS idx_inbox_provider
    ON order_events_inbox(provider, received_at);

CREATE INDEX IF NOT EXISTS idx_inbox_restaurant
    ON order_events_inbox(restaurant_id, received_at)
    WHERE restaurant_id IS NOT NULL;
