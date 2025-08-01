-- Crear tabla de mesas
CREATE TABLE IF NOT EXISTS mesas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mesa_id TEXT UNIQUE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_mesas_mesa_id ON mesas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_mesas_token ON mesas(token);
CREATE INDEX IF NOT EXISTS idx_mesas_token_expires ON mesas(token_expires_at);

-- Función para generar tokens únicos
CREATE OR REPLACE FUNCTION generate_mesa_token() RETURNS TEXT AS $$
BEGIN
    RETURN 'token_' || substr(md5(random()::text), 1, 16) || '_' || extract(epoch from now())::bigint;
END;
$$ LANGUAGE plpgsql;

-- Función para renovar tokens de mesa
CREATE OR REPLACE FUNCTION renew_mesa_token(mesa_id_param TEXT) RETURNS TEXT AS $$
DECLARE
    new_token TEXT;
BEGIN
    -- Generar nuevo token
    new_token := generate_mesa_token();
    
    -- Actualizar o insertar mesa con nuevo token
    INSERT INTO mesas (mesa_id, token, token_expires_at)
    VALUES (mesa_id_param, new_token, NOW() + INTERVAL '30 minutes')
    ON CONFLICT (mesa_id) 
    DO UPDATE SET 
        token = EXCLUDED.token,
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = NOW();
    
    RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Función para validar token de mesa
CREATE OR REPLACE FUNCTION validate_mesa_token(mesa_id_param TEXT, token_param TEXT) RETURNS BOOLEAN AS $$
DECLARE
    mesa_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM mesas 
        WHERE mesa_id = mesa_id_param 
        AND token = token_param 
        AND token_expires_at > NOW()
        AND is_active = true
    ) INTO mesa_exists;
    
    RETURN mesa_exists;
END;
$$ LANGUAGE plpgsql;

-- Insertar mesas de prueba
INSERT INTO mesas (mesa_id, token, token_expires_at) VALUES 
('1', 'token_test_123_' || extract(epoch from now())::bigint, NOW() + INTERVAL '30 minutes'),
('2', 'token_test_456_' || extract(epoch from now())::bigint, NOW() + INTERVAL '30 minutes'),
('3', 'token_test_789_' || extract(epoch from now())::bigint, NOW() + INTERVAL '30 minutes')
ON CONFLICT (mesa_id) DO NOTHING; 