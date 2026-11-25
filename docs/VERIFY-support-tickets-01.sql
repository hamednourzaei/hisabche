-- ============================================
-- docs/VERIFY-support-tickets-01.sql
-- Read-only verification after running support-tickets-01-migration.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT
  to_regclass('public.support_tickets') AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.support_tickets')) AS rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_tickets') AS policy_count;
