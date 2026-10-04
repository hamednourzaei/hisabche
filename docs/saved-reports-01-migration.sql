-- ============================================================================
-- SAVED REPORTS — 01 (capability #145). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-saved-reports-01.sql.
--
-- A saved report is a QUESTION kept under a name: which figures, grouped by
-- what. It holds no rows and no results — every run reads the live data, so a
-- report can never show yesterday's numbers as today's.
--
-- The definition is validated by the backend before it is stored (known
-- dataset, known measures, a grouping the measures allow). A report is retired
-- with is_active = false, never deleted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- { dataset, groupBy: string[], measures: string[], maxRows }
  definition   jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_reports IS
  'A named report definition (figures and grouping). No results are stored; every run reads live data.';

-- One ACTIVE report per name: two «فروش ماهانه» in a list cannot be told apart.
CREATE UNIQUE INDEX IF NOT EXISTS saved_reports_active_name
  ON public.saved_reports (workspace_id, lower(btrim(name)))
  WHERE is_active;

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.saved_reports TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the saved definitions. No business data depends on them.
--
--   DROP TABLE IF EXISTS public.saved_reports;
