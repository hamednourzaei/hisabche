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
GRANT SELECT, INSERT, UPDATE ON messaging_outbox TO service_role;

ALTER TABLE messaging_outbox ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.messaging_outbox;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS sms_opt_out;


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
       AND tablename = ANY (ARRAY['messaging_outbox'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.messaging_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messaging_outbox FROM PUBLIC, anon, authenticated;
