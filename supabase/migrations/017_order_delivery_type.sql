-- Add delivery type to distinguish drop-off vs pickup orders on Delivery mesa
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_delivery_type_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_delivery_type_check
    CHECK (delivery_type IN ('DELIVERY', 'TAKE_AWAY'));
  END IF;
END $$;
