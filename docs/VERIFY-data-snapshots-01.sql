-- ============================================================================
-- VERIFY — docs/data-snapshots-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table data_snapshots exists' AS check, to_regclass('public.data_snapshots') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on data_snapshots', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'data_snapshots'
)

UNION ALL
SELECT 'clients cannot read data_snapshots', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'data_snapshots'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'the backend role cannot UPDATE or DELETE a snapshot', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'data_snapshots'
     AND grantee = 'service_role' AND privilege_type IN ('UPDATE', 'DELETE')
)

UNION ALL
SELECT 'append-only trigger is in place', EXISTS (
  SELECT 1 FROM pg_trigger
   WHERE tgrelid = 'public.data_snapshots'::regclass AND tgname = 'data_snapshots_append_only_trg'
)

UNION ALL
SELECT 'no snapshot claims to be restorable', NOT EXISTS (
  SELECT 1 FROM public.data_snapshots WHERE restorable
);
