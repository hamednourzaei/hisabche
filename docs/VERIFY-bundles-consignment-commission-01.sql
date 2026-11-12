-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.8 (bundle_items), B.2.10 (consignment_lots), B.2.9 (invoices.seller_employee_id)

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('bundle_items', 'consignment_lots')
ORDER BY c.relname;
