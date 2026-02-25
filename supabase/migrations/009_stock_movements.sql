-- Migration 009: Historial de movimientos de stock

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    qty NUMERIC NOT NULL,           -- positivo = ingreso, negativo = egreso
    type TEXT NOT NULL CHECK (type IN ('sale', 'adjustment', 'import', 'waste', 'return')),
    reason TEXT,
    source TEXT,                    -- 'order:{uuid}', 'manual', 'csv_import'
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branch_id UUID,
    restaurant_id UUID
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_restaurant ON stock_movements(restaurant_id);
