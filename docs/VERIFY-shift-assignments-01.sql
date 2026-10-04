-- ============================================================================
-- VERIFY — docs/shift-assignments-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table shift_assignments exists' AS check,
       to_regclass('public.shift_assignments') IS NOT NULL AS ok

UNION ALL
SELECT 'table work_shifts exists (run work-shifts-01 first)',
       to_regclass('public.work_shifts') IS NOT NULL

UNION ALL
SELECT 'RLS enabled on shift_assignments', COALESCE((
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'shift_assignments'
), false)

UNION ALL
SELECT 'clients cannot read shift_assignments', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'shift_assignments'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'the backend role cannot DELETE from shift_assignments', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'shift_assignments'
     AND grantee = 'service_role' AND privilege_type IN ('DELETE', 'TRUNCATE')
)

UNION ALL
SELECT 'trigger ' || t.name || ' exists', EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgname = t.name AND NOT tgisinternal
)
FROM (VALUES ('shift_assignments_before_insert_trg'), ('shift_assignments_guard_trg')) AS t(name)

UNION ALL
SELECT 'nobody is planned for two overlapping shifts on one day', NOT EXISTS (
  SELECT 1
    FROM public.shift_assignments a
    JOIN public.shift_assignments b
      ON b.workspace_id = a.workspace_id
     AND b.employee_id  = a.employee_id
     AND b.work_date    = a.work_date
     AND b.id > a.id
   WHERE NOT a.is_cancelled AND NOT b.is_cancelled
     AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at
);
