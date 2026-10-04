-- ============================================================================
-- VERIFY — docs/financing-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ' || t.name || ' exists' AS check, to_regclass('public.' || t.name) IS NOT NULL AS ok
FROM (VALUES ('loan_facilities'), ('investment_holdings')) AS t(name)

UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('loan_facilities', 'investment_holdings')

UNION ALL
SELECT 'clients cannot read ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee IN ('anon', 'authenticated')
)
FROM (VALUES ('loan_facilities'), ('investment_holdings')) AS t(name)

UNION ALL
SELECT 'a facility ends after it starts (constraint)', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.loan_facilities'::regclass AND conname = 'loan_facilities_dates_in_order'
);
