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
GRANT SELECT ON overhead_policies, public.overhead_allocation_runs TO authenticated;
GRANT ALL ON overhead_policies, public.overhead_allocation_runs TO service_role;

DROP POLICY IF EXISTS overhead_policies_members_read ON overhead_policies;
CREATE POLICY overhead_policies_members_read ON overhead_policies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members m
                  WHERE m.workspace_id = overhead_policies.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS overhead_runs_members_read ON overhead_allocation_runs;
CREATE POLICY overhead_runs_members_read ON overhead_allocation_runs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members m
                  WHERE m.workspace_id = overhead_allocation_runs.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.overhead_allocation_runs;
-- DROP TABLE IF EXISTS public.overhead_policies;
