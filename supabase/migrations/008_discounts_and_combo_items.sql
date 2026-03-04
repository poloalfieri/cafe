-- Migration 008: Extensión de promotions para descuentos manuales + combo_items + campos en orders

-- Extensión de la tabla promotions:
-- is_manual: true = el cajero la aplica manualmente por ítem; false = se aplica automáticamente
-- applies_to_all: true = visible y aplicable a todos los usuarios (panel público)
ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN DEFAULT false;

-- Productos que componen un combo (relacionado con promotions type='combo')
CREATE TABLE IF NOT EXISTS combo_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE (promotion_id, product_id)
);

-- Campos de descuento en orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES promotions(id),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promotions_applied JSONB DEFAULT '[]'::jsonb;
    -- promotions_applied: [{id, name, type, saving_amount}]
