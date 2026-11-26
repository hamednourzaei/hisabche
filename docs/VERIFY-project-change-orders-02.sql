-- ============================================
-- docs/VERIFY-project-change-orders-02.sql
--
-- Read-only verification for docs/project-change-orders-02-rpc-migration.sql
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT p.proname, p.prosecdef, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'decide_project_change_order';
