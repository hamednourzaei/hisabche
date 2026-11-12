-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.22 document_revisions table, RLS, immutability trigger, and entity triggers

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'document_revisions';

SELECT tgname, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN (
    'trg_document_revisions_immutable',
    'trg_invoices_document_revision',
    'trg_customers_document_revision',
    'trg_products_document_revision'
  )
ORDER BY tgname;
