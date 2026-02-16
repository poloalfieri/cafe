-- ============================================================
-- Tablas para gestionar OPCIONALES de productos
-- Permite al admin definir grupos de opciones (ej: "Tipo de Leche")
-- y dentro de cada grupo, items vinculados a ingredientes del stock
-- ============================================================

-- Grupo de opciones para un producto
-- Ej: "Tipo de Leche" con max_selections=1 (radio), "Extras" con max_selections=3 (multi)
CREATE TABLE IF NOT EXISTS product_option_groups (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT false,
    max_selections INT NOT NULL DEFAULT 1,
    restaurant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pog_product ON product_option_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_pog_restaurant ON product_option_groups(restaurant_id);

-- Items individuales dentro de un grupo, vinculados a ingredientes
CREATE TABLE IF NOT EXISTS product_option_items (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
    ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    price_addition DECIMAL(10,2) NOT NULL DEFAULT 0,
    restaurant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_poi_group ON product_option_items(group_id);
CREATE INDEX IF NOT EXISTS idx_poi_ingredient ON product_option_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_poi_restaurant ON product_option_items(restaurant_id);

-- Función para updated_at (créala si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_pog_updated_at
    BEFORE UPDATE ON product_option_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_poi_updated_at
    BEFORE UPDATE ON product_option_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
