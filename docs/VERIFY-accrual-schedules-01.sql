-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.4 accrual_schedules, accrual_schedule_periods, and journal_entries.reverse_on

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('accrual_schedules', 'accrual_schedule_periods')
ORDER BY c.relname;

-- V61 audit (12 Nov 2026): clients are locked out — RLS on, no policy, and
-- neither anon nor authenticated holds any privilege. Expect ok = true.
SELECT 'clients_locked' AS check_name,
       bool_and(c.relrowsecurity)
       AND NOT bool_or(
             has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
       AND NOT EXISTS (
             SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['accrual_schedules', 'accrual_schedule_periods']))
       AND count(*) = 2 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('accrual_schedules', 'accrual_schedule_periods');
