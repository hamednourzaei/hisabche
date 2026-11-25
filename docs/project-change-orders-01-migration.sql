-- ============================================
-- docs/project-change-orders-01-migration.sql
--
-- P0 / X16: Persistent Project Change Orders with workspace_id isolation,
-- idempotency, budget impact tracking, and manager approval workflow.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  original_budget_minor bigint NOT NULL CHECK (original_budget_minor >= 0),
  delta_minor bigint NOT NULL,
  revised_budget_minor bigint NOT NULL CHECK (revised_budget_minor >= 0),
  estimated_cost_delta_minor bigint NOT NULL DEFAULT 0,
  net_margin_delta_minor bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  idempotency_key text,
  created_by uuid NOT NULL,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_project_change_orders_ws_proj
  ON public.project_change_orders (workspace_id, project_id, created_at DESC);

ALTER TABLE public.project_change_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.project_change_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_change_orders TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_change_orders'
      AND policyname = 'pco_workspace_isolation'
  ) THEN
    CREATE POLICY pco_workspace_isolation ON public.project_change_orders
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
-- DROP TABLE IF EXISTS public.project_change_orders;
