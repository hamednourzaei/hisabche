-- ============================================================================
-- function-search-path-migration.sql — Supabase linter 0011
-- «Function Search Path Mutable» (reported 27 Sep 2026)
--
-- WHY: a function without a fixed search_path resolves unqualified names
-- through the CALLER's search_path. A role that can create objects in a schema
-- earlier on that path could shadow `now()` or a table the function reads.
-- Pinning it to `public, pg_temp` (pg_temp LAST) closes that.
--
-- SAFE: ALTER FUNCTION … SET only changes the function's configuration; the
-- body and every caller are untouched. Re-runnable. Each ALTER is guarded so a
-- database without the blog migration is not an error.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

DO $$
BEGIN
  IF to_regprocedure('public.blog_post_is_public(text, timestamptz)') IS NOT NULL THEN
    ALTER FUNCTION public.blog_post_is_public(text, timestamptz) SET search_path = public, pg_temp;
  END IF;
  IF to_regprocedure('public.blog_touch_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.blog_touch_updated_at() SET search_path = public, pg_temp;
  END IF;
END $$;

-- ============================================================================
-- VERIFY (read-only) — expect both rows with proconfig containing
-- search_path=public, pg_temp; and the second query to return ZERO rows
-- (no other public function without a fixed search_path).
-- ============================================================================
-- SELECT proname, proconfig
--   FROM pg_proc
--  WHERE pronamespace = 'public'::regnamespace
--    AND proname IN ('blog_post_is_public', 'blog_touch_updated_at');
--
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p
--  WHERE p.pronamespace = 'public'::regnamespace
--    AND p.prokind = 'f'
--    AND NOT EXISTS (
--      SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%'
--    )
--  ORDER BY 1;
--
-- ROLLBACK / MITIGATION
--   ALTER FUNCTION public.blog_post_is_public(text, timestamptz) RESET search_path;
--   ALTER FUNCTION public.blog_touch_updated_at() RESET search_path;
-- ============================================================================
