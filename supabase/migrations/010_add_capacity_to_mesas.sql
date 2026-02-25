-- Add capacity (people per table) to mesas
ALTER TABLE mesas
  ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- Ensure existing rows always have a valid default value
UPDATE mesas
SET capacity = 4
WHERE capacity IS NULL;

ALTER TABLE mesas
  ALTER COLUMN capacity SET DEFAULT 4;

ALTER TABLE mesas
  ALTER COLUMN capacity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_mesas_capacity'
      AND conrelid = 'mesas'::regclass
  ) THEN
    ALTER TABLE mesas
      ADD CONSTRAINT check_mesas_capacity CHECK (capacity > 0);
  END IF;
END $$;
