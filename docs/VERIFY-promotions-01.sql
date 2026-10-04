-- ============================================================================
-- VERIFY — docs/promotions-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table promotions exists' AS check, to_regclass('public.promotions') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on promotions', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'promotions'
)

UNION ALL
SELECT 'clients cannot read promotions', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'promotions'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'constraint ' || c.name, EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.promotions'::regclass AND conname = c.name
)
FROM (VALUES
  ('promotions_percent_in_range'),
  ('promotions_fixed_has_currency'),
  ('promotions_window_in_order'),
  ('promotions_products_not_empty'),
  ('promotions_customers_not_empty')
) AS c(name)

UNION ALL
SELECT 'no fixed-amount promotion without a currency', NOT EXISTS (
  SELECT 1 FROM public.promotions WHERE kind = 'fixed_amount' AND currency IS NULL
);
