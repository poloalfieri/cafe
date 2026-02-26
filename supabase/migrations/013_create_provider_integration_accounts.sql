-- Cuentas de integración por proveedor (PedidosYa, Rappi) por restaurante/sucursal
-- Modelo híbrido: credenciales del restaurante en DB, fallback a ENV vars globales
-- Mismo patrón que payment_configs para MercadoPago

CREATE TABLE IF NOT EXISTS provider_integration_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    branch_id UUID,                          -- NULL = nivel restaurante (aplica a todas las sucursales)
    provider TEXT NOT NULL,                  -- 'rappi' | 'pedidosya'
    enabled BOOLEAN NOT NULL DEFAULT false,
    credentials JSONB NOT NULL DEFAULT '{}', -- credenciales específicas del restaurante
    -- Rappi:     {"client_id": "", "client_secret": "", "store_id": "", "webhook_secret": ""}
    -- PedidosYa: {"api_key": "", "secret": "", "store_id": "", "integration_token": ""}
    settings JSONB NOT NULL DEFAULT '{}',    -- configuración adicional por sucursal
    -- Ejemplo:   {"notify_on_new": true, "auto_reject_after_minutes": null}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, branch_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_pia_restaurant_provider
    ON provider_integration_accounts(restaurant_id, provider, enabled);

CREATE INDEX IF NOT EXISTS idx_pia_branch
    ON provider_integration_accounts(branch_id, provider)
    WHERE branch_id IS NOT NULL;
