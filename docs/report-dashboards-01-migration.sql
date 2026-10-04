-- ============================================================================
-- REPORT DASHBOARDS — 01 (capability #146). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    Needs docs/saved-reports-01-migration.sql (already run). After running,
--    run docs/VERIFY-report-dashboards-01.sql.
--
-- A dashboard is an ARRANGEMENT of saved reports: which ones, in what order,
-- how wide. It defines no figure and stores no result — every tile is a saved
-- report, run against live data when the dashboard is opened.
--
-- A dashboard is retired (is_active = false), never deleted or edited: a
-- changed arrangement is a new dashboard.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_dashboards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- [{ "reportId": uuid, "position": int, "span": 1 | 2 | 3 }]
  tiles        jsonb NOT NULL
               CHECK (jsonb_typeof(tiles) = 'array' AND jsonb_array_length(tiles) BETWEEN 1 AND 6),
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.report_dashboards IS
  'A named arrangement of saved reports. No figure is defined and no result is stored here.';

-- One ACTIVE dashboard per name.
CREATE UNIQUE INDEX IF NOT EXISTS report_dashboards_active_name
  ON public.report_dashboards (workspace_id, lower(btrim(name)))
  WHERE is_active;

ALTER TABLE public.report_dashboards ENABLE ROW LEVEL SECURITY;

-- On Supabase a new table arrives with ALL privileges already granted to the
-- three API roles; every one is revoked before the backend is granted back.
REVOKE ALL ON public.report_dashboards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.report_dashboards TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the arrangements. The saved reports they pointed at are untouched.
--
--   DROP TABLE IF EXISTS public.report_dashboards;
