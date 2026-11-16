-- ============================================================================
-- docs/VERIFY-repair-quality-01.sql — read-only. Every row should say ok = true.
-- ============================================================================
SELECT check_name, ok
FROM (VALUES
  (1, 'guard function exists',
      to_regprocedure('public.repair_tickets_quality_guard()') IS NOT NULL),
  (2, 'guard trigger on repair_tickets',
      EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'repair_tickets_quality_guard_trg'
                 AND tgrelid = 'public.repair_tickets'::regclass
                 AND NOT tgisinternal)),
  (3, 'guard function is not callable by service_role',
      NOT has_function_privilege('service_role', 'public.repair_tickets_quality_guard()', 'EXECUTE')),
  (4, 'quality_events accepts repair pass/fail',
      EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'public.quality_events'::regclass
                 AND contype = 'c'
                 AND pg_get_constraintdef(oid) LIKE '%repair%'))
) AS t(n, check_name, ok)
ORDER BY n;
