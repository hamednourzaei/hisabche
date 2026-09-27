-- VERIFY for the four migrations of 27 Sep 2026 — read-only.
--   invoice-write-document-migration.sql
--   purchase-order-write-migration.sql
--   stock-transfer-idempotency-migration.sql
--   product-barcodes-migration.sql
-- Expected: every row's `ok` is true. A missing function shows as a row with
-- ok = false (not as an error), so this can run before and after.

WITH fns(name, signature) AS (
  VALUES
    ('invoice_write_document', 'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint)'),
    ('document_write_rows',    'public.document_write_rows(text, jsonb)'),
    ('purchase_order_write',   'public.purchase_order_write(uuid, uuid, jsonb, jsonb)'),
    ('warehouse_transfer_stock_keyed', 'public.warehouse_transfer_stock_keyed(uuid, uuid, jsonb, uuid)'),
    ('warehouse_transfer_stock',       'public.warehouse_transfer_stock(uuid, uuid, jsonb)')
), resolved AS (
  SELECT name, to_regprocedure(signature) AS oid FROM fns
)
SELECT name || ': exists' AS check, oid IS NOT NULL AS ok FROM resolved
UNION ALL
SELECT name || ': clients cannot execute',
       oid IS NOT NULL
       AND NOT has_function_privilege('anon', oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
  FROM resolved
UNION ALL
SELECT name || ': backend can execute',
       oid IS NOT NULL AND has_function_privilege('service_role', oid, 'EXECUTE')
  FROM resolved
UNION ALL
SELECT name || ': search_path fixed',
       oid IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = resolved.oid
                     AND array_to_string(p.proconfig, ',') LIKE '%search_path=%')
  FROM resolved
UNION ALL
-- product_barcodes
SELECT 'product_barcodes: table exists', to_regclass('public.product_barcodes') IS NOT NULL
UNION ALL
SELECT 'product_barcodes: row security on',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.product_barcodes')), false)
UNION ALL
SELECT 'product_barcodes: one code per workspace (unique index)',
       to_regclass('public.product_barcodes_workspace_barcode_key') IS NOT NULL
UNION ALL
SELECT 'products: main barcode cannot be an extra one (trigger)',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_barcode_not_extra');
