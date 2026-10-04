-- ============================================================================
-- VERIFY — docs/attendance-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
--
-- If «no employee has two records for one day» is false, the migration did not
-- create the index (it deletes nothing). List the pairs with:
--
--   SELECT workspace_id, employee_id, date, COUNT(*)
--     FROM attendance WHERE workspace_id IS NOT NULL
--    GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;
-- ============================================================================

SELECT 'table attendance exists' AS check, to_regclass('public.attendance') IS NOT NULL AS ok

UNION ALL
SELECT 'attendance has workspace_id', EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'workspace_id'
)

UNION ALL
SELECT 'no employee has two records for one day', NOT EXISTS (
  SELECT 1 FROM public.attendance
   WHERE workspace_id IS NOT NULL
   GROUP BY workspace_id, employee_id, date
  HAVING COUNT(*) > 1
)

UNION ALL
SELECT 'one record per employee per day (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'attendance_one_per_employee_day'
);
