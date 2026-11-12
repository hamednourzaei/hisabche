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
GRANT SELECT, INSERT ON payment_gateway_events TO authenticated, service_role;

ALTER TABLE payment_gateway_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'payment_gateway_events' AND policyname = 'payment_gateway_events_ws_isolation'
  ) THEN
    CREATE POLICY payment_gateway_events_ws_isolation ON payment_gateway_events
      FOR ALL TO authenticated
      USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
      WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
  END IF;
END $$;

-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.payment_gateway_events;
