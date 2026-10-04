-- ============================================================================
-- VERIFY — docs/late-fees-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ' || t.name || ' exists' AS check, to_regclass('public.' || t.name) IS NOT NULL AS ok
FROM (VALUES ('late_fee_policies'), ('late_fee_assessments')) AS t(name)

UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('late_fee_policies', 'late_fee_assessments')

UNION ALL
SELECT 'clients cannot read ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee IN ('anon', 'authenticated')
)
FROM (VALUES ('late_fee_policies'), ('late_fee_assessments')) AS t(name)

UNION ALL
SELECT 'the backend role cannot DELETE from ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee = 'service_role' AND privilege_type IN ('DELETE', 'TRUNCATE')
)
FROM (VALUES ('late_fee_policies'), ('late_fee_assessments')) AS t(name)

UNION ALL
SELECT 'one assessment per invoice, installment and period (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'late_fee_assessments_once'
     AND indexdef ILIKE '%UNIQUE%'
)

UNION ALL
SELECT 'assessments are forward-only (trigger)', EXISTS (
  SELECT 1 FROM pg_trigger
   WHERE tgname = 'late_fee_assessments_guard_trg' AND NOT tgisinternal
)

UNION ALL
SELECT 'no business charges late fees it did not turn on', NOT EXISTS (
  SELECT 1 FROM public.late_fee_assessments a
   WHERE NOT EXISTS (
     SELECT 1 FROM public.late_fee_policies p WHERE p.workspace_id = a.workspace_id
   )
);
