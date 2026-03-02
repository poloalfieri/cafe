-- 014_cash_single_register.sql
-- Migrar sistema de caja a "caja unica por sucursal + sesiones con titulo + horarios"

-- ============================================================
-- 1. Agregar title a cash_sessions (nullable primero, NOT NULL despues de backfill)
-- ============================================================
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS title text;

-- ============================================================
-- 2. Desactivar registers extra por branch (dejar solo el mas nuevo)
-- ============================================================
UPDATE cash_registers
SET active = false, updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT ON (branch_id) id
  FROM cash_registers
  WHERE active = true
  ORDER BY branch_id, created_at DESC
)
AND active = true;

-- ============================================================
-- 3. Indice unico: 1 register activo por branch
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS cash_registers_one_active_per_branch
  ON cash_registers(branch_id) WHERE active = true;

-- ============================================================
-- 4. Indice unico: 1 sesion OPEN por register (previene doble apertura)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_register
  ON cash_sessions(register_id) WHERE status = 'OPEN';

-- ============================================================
-- 5. Tabla de configuracion de horarios por sucursal
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_schedule_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  branch_id uuid NOT NULL UNIQUE,
  expected_open_time time,
  expected_close_time time,
  auto_close_grace_minutes int NOT NULL DEFAULT 120,
  updated_by_user_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. Campos nuevos en cash_sessions para horarios esperados y extension
-- ============================================================
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS expected_open_at timestamptz;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS expected_close_at timestamptz;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS close_source text;           -- 'MANUAL'
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS extended_close_at timestamptz;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS extended_by_user_id text;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS extended_reason text;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS requires_final_count boolean NOT NULL DEFAULT false;

