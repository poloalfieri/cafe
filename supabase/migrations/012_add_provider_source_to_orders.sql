-- Agregar campos de proveedor a la tabla orders
-- Permite que órdenes de PedidosYa/Rappi entren como órdenes nativas

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_data JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- Índice único para evitar duplicados por provider_order_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_order_id
    ON orders(provider_order_id, restaurant_id)
    WHERE provider_order_id IS NOT NULL;
