-- ============================================================================
-- docs/VERIFY-capacity-intelligence-01.sql
-- Post-migration verification query — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  to_regclass('public.capacity_benchmark_runs') AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.capacity_benchmark_runs')) AS rls_enabled,
  (SELECT count(*) FROM pg_indexes WHERE tablename = 'capacity_benchmark_runs') AS index_count;
