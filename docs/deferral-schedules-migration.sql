-- ============================================================================
-- docs/deferral-schedules-migration.sql
--
-- Option 4: Deferred Revenue Schedules
-- Tenant-isolated, additive, idempotent.
--
-- RUN ORDER: this file, then docs/VERIFY-deferral-schedules.sql.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.deferral_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  source_invoice_id uuid NOT NULL,
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  periods integer NOT NULL CHECK (periods > 0),
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deferral_schedule_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.deferral_schedules(id) ON DELETE CASCADE,
  period_index integer NOT NULL,
  recognition_date date NOT NULL,
  amount_minor bigint NOT NULL,
  is_recognized boolean NOT NULL DEFAULT false,
  journal_entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deferral_schedules_workspace
  ON public.deferral_schedules (workspace_id);

CREATE INDEX IF NOT EXISTS idx_deferral_schedule_lines_schedule
  ON public.deferral_schedule_lines (schedule_id);

REVOKE ALL ON public.deferral_schedules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.deferral_schedule_lines FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deferral_schedules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deferral_schedule_lines TO service_role;

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TABLE IF EXISTS public.deferral_schedule_lines CASCADE;
-- DROP TABLE IF EXISTS public.deferral_schedules CASCADE;
