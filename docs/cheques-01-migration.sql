-- ============================================================================
-- docs/cheques-01-migration.sql
--
-- V61 B.2.5 — Cheque register & lifecycle
--   - States: received / issued -> deposited / endorsed -> cleared | bounced | cancelled
--   - Endorsed cheques cannot be deposited; one cheque cannot endorse two payments.
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  cheque_number text NOT NULL,
  bank_name text,
  due_date date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'received', 'issued', 'deposited', 'endorsed', 'cleared', 'bounced', 'cancelled'
  )),
  payment_id uuid,
  endorsed_payment_id uuid,
  endorsed_to_supplier_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, direction, cheque_number)
);

CREATE INDEX IF NOT EXISTS idx_cheques_ws_status
  ON cheques (workspace_id, status, due_date);

REVOKE ALL ON cheques FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON cheques TO service_role;

ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.cheques;


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
       AND tablename = ANY (ARRAY['cheques'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cheques FROM PUBLIC, anon, authenticated;
