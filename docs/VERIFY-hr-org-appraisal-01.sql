-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.17 employee_documents, employee_appraisals, and org cycle trigger

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('employee_documents', 'employee_appraisals')
ORDER BY c.relname;
