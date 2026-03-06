-- Add extra delivery fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_floor_apt TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;
