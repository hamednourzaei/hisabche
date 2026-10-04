-- ============================================================================
-- VERIFY — docs/benchmark-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
--
-- ⚠️ This script deliberately does NOT call the function: its rows are figures
-- about every business, and they do not belong in a pasted result.
-- ============================================================================

SELECT 'function benchmark_sale_counts(integer) exists' AS check,
       to_regprocedure('public.benchmark_sale_counts(integer)') IS NOT NULL AS ok

UNION ALL
SELECT 'a browser role cannot execute it (' || r.name || ')',
       NOT has_function_privilege(r.name, 'public.benchmark_sale_counts(integer)', 'EXECUTE')
FROM (VALUES ('anon'), ('authenticated')) AS r(name)

UNION ALL
SELECT 'the backend role can execute it',
       has_function_privilege('service_role', 'public.benchmark_sale_counts(integer)', 'EXECUTE')

UNION ALL
SELECT 'it does not run with its owner''s rights (not SECURITY DEFINER)', NOT COALESCE((
  SELECT p.prosecdef FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.benchmark_sale_counts(integer)')
), true);
