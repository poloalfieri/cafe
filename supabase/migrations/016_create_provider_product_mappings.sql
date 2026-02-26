-- Mapeo explícito de productos del proveedor a productos internos del menú
-- Permite que órdenes delivery consuman stock cuando el producto está mapeado
-- Si no hay mapeo, el item se guarda como opaco (sin consumo de stock)

CREATE TABLE IF NOT EXISTS provider_product_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    branch_id UUID,                          -- NULL = aplica a todas las sucursales del restaurante
    provider TEXT NOT NULL,                  -- 'rappi' | 'pedidosya'
    provider_product_id TEXT NOT NULL,       -- ID del producto en el sistema del proveedor
    menu_product_id BIGINT NOT NULL,         -- referencias a menu.id interno
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, branch_id, provider, provider_product_id)
);

CREATE INDEX IF NOT EXISTS idx_ppm_restaurant_provider
    ON provider_product_mappings(restaurant_id, provider);

CREATE INDEX IF NOT EXISTS idx_ppm_branch_provider
    ON provider_product_mappings(branch_id, provider)
    WHERE branch_id IS NOT NULL;
