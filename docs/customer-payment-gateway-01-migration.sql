-- ============================================================================
-- docs/customer-payment-gateway-01-migration.sql
--
-- V61 B.2.12 — Provider-neutral customer payment gateway webhook events
--   - Idempotent via UNIQUE (workspace_id, provider, external_event_id)
--   - Status stays BLOCKED_EXTERNAL_CREDENTIAL until a provider is configured
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_gateway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  invoice_id uuid,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  payment_id uuid,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, external_event_id)
);

REVOKE ALL ON payment_gateway_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON payment_gateway_events TO service_role;

ALTER TABLE payment_gateway_events ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.payment_gateway_events;


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
       AND tablename = ANY (ARRAY['payment_gateway_events'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.payment_gateway_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_gateway_events FROM PUBLIC, anon, authenticated;
