-- ============================================
-- docs/payment-gateway-events-01-migration.sql
--
-- P0 / P1 (X10): Append-only immutable event trail for gateway & offline card
-- state transitions + HMAC webhook verification log.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_gateway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL CHECK (
    to_state IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided')
  ),
  gateway_name text,
  external_ref text,
  fee_minor integer NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  signature_verified boolean NOT NULL DEFAULT false,
  reason text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_events_ws_pay
  ON public.payment_gateway_events (workspace_id, payment_id, created_at ASC);

ALTER TABLE public.payment_gateway_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_gateway_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.payment_gateway_events TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_gateway_events'
      AND policyname = 'payment_gateway_events_workspace_isolation'
  ) THEN
    CREATE POLICY payment_gateway_events_workspace_isolation ON public.payment_gateway_events
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      );
  END IF;
END $$;

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS public.payment_gateway_events;
