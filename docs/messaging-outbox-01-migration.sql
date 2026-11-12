-- ============================================================================
-- docs/messaging-outbox-01-migration.sql
--
-- V61 B.2.16 — Channel-agnostic messaging outbox (email | sms) + customer opt-out
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sms_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.messaging_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  customer_id uuid,
  recipient text NOT NULL,
  template_key text NOT NULL,
  template_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped_opt_out', 'blocked_no_provider')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

REVOKE ALL ON messaging_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON messaging_outbox TO authenticated, service_role;

ALTER TABLE messaging_outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'messaging_outbox' AND policyname = 'messaging_outbox_ws_isolation'
  ) THEN
    CREATE POLICY messaging_outbox_ws_isolation ON messaging_outbox
      FOR ALL TO authenticated
      USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
      WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
  END IF;
END $$;

-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.messaging_outbox;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS sms_opt_out;
