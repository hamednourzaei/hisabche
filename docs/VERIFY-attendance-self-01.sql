-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/attendance-self-01-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- Every row should say ok = true.
-- ═══════════════════════════════════════════════════════════════════════════

WITH fns (name) AS (
  VALUES
    ('attendance_link_create'),
    ('attendance_submit'),
    ('attendance_submission_decide'),
    ('attendance_submissions_guard')
),
tables (name) AS (
  VALUES ('attendance_links'), ('attendance_submissions')
),
checks (name, ok, detail) AS (
  SELECT 'table ' || t.name || ' exists with RLS on',
         COALESCE((SELECT c.relrowsecurity FROM pg_class c
                    WHERE c.oid = to_regclass('public.' || t.name)), false),
         'row level security'
    FROM tables t
  UNION ALL
  SELECT 'table ' || t.name || ' is closed to anon and authenticated',
         to_regclass('public.' || t.name) IS NOT NULL
           AND NOT has_table_privilege('anon', 'public.' || t.name, 'SELECT')
           AND NOT has_table_privilege('authenticated', 'public.' || t.name, 'SELECT')
           AND NOT has_table_privilege('anon', 'public.' || t.name, 'INSERT')
           AND NOT has_table_privilege('authenticated', 'public.' || t.name, 'INSERT'),
         'no direct access from the browser'
    FROM tables t
  UNION ALL
  SELECT 'service_role cannot write attendance_submissions directly',
         NOT has_table_privilege('service_role', 'public.attendance_submissions', 'INSERT')
           AND NOT has_table_privilege('service_role', 'public.attendance_submissions', 'UPDATE')
           AND NOT has_table_privilege('service_role', 'public.attendance_submissions', 'DELETE'),
         'written only by the functions'
  UNION ALL
  SELECT 'attendance.source exists',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'attendance'
                    AND column_name = 'source'),
         'NULL = recorded on the sheet'
  UNION ALL
  SELECT t.tbl || '.time_zone exists',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = t.tbl
                    AND column_name = 'time_zone'),
         t.note
    FROM (VALUES
      ('workspaces', 'NULL until the owner chooses one'),
      ('branches', 'NULL = the zone of the business'),
      ('attendance_submissions', 'the zone the day was judged in')
    ) AS t (tbl, note)
  UNION ALL
  SELECT 'attendance_links has no zone of its own',
         NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'attendance_links'
                        AND column_name = 'time_zone'),
         'the zone belongs to the workplace'
  UNION ALL
  SELECT 'the draft functions that took a device zone are gone',
         (SELECT COUNT(*) FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('attendance_link_create', 'attendance_submit')) = 2,
         'exactly one of each'
  UNION ALL
  SELECT 'check attendance_source_check',
         EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'attendance_source_check'
                    AND conrelid = 'public.attendance'::regclass AND convalidated),
         'source is NULL or employee_link'
  UNION ALL
  SELECT 'index attendance_links_one_live is unique and partial',
         EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND indexname = 'attendance_links_one_live'
                    AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%revoked_at IS NULL%'),
         'one live link per employee'
  UNION ALL
  SELECT 'constraint attendance_submissions_once',
         EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'attendance_submissions_once'
                    AND conrelid = 'public.attendance_submissions'::regclass),
         'the same form twice is one row'
  UNION ALL
  SELECT 'trigger attendance_submissions_guard_trg',
         EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'attendance_submissions_guard_trg'
                    AND tgrelid = 'public.attendance_submissions'::regclass
                    AND tgenabled <> 'D'),
         'append-only, forward-only'
  UNION ALL
  SELECT 'function ' || f.name || ' exists',
         EXISTS (SELECT 1 FROM pg_proc p
                  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f.name),
         ''
    FROM fns f
  UNION ALL
  SELECT 'function ' || p.proname || ' is not callable by anon/authenticated',
         NOT has_function_privilege('anon', p.oid, 'EXECUTE')
           AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'),
         'search_path: ' || COALESCE(array_to_string(p.proconfig, ', '), '(not set)')
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN (SELECT name FROM fns)
  UNION ALL
  SELECT 'function ' || p.proname || ' pins its search_path',
         COALESCE(array_to_string(p.proconfig, ', '), '') ILIKE '%search_path=public, pg_temp%',
         COALESCE(array_to_string(p.proconfig, ', '), '(not set)')
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN (SELECT name FROM fns)
  UNION ALL
  SELECT 'index attendance_one_per_employee_day (from attendance-01)',
         EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND indexname = 'attendance_one_per_employee_day'),
         'not required by this migration; false means attendance-01 found duplicates'
)
SELECT name, ok, detail
FROM checks
ORDER BY ok, name;
