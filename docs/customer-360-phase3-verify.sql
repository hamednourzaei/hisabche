-- docs/customer-360-phase3-verify.sql — read-only. Every row should say ok = true.

SELECT 'customers.' || c AS item,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = c) AS ok
FROM unnest(ARRAY['credit_limit', 'payment_terms_days', 'supplier_id']) AS c
UNION ALL
SELECT 'constraint ' || n,
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = n)
FROM unnest(ARRAY['customers_credit_limit_check', 'customers_payment_terms_days_check',
                  'customers_supplier_id_fkey', 'customer_documents_size_check']) AS n
UNION ALL
SELECT 'index customers_workspace_supplier_key',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'customers_workspace_supplier_key')
UNION ALL
SELECT 'customer_documents RLS enabled',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE relname = 'customer_documents'), false)
UNION ALL
SELECT 'customer_documents policies = 3',
       (SELECT count(*) FROM pg_policies WHERE tablename = 'customer_documents') = 3
UNION ALL
SELECT 'bucket customer-documents private',
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'customer-documents' AND public = false)
UNION ALL
-- Nothing was backfilled: every existing customer still has no limit/terms/link.
SELECT 'no guessed values (rows with a value, expected 0 right after migration)',
       (SELECT count(*) FROM customers
        WHERE credit_limit IS NOT NULL OR payment_terms_days IS NOT NULL OR supplier_id IS NOT NULL) = 0;
