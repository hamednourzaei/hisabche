-- ============================================================================
-- docs/overhead-allocation-01-migration.sql
--
-- V61 §2.7 — Overhead allocation policy (versioned) and idempotent period runs.
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.overhead_policies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  basis               text NOT NULL CHECK (basis IN ('revenue_share', 'labour_hours', 'direct_cost', 'manual')),
  source_account_ids  uuid[] NOT NULL,
  target_dimension_id uuid NOT NULL,
  manual_weights      jsonb,
  version             integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS overhead_policies_ws_active_idx
  ON overhead_policies (workspace_id, is_active, version DESC);

CREATE TABLE IF NOT EXISTS public.overhead_allocation_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  policy_id        uuid NOT NULL REFERENCES public.overhead_policies(id),
  policy_version   integer NOT NULL,
  period           text NOT NULL,
  currency         text NOT NULL,
  idempotency_key  text NOT NULL,
  pool_amount_minor bigint NOT NULL,
  allocations      jsonb NOT NULL,
  journal_entry_id uuid,
  status           text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  reversed_at      timestamptz,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS overhead_runs_idem_idx
  ON overhead_allocation_runs (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS overhead_runs_ws_period_idx
  ON overhead_allocation_runs (workspace_id, period);

ALTER TABLE overhead_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE overhead_allocation_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON overhead_policies, public.overhead_allocation_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON overhead_policies, public.overhead_allocation_runs TO service_role;
GRANT ALL ON overhead_policies, public.overhead_allocation_runs TO service_role;



-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.overhead_allocation_runs;
-- DROP TABLE IF EXISTS public.overhead_policies;


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
       AND tablename = ANY (ARRAY['overhead_policies', 'overhead_allocation_runs'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.overhead_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.overhead_policies FROM PUBLIC, anon, authenticated;
ALTER TABLE public.overhead_allocation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.overhead_allocation_runs FROM PUBLIC, anon, authenticated;
