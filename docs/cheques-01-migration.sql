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
GRANT SELECT, INSERT, UPDATE ON cheques TO authenticated, service_role;

ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'cheques' AND policyname = 'cheques_ws_isolation'
  ) THEN
    CREATE POLICY cheques_ws_isolation ON cheques
      FOR ALL TO authenticated
      USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
      WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
  END IF;
END $$;

-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.cheques;
