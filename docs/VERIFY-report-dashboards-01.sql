-- ============================================================================
-- VERIFY — docs/report-dashboards-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table report_dashboards exists' AS check,
       to_regclass('public.report_dashboards') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on report_dashboards', COALESCE((
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'report_dashboards'
), false)

UNION ALL
SELECT 'clients cannot read report_dashboards', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'report_dashboards'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'the backend role cannot DELETE from report_dashboards', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'report_dashboards'
     AND grantee = 'service_role' AND privilege_type IN ('DELETE', 'TRUNCATE')
)

UNION ALL
SELECT 'one active dashboard per name (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'report_dashboards_active_name'
);
