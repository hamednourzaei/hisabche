-- ============================================
-- docs/payment-processor-states-01-migration.sql
--
-- P0 / X10: Persistent Offline-to-Online Payment Processor Lifecycle State
-- (`queued_offline`, `pending_capture`, `captured`, `declined`, `voided`).
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_gateway_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  processor_state text NOT NULL CHECK (
    processor_state IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided')
  ),
  gateway_name text,
  external_ref text,
  fee_minor integer NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  currency text NOT NULL CHECK (char_length(currency) = 3),
  reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_states_ws_state
  ON public.payment_gateway_states (workspace_id, processor_state, updated_at DESC);

ALTER TABLE public.payment_gateway_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_gateway_states FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_gateway_states TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_gateway_states'
      AND policyname = 'payment_gateway_states_workspace_isolation'
  ) THEN
    CREATE POLICY payment_gateway_states_workspace_isolation ON public.payment_gateway_states
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
-- DROP TABLE IF EXISTS public.payment_gateway_states;
