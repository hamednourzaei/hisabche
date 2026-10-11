-- ============================================================================
-- VERIFY-linter-2026-10-11.sql — read-only. Run AFTER the migration.
--
-- One row. `ok` must be true:
--   functions_found      how many of the eight exist in this database
--   functions_pinned     how many of those have a fixed search_path (must equal found)
--   listing_policy_gone  the broad SELECT policy on the cms-media bucket is gone
--   bucket_still_public  the bucket itself is still public (URLs keep working);
--                        null when this database has no storage schema
-- ============================================================================
WITH wanted(name) AS (
  VALUES
    ('blog_article_versions_immutable'),
    ('ai_action_requests_move_forward_only'),
    ('data_snapshots_are_append_only'),
    ('entity_notes_are_append_only'),
    ('campaigns_keep_history'),
    ('ai_pipeline_runs_move_forward_only'),
    ('ai_pipeline_steps_append_only'),
    ('cms_page_versions_immutable')
),
found AS (
  SELECT p.proname,
         EXISTS (
           SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) AS setting
            WHERE setting LIKE 'search_path=%'
         ) AS pinned
    FROM pg_proc p
    JOIN wanted w ON w.name = p.proname
   WHERE p.pronamespace = 'public'::regnamespace
),
facts AS (
  SELECT
    (SELECT count(*) FROM found)::int AS functions_found,
    (SELECT count(*) FROM found WHERE pinned)::int AS functions_pinned,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname = 'cms_media_bucket_public_read'
    ) AS listing_policy_gone,
    CASE
      WHEN to_regclass('storage.buckets') IS NULL THEN NULL
      ELSE (xpath('/table/row/public/text()',
                  query_to_xml('SELECT public FROM storage.buckets WHERE id = ''cms-media''',
                               false, false, '')))[1]::text = 'true'
    END AS bucket_still_public
)
SELECT facts.*,
       (functions_found = functions_pinned AND listing_policy_gone
        AND coalesce(bucket_still_public, true)) AS ok
  FROM facts;
