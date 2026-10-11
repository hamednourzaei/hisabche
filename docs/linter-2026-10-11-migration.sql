-- ============================================================================
-- linter-2026-10-11-migration.sql — Supabase linter, reported 11 Oct 2026
--
--   0011  Function Search Path Mutable      (8 trigger functions)
--   0025  Public Bucket Allows Listing      (bucket cms-media)
--
-- NOT IN THIS FILE — «Leaked Password Protection Disabled» is not SQL. It is a
-- switch in the dashboard: Authentication → Sign In / Providers → Password →
-- «Prevent use of leaked passwords». A person turns it on.
--
-- 1. search_path
-- WHY: a function without a fixed search_path resolves unqualified names
-- through the CALLER's search_path; a role able to create objects in a schema
-- earlier on that path could shadow a table or a function it uses.
-- SAFE: ALTER FUNCTION … SET changes only the function's configuration. The
-- body, the triggers that call it and every caller are untouched. All eight
-- take no arguments (they are trigger functions) and each ALTER is guarded, so
-- a database that has not had one of the feature migrations is not an error.
--
-- 2. cms-media listing
-- WHY: the bucket is PUBLIC, so every object is already readable by its URL
-- without any policy. The SELECT policy on storage.objects adds only one
-- thing: any client may LIST every file in the bucket.
-- SAFE: nothing in the product lists this bucket from a client (no
-- storage.from('cms-media').list call exists in the repository); the server
-- uses the service role, which does not go through policies. Public URLs keep
-- working exactly as before.
--
-- Additive in effect, idempotent, re-runnable.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-linter-2026-10-11.sql)
-- ============================================================================

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.blog_article_versions_immutable()',
    'public.ai_action_requests_move_forward_only()',
    'public.data_snapshots_are_append_only()',
    'public.entity_notes_are_append_only()',
    'public.campaigns_keep_history()',
    'public.ai_pipeline_runs_move_forward_only()',
    'public.ai_pipeline_steps_append_only()',
    'public.cms_page_versions_immutable()'
  ]
  LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS cms_media_bucket_public_read ON storage.objects;
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK / MITIGATION (only if something that LISTS the bucket turns up)
--
--   CREATE POLICY cms_media_bucket_public_read
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'cms-media');
--
--   ALTER FUNCTION public.<name>() RESET search_path;   -- per function
-- ============================================================================
