-- ============================================================================
-- docs/VERIFY-inventory-void-receipt-01.sql
-- READ-ONLY. One row per check: check_name | expected | actual | pass.
-- Run after docs/inventory-void-receipt-01-migration.sql. «Success. No rows returned» is NOT a pass.
-- ============================================================================

WITH f AS (
  SELECT p.oid, p.prosecdef, pg_get_function_arguments(p.oid) AS args, obj_description(p.oid, 'pg_proc') AS note
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'inventory_void_receipt'
)
SELECT 'function exists once' AS check_name, '1' AS expected, count(*)::text AS actual, count(*) = 1 AS pass FROM f
UNION ALL
SELECT 'cost_layers.voided_at exists', 'true',
       (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cost_layers' AND column_name = 'voided_at'))::text,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cost_layers' AND column_name = 'voided_at')
UNION ALL
SELECT 'is SECURITY DEFINER', 'true', COALESCE((SELECT prosecdef::text FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT prosecdef FROM f LIMIT 1), false)
UNION ALL
SELECT 'version marker', 'inventory-void-receipt:rev1', COALESCE((SELECT note FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT note = 'inventory-void-receipt:rev1' FROM f LIMIT 1), false)
UNION ALL
SELECT 'service_role may execute', 'true',
       COALESCE((SELECT has_function_privilege('service_role', oid, 'EXECUTE')::text FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT has_function_privilege('service_role', oid, 'EXECUTE') FROM f LIMIT 1), false)
UNION ALL
SELECT 'authenticated may NOT execute', 'false',
       COALESCE((SELECT has_function_privilege('authenticated', oid, 'EXECUTE')::text FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT NOT has_function_privilege('authenticated', oid, 'EXECUTE') FROM f LIMIT 1), false)
UNION ALL
SELECT 'anon may NOT execute', 'false',
       COALESCE((SELECT has_function_privilege('anon', oid, 'EXECUTE')::text FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT NOT has_function_privilege('anon', oid, 'EXECUTE') FROM f LIMIT 1), false);
