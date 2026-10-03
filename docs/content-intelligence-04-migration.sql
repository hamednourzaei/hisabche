-- ============================================================================
-- CONTENT INTELLIGENCE — 04: suggested internal links.
-- Additive, idempotent (safe to run twice).
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN, NOT VERIFIED.
--
-- Phase 6 suggests internal links FROM published posts TO a new draft's topic
-- (and flags orphan posts nobody links to). A suggestion is a ROW, never an
-- edit to an article: the pipeline must not rewrite published HTML behind an
-- editor's back. The editor applies, edits or dismisses each one, and `status`
-- records which.
--
-- ⚠️ `target` IS A PATH, RESOLVED BY THE BACKEND FROM blog_posts — never a URL
-- the model produced. The model may name a slug it saw in the provided list;
-- the link is only created when that slug resolves to a real published post.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_internal_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The draft this link was suggested for.
  version_id         uuid NOT NULL REFERENCES public.blog_article_versions (id) ON DELETE CASCADE,
  -- The published post the link should point at. NOT NULL: a suggestion whose
  -- target does not exist is not a suggestion, it is a hallucination, and it is
  -- rejected before this row is written.
  target_post_id     uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  anchor             text NOT NULL CHECK (char_length(btrim(anchor)) > 0),
  -- Why this target, in one sentence — the editor reads this, not a score.
  reason             text,
  -- 0..1. Null = not judged (the same rule as blog_sources.authority_score).
  confidence         numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status             text NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'accepted', 'rejected')),
  decided_by         uuid,
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_internal_links_unique UNIQUE (version_id, target_post_id)
);

COMMENT ON TABLE public.blog_internal_links IS
  'Internal-link suggestions for a generated draft. A suggestion is a row, never an edit. Internal.';

CREATE INDEX IF NOT EXISTS blog_internal_links_open
  ON public.blog_internal_links (version_id)
  WHERE status = 'suggested';

ALTER TABLE public.blog_internal_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_internal_links FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
--   DROP TABLE public.blog_internal_links;   -- destroys suggestions + decisions
-- Nothing public depends on this table.
