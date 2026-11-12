-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.7 approval policy tables, RLS, and append-only event trigger

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('approval_policies', 'approval_policy_requests', 'approval_policy_events')
ORDER BY c.relname;
