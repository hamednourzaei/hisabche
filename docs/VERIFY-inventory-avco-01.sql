-- ============================================================================
-- docs/VERIFY-inventory-avco-01.sql — read only. Run after inventory-avco-01.
-- Each row: ok = true is what the migration promises.
-- ============================================================================

SELECT 'avco draws pro-rata (v_ratio in the function body)' AS check,
       position('v_ratio' in pg_get_functiondef('public.inventory_consume_layers(uuid, uuid, jsonb)'::regprocedure)) > 0 AS ok
UNION ALL
SELECT 'each row costed at its layer price, not the average',
       position('COALESCE(v_avg_cost' in pg_get_functiondef('public.inventory_consume_layers(uuid, uuid, jsonb)'::regprocedure)) = 0
UNION ALL
SELECT 'the per-consumer lock is still there',
       position('pg_advisory_xact_lock' in pg_get_functiondef('public.inventory_consume_layers(uuid, uuid, jsonb)'::regprocedure)) > 0
UNION ALL
SELECT 'anon cannot execute it',
       NOT has_function_privilege('anon', 'public.inventory_consume_layers(uuid, uuid, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'authenticated cannot execute it',
       NOT has_function_privilege('authenticated', 'public.inventory_consume_layers(uuid, uuid, jsonb)', 'EXECUTE');
