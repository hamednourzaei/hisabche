-- ============================================================================
-- VERIFY — docs/saved-reports-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table saved_reports exists' AS check, to_regclass('public.saved_reports') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on saved_reports', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'saved_reports'
)

UNION ALL
SELECT 'clients cannot read saved_reports', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'saved_reports'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'one active report per name (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'saved_reports_active_name'
)

UNION ALL
SELECT 'every stored definition is a JSON object', NOT EXISTS (
  SELECT 1 FROM public.saved_reports WHERE jsonb_typeof(definition) <> 'object'
);
