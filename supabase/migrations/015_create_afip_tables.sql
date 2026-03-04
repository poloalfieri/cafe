-- ============================================================
-- Tablas para facturación electrónica AFIP/ARCA
-- Configuración por restaurante, cache de tokens WSAA,
-- y registro de comprobantes emitidos (facturas y notas de crédito)
-- ============================================================

-- Configuración AFIP por restaurante (cert/key encriptados con AES-256-GCM)
CREATE TABLE IF NOT EXISTS restaurant_afip_config (
    restaurant_id UUID PRIMARY KEY,
    cuit VARCHAR(11) NOT NULL,
    iva_condition VARCHAR(20) NOT NULL CHECK (iva_condition IN ('MONOTRIBUTO', 'RI')),
    environment VARCHAR(10) NOT NULL DEFAULT 'homo' CHECK (environment IN ('homo', 'prod')),
    cert_pem_enc TEXT,
    key_pem_enc TEXT,
    key_pass_enc TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache de tokens WSAA (evita re-autenticación en cada request)
CREATE TABLE IF NOT EXISTS restaurant_afip_tokens (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    environment VARCHAR(10) NOT NULL,
    service VARCHAR(20) NOT NULL DEFAULT 'wsfe',
    token TEXT NOT NULL,
    sign TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, environment, service)
);

CREATE INDEX IF NOT EXISTS idx_afip_tokens_lookup
    ON restaurant_afip_tokens (restaurant_id, environment, service);

-- Comprobantes emitidos (facturas A/B/C y notas de crédito A/B/C)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    branch_id UUID,
    order_id UUID,
    cuit VARCHAR(11) NOT NULL,
    pto_vta INT NOT NULL,
    cbte_tipo INT NOT NULL,
    cbte_nro INT NOT NULL,
    cae VARCHAR(14),
    cae_vto DATE,
    doc_tipo INT NOT NULL DEFAULT 99,
    doc_nro BIGINT NOT NULL DEFAULT 0,
    imp_total NUMERIC(12, 2) NOT NULL,
    mon_id VARCHAR(3) NOT NULL DEFAULT 'PES',
    mon_cotiz NUMERIC(10, 6) NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'AUTHORIZED' CHECK (status IN ('AUTHORIZED', 'REJECTED')),
    qr_url TEXT,
    afip_result VARCHAR(10),
    afip_err TEXT,
    afip_request JSONB,
    afip_response JSONB,
    associated_invoice_id UUID REFERENCES invoices(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cuit, pto_vta, cbte_tipo, cbte_nro)
);

CREATE INDEX IF NOT EXISTS idx_invoices_restaurant ON invoices (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices (restaurant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices (order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices (restaurant_id, created_at DESC);

-- Columna associated_invoice_id en invoices (para notas de crédito)
-- Se agrega por separado porque la tabla puede existir de antes sin esta columna
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'associated_invoice_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN associated_invoice_id UUID REFERENCES invoices(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_associated ON invoices (associated_invoice_id)
    WHERE associated_invoice_id IS NOT NULL;

-- Columnas AFIP en branches (punto de venta por sucursal)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'branches' AND column_name = 'afip_pto_vta'
    ) THEN
        ALTER TABLE branches ADD COLUMN afip_pto_vta INT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'branches' AND column_name = 'afip_share_pto_vta_branch_id'
    ) THEN
        ALTER TABLE branches ADD COLUMN afip_share_pto_vta_branch_id UUID;
    END IF;
END $$;
