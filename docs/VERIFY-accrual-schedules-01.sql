-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.4 accrual_schedules, accrual_schedule_periods, and journal_entries.reverse_on

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('accrual_schedules', 'accrual_schedule_periods')
ORDER BY c.relname;
