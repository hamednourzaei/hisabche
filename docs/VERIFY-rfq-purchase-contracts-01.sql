-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.13 & B.2.14 rfqs, supplier_quotations, purchase_contract_prices

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('rfqs', 'supplier_quotations', 'purchase_contract_prices')
ORDER BY c.relname;
