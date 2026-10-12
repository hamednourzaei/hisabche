-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/attendance-02-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- Every row should say ok = true.
-- ═══════════════════════════════════════════════════════════════════════════

WITH entry (name, args) AS (
  VALUES
    ('attendance_device_ingest', 'p_device uuid, p_time_zone text, p_events jsonb, p_cursor text'),
    ('attendance_device_reprocess', 'p_workspace uuid, p_device uuid, p_user_id text, p_actor uuid'),
    ('attendance_device_accept_held', 'p_workspace uuid, p_employee uuid, p_day date, p_actor uuid'),
    ('attendance_link_create',
     'p_workspace uuid, p_employee uuid, p_user uuid, p_token text, p_expires_at timestamp with time zone, p_days_back integer, p_auto_apply boolean, p_require_unlock boolean'),
    ('attendance_submit',
     'p_link uuid, p_date date, p_status text, p_check_in time without time zone, p_check_out time without time zone, p_ends_next_day boolean, p_note text, p_client_request_id uuid, p_time_zone text, p_proof text'),
    ('attendance_submission_decide', 'p_workspace uuid, p_id uuid, p_user uuid, p_decision text, p_note text')
),
inner_fns (name) AS (
  VALUES
    ('attendance_device_settle'),
    ('attendance_device_work_day'),
    ('attendance_terminal_events_guard'),
    ('attendance_submissions_guard')
),
cols (tbl, col) AS (
  VALUES
    ('attendance', 'ends_next_day'),
    ('attendance_submissions', 'ends_next_day'),
    ('attendance_submissions', 'proof'),
    ('attendance_terminal_events', 'work_day'),
    ('attendance_links', 'require_unlock')
),
checks (name, ok, detail) AS (
  SELECT 'column ' || c.tbl || '.' || c.col,
         EXISTS (SELECT 1 FROM information_schema.columns i
                  WHERE i.table_schema = 'public' AND i.table_name = c.tbl
                    AND i.column_name = c.col AND i.is_nullable = CASE WHEN c.col = 'proof' THEN 'YES' ELSE 'NO' END),
         'exists; NOT NULL except proof'
    FROM cols c
  UNION ALL
  SELECT 'function ' || e.name || ' has exactly the new signature',
         (SELECT COUNT(*) FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname = e.name) = 1
           AND EXISTS (SELECT 1 FROM pg_proc p
                        WHERE p.pronamespace = 'public'::regnamespace AND p.proname = e.name
                          AND pg_get_function_arguments(p.oid) = e.args),
         'one overload, the expected arguments'
    FROM entry e
  UNION ALL
  SELECT 'function ' || e.name || ' runs for service_role only',
         COALESCE((SELECT bool_and(
                     has_function_privilege('service_role', p.oid, 'EXECUTE')
                     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'))
                     FROM pg_proc p
                    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = e.name), false),
         'not callable from the browser'
    FROM entry e
  UNION ALL
  SELECT 'inner function ' || f.name || ' is nobody''s entry point',
         COALESCE((SELECT bool_and(
                     NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
                     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'))
                     FROM pg_proc p
                    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f.name), false),
         'service_role included'
    FROM inner_fns f
  UNION ALL
  SELECT 'attendance: a night must say so and be earlier',
         EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'attendance_ends_next_day_check'
                    AND conrelid = 'public.attendance'::regclass AND convalidated),
         'ends_next_day needs check_out < check_in'
  UNION ALL
  SELECT 'attendance_submissions_times knows about nights',
         COALESCE((SELECT pg_get_constraintdef(k.oid) ILIKE '%ends_next_day%'
                     FROM pg_constraint k
                    WHERE k.conname = 'attendance_submissions_times'
                      AND k.conrelid = 'public.attendance_submissions'::regclass), false),
         'an exit before the arrival only with the mark'
  UNION ALL
  SELECT 'attendance_submissions.proof is a closed list',
         EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'attendance_submissions_proof_check'
                    AND conrelid = 'public.attendance_submissions'::regclass),
         'NULL or device_unlock'
  UNION ALL
  SELECT 'work_shifts may cross midnight (or the table is not installed)',
         to_regclass('public.work_shifts') IS NULL
           OR (EXISTS (SELECT 1 FROM pg_constraint
                        WHERE conname = 'work_shifts_times_differ'
                          AND conrelid = to_regclass('public.work_shifts'))
               AND NOT EXISTS (SELECT 1 FROM pg_constraint
                                WHERE conname = 'work_shifts_ends_after_start'
                                  AND conrelid = to_regclass('public.work_shifts'))),
         'ends_at <> starts_at'
  UNION ALL
  SELECT 'every device reading has its working day',
         NOT EXISTS (SELECT 1 FROM public.attendance_terminal_events WHERE work_day IS NULL),
         'backfilled from occurred_on'
  UNION ALL
  SELECT 'the device-event guard is switched on',
         EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'attendance_terminal_events_guard_trg'
                    AND tgrelid = 'public.attendance_terminal_events'::regclass
                    AND tgenabled = 'O'),
         'it was disabled only for the backfill'
  UNION ALL
  SELECT 'table attendance_phone_keys exists with RLS on',
         COALESCE((SELECT c.relrowsecurity FROM pg_class c
                    WHERE c.oid = to_regclass('public.attendance_phone_keys')), false),
         'row level security'
  UNION ALL
  SELECT 'attendance_phone_keys is closed to the browser and cannot be deleted from',
         to_regclass('public.attendance_phone_keys') IS NOT NULL
           AND NOT has_table_privilege('anon', 'public.attendance_phone_keys', 'SELECT')
           AND NOT has_table_privilege('authenticated', 'public.attendance_phone_keys', 'SELECT')
           AND NOT has_table_privilege('service_role', 'public.attendance_phone_keys', 'DELETE')
           AND has_table_privilege('service_role', 'public.attendance_phone_keys', 'INSERT'),
         'service_role: SELECT, INSERT, UPDATE'
  UNION ALL
  SELECT 'one live phone per employee',
         EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND indexname = 'attendance_phone_keys_one_live'
                    AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%revoked_at IS NULL%'),
         'unique where not revoked'
  UNION ALL
  SELECT 'attendance_phone_keys holds a public key and nothing of a body',
         NOT EXISTS (SELECT 1 FROM information_schema.columns i
                      WHERE i.table_schema = 'public' AND i.table_name = 'attendance_phone_keys'
                        AND i.column_name ~* '(template|image|photo|face|finger|biometric)'),
         'no biometric column'
)
SELECT name, ok, detail FROM checks ORDER BY ok, name;
