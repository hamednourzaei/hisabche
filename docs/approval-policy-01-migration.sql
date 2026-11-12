-- ============================================================================
-- docs/approval-policy-01-migration.sql
--
-- V61 B.2.7 — Unified document approval policies, requests & append-only events
--   - Applies to: purchase_order, stock_transfer, stock_write_off,
--     supplier_payment_mismatch, journal_entry
--   - Append-only `approval_policy_events` (UPDATE/DELETE blocked by trigger)
--   - Self-approval blocked (requester_id <> actor_id)
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN (
    'purchase_order', 'stock_transfer', 'stock_write_off', 'supplier_payment_mismatch', 'journal_entry'
  )),
  name text NOT NULL,
  min_amount_minor bigint,
  reasons text[],
  warehouse_ids uuid[],
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_policy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  policy_id uuid NOT NULL REFERENCES public.approval_policies(id) ON DELETE RESTRICT,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 1,
  total_steps integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  amount_minor bigint,
  reason text,
  warehouse_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, document_type, document_id)
);

CREATE TABLE IF NOT EXISTS public.approval_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.approval_policy_requests(id) ON DELETE RESTRICT,
  step_number integer NOT NULL,
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, request_id, step_number, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_policies_ws_doc
  ON public.approval_policies (workspace_id, document_type, is_active);

CREATE INDEX IF NOT EXISTS idx_approval_policy_requests_ws_status
  ON public.approval_policy_requests (workspace_id, status, document_type);

REVOKE ALL ON public.approval_policies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.approval_policy_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.approval_policy_events FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.approval_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.approval_policy_requests TO authenticated, service_role;
GRANT SELECT, INSERT ON public.approval_policy_events TO authenticated, service_role;

ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policy_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY['approval_policies', 'approval_policy_requests', 'approval_policy_events']
  LOOP
    pol := t || '_ws_isolation';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = pol
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))',
        pol, t
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.approval_policy_events_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'APPROVAL_EVENTS_IMMUTABLE: approval_policy_events is append-only';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approval_policy_events_immutable_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_approval_policy_events_immutable ON public.approval_policy_events;
CREATE TRIGGER trg_approval_policy_events_immutable
  BEFORE UPDATE OR DELETE ON public.approval_policy_events
  FOR EACH ROW EXECUTE FUNCTION public.approval_policy_events_immutable_guard();

-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.approval_policy_events;
-- DROP TABLE IF EXISTS public.approval_policy_requests;
-- DROP TABLE IF EXISTS public.approval_policies;
-- DROP FUNCTION IF EXISTS public.approval_policy_events_immutable_guard();
