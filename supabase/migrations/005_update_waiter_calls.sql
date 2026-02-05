-- 005_update_waiter_calls.sql
-- Add missing columns, update status values and add updated_at trigger

-- Add columns that exist in the backend model but not in the original migration
ALTER TABLE waiter_calls ADD COLUMN IF NOT EXISTS usuario_id VARCHAR(100);
ALTER TABLE waiter_calls ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE waiter_calls ADD COLUMN IF NOT EXISTS motivo VARCHAR(50);

-- Migrate existing ATTENDED rows to COMPLETED
UPDATE waiter_calls SET status = 'COMPLETED' WHERE status = 'ATTENDED';

-- Trigger to auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_waiter_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_waiter_calls_updated_at ON waiter_calls;
CREATE TRIGGER trg_waiter_calls_updated_at
    BEFORE UPDATE ON waiter_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_waiter_calls_updated_at();
