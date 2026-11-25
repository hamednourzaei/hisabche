-- ============================================
-- docs/VERIFY-project-change-orders-01.sql
-- Read-only verification after running project-change-orders-01-migration.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT
  to_regclass('public.project_change_orders') AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.project_change_orders')) AS rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_change_orders') AS policy_count;
