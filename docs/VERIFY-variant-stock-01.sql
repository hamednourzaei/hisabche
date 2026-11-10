-- docs/VERIFY-variant-stock-01.sql — every row must say ok = true.
SELECT 'stock_movements.variant_id exists' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'stock_movements'
                  AND column_name = 'variant_id') AS ok
UNION ALL
SELECT 'variant FK present',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_variant_fk')
UNION ALL
SELECT 'product_variant_stock exists',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'product_variant_stock')
UNION ALL
SELECT 'product_variant_stock closed to anon',
       NOT has_function_privilege('anon', 'public.product_variant_stock(uuid, uuid)', 'EXECUTE')
UNION ALL
SELECT 'invoice_write_document gives back per variant',
       position('t.variant_id' IN pg_get_functiondef('public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)'::regprocedure)) > 0;
