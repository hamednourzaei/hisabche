-- ============================================================================
-- CONTENT INTELLIGENCE — 03: quality reports.
-- Additive, idempotent (safe to run twice).
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN, NOT VERIFIED.
--
-- The quality gate (Phase 5) checks a generated draft against the brief BEFORE
-- a human ever sees `draft_ready`: structure, sourcing, forbidden copying from
-- competitor sources, language correctness. One row per gate run, per version —
-- the report is a record of a decision, so it is not overwritten: a second gate
-- run on the same version is a second row.
--
-- ⚠️ `passed` is a COLUMN, NOT A STATUS. The gate failing does not delete the
-- draft; it stops the pipeline advancing and tells the editor why. A draft that
-- never passed the gate is still readable in admin — hiding it would hide the
-- reason too.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_quality_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   uuid NOT NULL REFERENCES public.blog_article_versions (id) ON DELETE CASCADE,
  brief_id     uuid REFERENCES public.blog_content_briefs (id) ON DELETE SET NULL,
  -- The gate's verdict. Both are stored, failures most of all.
  passed       boolean NOT NULL,
  -- Every check, each with its own verdict and reason — so "failed" says
  -- WHICH check and WHY, not just that something was wrong.
  checks       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Free-form diagnostics (word counts, similarity samples). Never the model's
  -- raw output; that can echo unpublished text into a place with a wider
  -- audience than the draft itself.
  diagnostics  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blog_quality_reports IS
  'One row per quality-gate run. Failures are records, not deletions. Internal.';

CREATE INDEX IF NOT EXISTS blog_quality_reports_version
  ON public.blog_quality_reports (version_id, created_at DESC);

ALTER TABLE public.blog_quality_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_quality_reports FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
--   DROP TABLE public.blog_quality_reports;   -- destroys gate history
-- Nothing public depends on this table.
