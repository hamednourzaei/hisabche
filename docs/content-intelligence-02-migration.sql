-- ============================================================================
-- CONTENT INTELLIGENCE — 02: article versions (immutable generated drafts).
-- Additive, idempotent (safe to run twice).
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN, NOT VERIFIED.
--
-- WHAT THIS ADDS
--
--   blog_article_versions   every generated draft, forever. Immutable: a
--                           trigger refuses UPDATE and DELETE, because the
--                           point of a version table you can rewrite is zero.
--
-- WHY A DRAFT IS NOT A blog_posts ROW
--
--   The pipeline writes NO blog_posts row until a human opens the draft in the
--   editor and presses save — the existing POST /api/admin/blog/posts path,
--   with all of its validation. `article_id` stays NULL until someone attaches
--   a version to a real post; until then the version hangs off its brief.
--   A generated row in blog_posts would show up in the admin list as if a
--   person wrote it, and `author_id` would have to lie about who did.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_article_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL until a human saves the draft as a real post.
  article_id      uuid REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  -- NULL only if the brief was deleted; the version survives as a record.
  brief_id        uuid REFERENCES public.blog_content_briefs (id) ON DELETE SET NULL,
  version         integer NOT NULL CHECK (version >= 1),
  title           text NOT NULL CHECK (char_length(btrim(title)) > 0),
  slug            text,
  excerpt         text,
  -- The Tiptap document, exactly as the editor will load it.
  content_json    jsonb NOT NULL,
  -- Rendered from content_json server-side and passed through blog.sanitize.
  -- Never the model's raw output.
  content_html    text NOT NULL,
  meta_title      text,
  meta_description text,
  faq             jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- The admin who asked for this generation. Recorded, never a filter.
  generated_by    uuid,
  -- provider, model, prompt version, sourceIds used, the model's qualityNotes.
  -- Generation facts — so a version can be explained after the fact.
  generation_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- A version must belong to SOMETHING: a post, or the brief it came from.
  CONSTRAINT blog_article_versions_anchored CHECK (article_id IS NOT NULL OR brief_id IS NOT NULL)
);

COMMENT ON TABLE public.blog_article_versions IS
  'Immutable generated drafts. No blog_posts row exists until a human saves one. Internal.';

-- ⚠️ TWO PARTIAL UNIQUE INDEXES, because `version` numbers restart per anchor
-- and NULLs would otherwise make every unique check vacuous.
CREATE UNIQUE INDEX IF NOT EXISTS blog_article_versions_article_version
  ON public.blog_article_versions (article_id, version)
  WHERE article_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS blog_article_versions_brief_version
  ON public.blog_article_versions (brief_id, version)
  WHERE article_id IS NULL AND brief_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_article_versions_brief_created
  ON public.blog_article_versions (brief_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- IMMUTABILITY — enforced by the database, not by convention.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ A version table is an audit trail. Code that rewrites history to fix a
-- bug is the exact thing the table exists to catch — so the refusal lives
-- where no service-layer bug can bypass it.
CREATE OR REPLACE FUNCTION public.blog_article_versions_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'blog_article_versions is immutable: % on version % is refused',
    TG_OP, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS blog_article_versions_no_mutation ON public.blog_article_versions;
CREATE TRIGGER blog_article_versions_no_mutation
  BEFORE UPDATE OR DELETE ON public.blog_article_versions
  FOR EACH ROW EXECUTE FUNCTION public.blog_article_versions_immutable();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — ENABLED AND DELIBERATELY POLICY-FREE (same posture as
-- migration 01: the service role is the only reader; a policy here could only
-- leak unpublished drafts).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.blog_article_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_article_versions FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
--   DROP TABLE public.blog_article_versions;   -- destroys the draft history
--   DROP FUNCTION public.blog_article_versions_immutable();
-- Nothing public depends on this table.
