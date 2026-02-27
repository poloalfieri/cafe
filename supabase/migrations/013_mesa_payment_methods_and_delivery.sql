-- Add configurable payment methods per mesa
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS allowed_payment_methods TEXT[] DEFAULT ARRAY['CASH','CARD','QR','MERCADOPAGO'];

-- Add delivery-specific fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
-- Add configurable payment methods per mesa
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS allowed_payment_methods TEXT[] DEFAULT ARRAY['CASH','CARD','QR','MERCADOPAGO'];

-- Add delivery-specific fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
