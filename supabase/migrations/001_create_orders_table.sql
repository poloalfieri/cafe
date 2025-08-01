-- Crear tabla de órdenes
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mesa_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PAYMENT_PENDING',
    items JSONB NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_orders_mesa_id ON orders(mesa_id);
CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Insertar datos de prueba
INSERT INTO orders (mesa_id, token, status, items) VALUES 
('mesa_1', 'test_token_123', 'PAYMENT_PENDING', '[{"name": "Café", "price": "150", "quantity": 2}]'::jsonb)
ON CONFLICT (token) DO NOTHING;
