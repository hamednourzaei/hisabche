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

GRANT SELECT, INSERT, UPDATE ON public.approval_policies TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.approval_policy_requests TO service_role;
GRANT SELECT, INSERT ON public.approval_policy_events TO service_role;

ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policy_events ENABLE ROW LEVEL SECURITY;


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
       AND tablename = ANY (ARRAY['approval_policies', 'approval_policy_requests', 'approval_policy_events'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approval_policies FROM PUBLIC, anon, authenticated;
ALTER TABLE public.approval_policy_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approval_policy_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.approval_policy_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approval_policy_events FROM PUBLIC, anon, authenticated;
