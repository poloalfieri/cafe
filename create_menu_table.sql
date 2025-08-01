-- Script para crear la tabla menu en Supabase
-- Ejecuta este script en el SQL Editor de Supabase

-- Crear tabla de menú
CREATE TABLE IF NOT EXISTS menu (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_menu_category ON menu(category);
CREATE INDEX IF NOT EXISTS idx_menu_available ON menu(available);
CREATE INDEX IF NOT EXISTS idx_menu_created_at ON menu(created_at);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_menu_updated_at ON menu;
CREATE TRIGGER update_menu_updated_at 
    BEFORE UPDATE ON menu 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insertar datos de prueba
INSERT INTO menu (name, category, price, description, available) VALUES 
('Café Americano', 'Bebidas', 2.50, 'Café negro tradicional', TRUE),
('Cappuccino', 'Bebidas', 3.00, 'Café con leche espumada', TRUE),
('Café Latte', 'Bebidas', 3.50, 'Café con leche cremosa', TRUE),
('Croissant', 'Pastelería', 2.00, 'Croissant de mantequilla', TRUE),
('Tarta de Manzana', 'Postres', 4.50, 'Tarta casera de manzana', TRUE),
('Ensalada César', 'Entradas', 8.00, 'Ensalada con aderezo César', TRUE),
('Pasta Carbonara', 'Platos Principales', 12.00, 'Pasta con salsa carbonara', TRUE),
('Tiramisú', 'Postres', 5.00, 'Postre italiano tradicional', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Verificar que la tabla se creó correctamente
SELECT * FROM menu LIMIT 5; 