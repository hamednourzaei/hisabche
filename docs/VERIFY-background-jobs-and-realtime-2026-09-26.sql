-- ============================================================================
-- VERIFY — background-jobs-claim + realtime-data-tables (both already run).
-- Read-only. Expected: 19 rows, every one ok = true.
-- A realtime row is ok when the table does not apply here (missing, or no
-- workspace_id) OR it is both published and under RLS; `detail` says which.
-- ============================================================================

-- ─── background-jobs-claim-migration.sql ────────────────────────────────────
SELECT 'jobs: claim columns' AS check,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'background_jobs'
           AND column_name IN ('claimed_by', 'claim_expires_at')) = 2 AS ok,
       '' AS detail
UNION ALL
SELECT 'jobs: 5 functions',
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname IN
           ('claim_background_jobs', 'complete_background_job', 'fail_background_job',
            'claim_scheduled_run', 'finish_scheduled_run')) = 5,
       ''
UNION ALL
SELECT 'jobs: claim uses SKIP LOCKED',
       COALESCE(pg_get_functiondef(to_regprocedure('public.claim_background_jobs(text, integer, integer)'))
                ILIKE '%FOR UPDATE SKIP LOCKED%', false),
       ''
UNION ALL
SELECT 'jobs: clients cannot claim',
       to_regprocedure('public.claim_background_jobs(text, integer, integer)') IS NOT NULL
       AND NOT has_function_privilege('anon', 'public.claim_background_jobs(text, integer, integer)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.claim_background_jobs(text, integer, integer)', 'EXECUTE'),
       ''
UNION ALL
SELECT 'jobs: scheduled_task_runs rls',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.scheduled_task_runs')), false),
       ''

-- ─── realtime-data-tables-migration.sql ─────────────────────────────────────
UNION ALL
SELECT * FROM (
  SELECT 'realtime: ' || t.tablename,
         NOT (x.table_exists AND x.has_workspace_id) OR (x.published AND x.rls_enabled),
         CASE WHEN NOT x.table_exists THEN 'table not in this database'
              WHEN NOT x.has_workspace_id THEN 'no workspace_id — not published on purpose'
              ELSE 'published=' || x.published || ' rls=' || x.rls_enabled END
  FROM (VALUES ('invoices'), ('transactions'), ('customers'), ('products'),
               ('accounts'), ('journal_entries'), ('journal_lines'),
               ('interactions'), ('opportunities'),
               ('purchase_orders'), ('boms'), ('work_orders'),
               ('projects'), ('project_tasks')) AS t(tablename)
  CROSS JOIN LATERAL (
    SELECT to_regclass('public.' || t.tablename) IS NOT NULL AS table_exists,
           EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = t.tablename
                     AND c.column_name = 'workspace_id') AS has_workspace_id,
           EXISTS (SELECT 1 FROM pg_publication_tables p
                   WHERE p.pubname = 'supabase_realtime' AND p.schemaname = 'public'
                     AND p.tablename = t.tablename) AS published,
           COALESCE((SELECT relrowsecurity FROM pg_class
                     WHERE oid = to_regclass('public.' || t.tablename)), false) AS rls_enabled
  ) x
  ORDER BY t.tablename
) realtime;
