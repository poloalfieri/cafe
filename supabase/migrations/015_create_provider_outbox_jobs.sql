-- Jobs de outbox para acciones hacia proveedores externos (PedidosYa, Rappi)
-- Todas las llamadas a APIs de proveedores pasan por este outbox con reintentos
-- El cajero NO llama la API del proveedor directamente: crea un job y el worker lo ejecuta

CREATE TABLE IF NOT EXISTS provider_outbox_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL,                  -- 'rappi' | 'pedidosya'
    action TEXT NOT NULL,                    -- 'confirm_order' | 'reject_order' | 'update_status'
    order_id UUID,                           -- referencia a orders.id (nullable para jobs de reconciliación)
    provider_order_id TEXT,                  -- ID de la orden en el proveedor
    payload JSONB NOT NULL DEFAULT '{}',     -- datos adicionales para el job
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),
    last_error TEXT,                         -- último error para DLQ/observabilidad
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    restaurant_id UUID NOT NULL,
    branch_id UUID
);

-- Índice principal para el worker (busca pending/running con retry ready)
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON provider_outbox_jobs(status, next_retry_at)
    WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_outbox_restaurant
    ON provider_outbox_jobs(restaurant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_order
    ON provider_outbox_jobs(order_id)
    WHERE order_id IS NOT NULL;
