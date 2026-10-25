-- ============================================================================
-- docs/core-divergence-migration.sql
--
-- Shadow-mode divergence log for the Local-First Shared Core.
--
-- Records where the shared core's answer disagreed with the server's answer, so
-- a capability can be migrated to local authority on EVIDENCE rather than on
-- confidence. Tenant-isolated, additive, idempotent, safe to re-run.
--
-- ⚠️ WHAT THIS CORRECTS IN THE PREVIOUS VERSION OF THIS FILE.
--
--   1. The policy used   workspace_id = current_setting('app.current_workspace_id')
--      That setting is nowhere in this codebase. Membership is the only
--      boundary (CLAUDE.md §1: «workspace_id تنها مرز امنیتی است»), and every
--      other table in the product decides access through `workspace_members` +
--      `auth.uid()`. A policy reading an application setting nobody sets
--      evaluates to NULL for every row, which denies everyone — including the
--      support engineer who is supposed to read the divergence report. The
--      policy below follows the same membership chain as accounts, invoices,
--      cost_layers and warehouse_stock.
--
--   2. `GRANT SELECT, INSERT ... TO authenticated` let ANY signed-in user read
--      every tenant's divergence rows. Reads are now restricted to the members
--      of the owning workspace through the policy alone; `anon` is revoked.
--
--   3. In Supabase every new table is born with ALL privileges for
--      `service_role`, `anon` and `authenticated`, so a `GRANT` that "narrows"
--      access does nothing until the broader grant is revoked first.
--
-- RUN ORDER: this file, then docs/VERIFY-core-divergence.sql.
-- A human runs both in the SQL Editor. Reported as:
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.core_divergence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  capability text NOT NULL,
  command text NOT NULL,
  command_payload jsonb NOT NULL,
  expected_output jsonb NOT NULL,
  actual_output jsonb NOT NULL,
  diff_summary text NOT NULL,
  rules_version text NOT NULL DEFAULT '1.0.0',
  core_version text NOT NULL DEFAULT '2.0.0',
  detected_at timestamptz NOT NULL DEFAULT now()
);

-- ── privileges: revoke FIRST, then grant the narrow set ────────────────────
ALTER TABLE public.core_divergence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.core_divergence FROM PUBLIC;
REVOKE ALL ON public.core_divergence FROM anon;
REVOKE ALL ON public.core_divergence FROM authenticated;
REVOKE ALL ON public.core_divergence FROM service_role;

-- A member may record a divergence and read their own workspace's. Nobody
-- deletes one: this is evidence, and evidence that can be erased by the party
-- it implicates is not evidence.
GRANT SELECT, INSERT ON public.core_divergence TO authenticated;
GRANT SELECT, INSERT ON public.core_divergence TO service_role;

-- ── the policy: the SAME membership chain every other table uses ───────────
-- ⚠️ DROP FIRST, OR THE SECOND RUN FAILS. PostgreSQL has no
-- `CREATE POLICY IF NOT EXISTS`, so a migration whose policy statement is not
-- preceded by a drop runs once and errors on every re-run with
-- «policy … already exists». Found by running this file twice against a real
-- database (backend/src/__tests__/core-divergence.pg.test.ts).
DROP POLICY IF EXISTS core_divergence_workspace_isolation ON public.core_divergence;
DROP POLICY IF EXISTS core_divergence_workspace_members ON public.core_divergence;
CREATE POLICY core_divergence_workspace_members ON public.core_divergence
  FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = (SELECT auth.uid())
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = (SELECT auth.uid())
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  );

-- ── diagnostic indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS core_divergence_workspace_idx
  ON public.core_divergence (workspace_id);
CREATE INDEX IF NOT EXISTS core_divergence_capability_idx
  ON public.core_divergence (capability, detected_at DESC);

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
-- ============================================================================
-- Nothing outside shadow mode reads this table, so dropping it loses only
-- diagnostic history.
--
-- BEGIN;
--   DROP POLICY IF EXISTS core_divergence_workspace_members ON public.core_divergence;
--   DROP TABLE IF EXISTS public.core_divergence CASCADE;
-- COMMIT;
--
-- Mitigation if the policy is wrong and support cannot read the report: read it
-- with the service role (which is not subject to RLS), and fix the policy — do
-- not disable RLS on a table whose rows are per-tenant evidence.
