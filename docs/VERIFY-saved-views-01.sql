-- ============================================================================
-- VERIFY — docs/saved-views-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table saved_views exists' AS check, to_regclass('public.saved_views') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on saved_views', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'saved_views'
)

UNION ALL
SELECT 'no client policy on saved_views', NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_views'
)

UNION ALL
SELECT 'clients cannot read saved_views', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'saved_views'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'one name per person per table (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'saved_views_owner_name'
);
