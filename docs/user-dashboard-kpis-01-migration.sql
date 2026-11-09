-- ============================================================================
-- docs/user-dashboard-kpis-01-migration.sql
--
-- The KPIs a PERSON added to their dashboard, per workspace (owner request,
-- 9 Nov 2026: «up to 4 more cards, chosen from the figures other pages already
-- show»). Kept in the database, not on the device: the backend is only a step.
--
-- One row per (person, workspace): the ordered list of up to 4 KPI ids. The
-- ids are checked by the server against packages/validation/src/schemas/
-- dashboard-kpis.ts; the table checks only shape and size.
--
-- Read and written only by the backend for `request.userId` inside the
-- caller's own workspace (requireWorkspaceContext). Nothing for anon /
-- authenticated.
--
-- RUN ORDER: any time.
-- ADDITIVE, IDEMPOTENT, SAFE TO RE-RUN.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-user-dashboard-kpis-01.sql.
--    Status: PENDING HUMAN CONFIRMATION
--
-- ROLLBACK: DROP TABLE IF EXISTS public.user_dashboard_kpis;
--   (the dashboard then shows only its fixed cards).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_dashboard_kpis (
  user_id      uuid        NOT NULL,
  workspace_id uuid        NOT NULL,
  kpis         text[]      NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);

ALTER TABLE public.user_dashboard_kpis DROP CONSTRAINT IF EXISTS user_dashboard_kpis_shape;
ALTER TABLE public.user_dashboard_kpis ADD CONSTRAINT user_dashboard_kpis_shape
  CHECK (
    cardinality(kpis) <= 4
    AND array_position(kpis, NULL) IS NULL
  );

CREATE INDEX IF NOT EXISTS user_dashboard_kpis_workspace_idx
  ON public.user_dashboard_kpis (workspace_id);

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_dashboard_kpis_user_fk') THEN
    ALTER TABLE public.user_dashboard_kpis
      ADD CONSTRAINT user_dashboard_kpis_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF to_regclass('public.workspaces') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_dashboard_kpis_workspace_fk') THEN
    ALTER TABLE public.user_dashboard_kpis
      ADD CONSTRAINT user_dashboard_kpis_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Only the backend touches it. A new Supabase table is born with ALL for
-- anon / authenticated / service_role, so revoke first.
ALTER TABLE public.user_dashboard_kpis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_dashboard_kpis FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_dashboard_kpis TO service_role;
