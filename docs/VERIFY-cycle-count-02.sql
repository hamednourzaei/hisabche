-- ============================================================================
-- docs/VERIFY-cycle-count-02.sql
-- READ-ONLY. One row per check: check_name | expected | actual | pass.
-- Run after docs/cycle-count-02-migration.sql. «Success. No rows returned» is NOT a pass.
-- ============================================================================

WITH i AS (
  SELECT indexdef
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename = 'stock_movements'
     AND indexname = 'stock_movements_cycle_count_once_idx'
)
SELECT 'index exists once' AS check_name, '1' AS expected, count(*)::text AS actual, count(*) = 1 AS pass FROM i
UNION ALL
SELECT 'index is UNIQUE', 'true',
       COALESCE((SELECT (indexdef LIKE 'CREATE UNIQUE INDEX%')::text FROM i), 'missing'),
       COALESCE((SELECT indexdef LIKE 'CREATE UNIQUE INDEX%' FROM i), false)
UNION ALL
SELECT 'index is partial on cycle_count only', 'true',
       COALESCE((SELECT (indexdef LIKE '%reference_type = ''cycle_count''%')::text FROM i), 'missing'),
       COALESCE((SELECT indexdef LIKE '%reference_type = ''cycle_count''%' FROM i), false)
UNION ALL
SELECT 'no (count, product) has two adjustments', '0',
       (SELECT count(*)::text FROM (
          SELECT 1 FROM stock_movements
           WHERE reference_type = 'cycle_count'
           GROUP BY workspace_id, reference_id, product_id
          HAVING count(*) > 1) d),
       (SELECT count(*) = 0 FROM (
          SELECT 1 FROM stock_movements
           WHERE reference_type = 'cycle_count'
           GROUP BY workspace_id, reference_id, product_id
          HAVING count(*) > 1) d)
UNION ALL
SELECT 'cycle_count_complete exists once', '1',
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete'),
       (SELECT count(*) = 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete')
UNION ALL
SELECT 'cycle_count_complete is SECURITY DEFINER', 'true',
       COALESCE((SELECT p.prosecdef::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), 'missing'),
       COALESCE((SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), false)
UNION ALL
SELECT 'cycle_count_complete version marker', 'cycle-count-02:rev1',
       COALESCE((SELECT obj_description(p.oid, 'pg_proc') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), 'missing'),
       COALESCE((SELECT obj_description(p.oid, 'pg_proc') = 'cycle-count-02:rev1' FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), false)
UNION ALL
SELECT 'authenticated may NOT execute cycle_count_complete', 'false',
       COALESCE((SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE')::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), 'missing'),
       COALESCE((SELECT NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), false)
UNION ALL
SELECT 'service_role may execute cycle_count_complete', 'true',
       COALESCE((SELECT has_function_privilege('service_role', p.oid, 'EXECUTE')::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), 'missing'),
       COALESCE((SELECT has_function_privilege('service_role', p.oid, 'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'cycle_count_complete' LIMIT 1), false);
