-- docs/VERIFY-inventory-consume-concurrency.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT 'consume function takes the advisory lock' AS check,
       pg_get_functiondef('public.inventory_consume_layers(uuid,uuid,jsonb)'::regprocedure)
         LIKE '%pg_advisory_xact_lock%' AS ok
UNION ALL
SELECT 'not executable by anon/authenticated',
       NOT has_function_privilege('anon', 'public.inventory_consume_layers(uuid,uuid,jsonb)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.inventory_consume_layers(uuid,uuid,jsonb)', 'EXECUTE')
UNION ALL
SELECT 'executable by service_role',
       has_function_privilege('service_role', 'public.inventory_consume_layers(uuid,uuid,jsonb)', 'EXECUTE')
UNION ALL
SELECT 'journal_entries_source_key unique index exists',
       EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='journal_entries_source_key')
UNION ALL
-- Existing damage check: any sale line consumed MORE than its quantity once.
SELECT 'no invoice line consumed twice (existing data)',
       NOT EXISTS (
         SELECT 1
         FROM cost_consumptions c
         JOIN invoice_items ii ON ii.id::text = c.consumer_line AND ii.invoice_id = c.consumer_id
         WHERE c.consumer_type = 'invoice'
         GROUP BY c.workspace_id, c.consumer_id, c.consumer_line, ii.quantity
         HAVING SUM(c.quantity) > ii.quantity
       );
