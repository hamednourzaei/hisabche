-- ============================================================================
-- VERIFY-product-barcode-unique.sql — read-only. Run AFTER
-- product-barcode-unique-migration.sql and send the results back.
-- ============================================================================

-- 1. The index exists and is UNIQUE and partial (expect one row, is_unique = true,
--    predicate mentions barcode <> ''::text).
SELECT i.relname AS index_name,
       ix.indisunique AS is_unique,
       pg_get_expr(ix.indpred, ix.indrelid) AS predicate
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
 WHERE i.relname = 'products_workspace_barcode_key';

-- 2. Duplicates that would block the index (expect ZERO rows). If rows appear,
--    the migration printed a NOTICE and did not create the index.
SELECT workspace_id, barcode, count(*) AS products, array_agg(name ORDER BY name) AS names
  FROM public.products
 WHERE barcode IS NOT NULL AND barcode <> ''
 GROUP BY workspace_id, barcode
HAVING count(*) > 1
 ORDER BY products DESC;

-- 3. Barcodes stored with spaces or Persian/Arabic digits (the API now
--    normalises on write; old rows keep what they had). Informational — a scan
--    of «626…» will not match a stored «۶۲۶…». Expect zero; fix by editing the
--    product if any appear.
SELECT workspace_id, id, name, barcode
  FROM public.products
 WHERE barcode ~ '[\s۰-۹٠-٩]'
 LIMIT 50;
