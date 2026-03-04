-- Migration 011: agrega porcentaje de desecho configurable por ingrediente

ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS waste_percent NUMERIC;

UPDATE ingredients
SET waste_percent = 0
WHERE waste_percent IS NULL;

ALTER TABLE ingredients
ALTER COLUMN waste_percent SET DEFAULT 0;

ALTER TABLE ingredients
ALTER COLUMN waste_percent SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ingredients_waste_percent_range'
    ) THEN
        ALTER TABLE ingredients
        ADD CONSTRAINT ingredients_waste_percent_range
        CHECK (waste_percent >= 0 AND waste_percent <= 100);
    END IF;
END $$;
