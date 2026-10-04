-- ============================================================================
-- VERIFY — docs/work-shifts-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table work_shifts exists' AS check, to_regclass('public.work_shifts') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on work_shifts', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'work_shifts'
)

UNION ALL
SELECT 'clients cannot read work_shifts', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'work_shifts'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'constraint ' || c.name, EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.work_shifts'::regclass AND conname = c.name
)
FROM (VALUES
  ('work_shifts_ends_after_start'),
  ('work_shifts_break_shorter_than_shift')
) AS c(name)

UNION ALL
SELECT 'one active shift per name (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'work_shifts_active_name'
);
