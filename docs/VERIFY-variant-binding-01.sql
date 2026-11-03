-- VERIFY variant-binding-01 — one result set; every row must be ok = true.
SELECT 'variant_id column exists' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'variant_id') AS ok
UNION ALL
SELECT 'column is nullable (legacy rows keep NULL)',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'invoice_items'
                 AND column_name = 'variant_id' AND is_nullable = 'YES')
UNION ALL
SELECT 'foreign key to product_variants exists',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_variant_fk')
UNION ALL
SELECT 'partial index exists',
       EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'invoice_items_variant_idx');
