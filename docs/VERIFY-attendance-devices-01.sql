-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/attendance-devices-01-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- Every row should say ok = true.
-- ═══════════════════════════════════════════════════════════════════════════

WITH fns (name) AS (
  VALUES
    ('attendance_device_ingest'),
    ('attendance_device_reprocess'),
    ('attendance_device_settle'),
    ('attendance_terminal_events_guard')
),
tables (name) AS (
  VALUES ('attendance_terminals'), ('attendance_terminal_identities'), ('attendance_terminal_events')
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
  SELECT 'service_role cannot write attendance_terminal_events directly',
         NOT has_table_privilege('service_role', 'public.attendance_terminal_events', 'INSERT')
           AND NOT has_table_privilege('service_role', 'public.attendance_terminal_events', 'UPDATE')
           AND NOT has_table_privilege('service_role', 'public.attendance_terminal_events', 'DELETE'),
         'written only by the functions'
  UNION ALL
  SELECT 'attendance.source allows device',
         COALESCE((SELECT pg_get_constraintdef(k.oid) ILIKE '%device%'
                     FROM pg_constraint k
                    WHERE k.conname = 'attendance_source_check'
                      AND k.conrelid = 'public.attendance'::regclass), false),
         'NULL, employee_link or device'
  UNION ALL
  SELECT 'constraint attendance_terminal_events_once',
         EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'attendance_terminal_events_once'
                    AND conrelid = 'public.attendance_terminal_events'::regclass),
         'the same event delivered twice is one event'
  UNION ALL
  SELECT 'index attendance_terminal_identities_one is unique',
         EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND indexname = 'attendance_terminal_identities_one'
                    AND indexdef ILIKE '%UNIQUE%'),
         'one person per number, per device or business-wide'
  UNION ALL
  SELECT 'attendance_terminals stores a hash, not a key',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'attendance_terminals'
                    AND column_name = 'key_hash')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'attendance_terminals'
                              AND column_name IN ('key', 'ingest_key', 'secret', 'token')),
         'sha-256, hex'
  UNION ALL
  SELECT 'trigger attendance_terminal_events_guard_trg',
         EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'attendance_terminal_events_guard_trg'
                    AND tgrelid = 'public.attendance_terminal_events'::regclass
                    AND tgenabled <> 'D'),
         'append-only'
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
)
SELECT name, ok, detail
FROM checks
ORDER BY ok, name;
