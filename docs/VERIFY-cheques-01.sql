-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.5 cheques table & RLS

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'cheques';
