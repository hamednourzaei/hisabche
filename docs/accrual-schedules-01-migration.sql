-- ============================================================================
-- docs/accrual-schedules-01-migration.sql
--
-- V61 B.2.4 — Accrual / prepayment schedules & auto-reversing journals
--   - `accrual_schedules` + `accrual_schedule_periods` (one row per period, unique)
--   - `journal_entries.reverse_on` + `journal_entries.auto_reversed_entry_id`
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accrual_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  source_document_type text NOT NULL,
  source_document_id uuid NOT NULL,
  description text NOT NULL,
  total_amount_minor bigint NOT NULL CHECK (total_amount_minor > 0),
  currency text NOT NULL,
  periods_count integer NOT NULL CHECK (periods_count >= 1 AND periods_count <= 120),
  start_date date NOT NULL,
  debit_account_id uuid NOT NULL,
  credit_account_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accrual_schedule_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.accrual_schedules(id) ON DELETE CASCADE,
  period_index integer NOT NULL CHECK (period_index >= 1),
  period_date date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'locked_failed')),
  journal_entry_id uuid,
  error_code text,
  posted_at timestamptz,
  UNIQUE (workspace_id, schedule_id, period_index)
);

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS reverse_on date,
  ADD COLUMN IF NOT EXISTS auto_reversed_entry_id uuid;

REVOKE ALL ON public.accrual_schedules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.accrual_schedule_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accrual_schedules TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.accrual_schedule_periods TO service_role;

ALTER TABLE public.accrual_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accrual_schedule_periods ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.accrual_schedule_periods;
-- DROP TABLE IF EXISTS public.accrual_schedules;
-- ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS auto_reversed_entry_id, DROP COLUMN IF EXISTS reverse_on;


-- ---------------------------------------------------------------------------
-- CLIENT LOCKDOWN (V61 audit, 12 Nov 2026).
--
-- These tables are reached ONLY through the backend (service_role), which
-- checks the capability of the person asking. A policy "FOR ALL TO
-- authenticated USING (workspace member)" let ANY member of the workspace —
-- a seller included — write these rows straight through the Supabase API and
-- skip every capability check (e.g. approve their own request, overwrite
-- another member's 2FA enrollment). RLS stays ON with NO policy; clients get
-- nothing. Idempotent: on a database where the earlier version of this file
-- already ran, it drops whatever policies exist on these tables.
-- ---------------------------------------------------------------------------
DO $lockdown$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY (ARRAY['accrual_schedules', 'accrual_schedule_periods'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.accrual_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accrual_schedules FROM PUBLIC, anon, authenticated;
ALTER TABLE public.accrual_schedule_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accrual_schedule_periods FROM PUBLIC, anon, authenticated;
