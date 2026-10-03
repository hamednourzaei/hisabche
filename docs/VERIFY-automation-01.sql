-- ============================================================================
-- VERIFY — docs/automation-01-migration.sql
-- Read-only. Run after the migration; every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ' || t.name || ' exists' AS check, EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = t.name
       ) AS ok
  FROM (VALUES ('automations'), ('automation_runs')) AS t (name)

UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('automations', 'automation_runs')

UNION ALL
SELECT 'no client policy on ' || t.name, NOT EXISTS (
         SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t.name
       )
  FROM (VALUES ('automations'), ('automation_runs')) AS t (name)

UNION ALL
SELECT 'clients cannot read ' || t.name, NOT EXISTS (
         SELECT 1 FROM information_schema.role_table_grants
          WHERE table_schema = 'public' AND table_name = t.name
            AND grantee IN ('anon', 'authenticated')
       )
  FROM (VALUES ('automations'), ('automation_runs')) AS t (name)

UNION ALL
SELECT 'one success per slot (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'automation_runs_one_success_per_slot'
)

UNION ALL
SELECT 'failure policy is one of stop/keep/ignore', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.automations'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%on_failure%'
)

UNION ALL
SELECT 'run outcome is one of ran/skipped/failed', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.automation_runs'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%outcome%'
)

UNION ALL
-- The job runtime this relies on (docs/background-jobs-claim-migration.sql).
SELECT 'function claim_scheduled_run exists', EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'claim_scheduled_run'
);
