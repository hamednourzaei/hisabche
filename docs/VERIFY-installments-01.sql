-- ============================================================================
-- VERIFY — docs/installments-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table invoice_installments exists' AS check,
       to_regclass('public.invoice_installments') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on invoice_installments', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'invoice_installments'
)

UNION ALL
SELECT 'clients cannot read invoice_installments', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'invoice_installments'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'one row per (invoice, seq)', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'invoice_installments_invoice_seq'
)

UNION ALL
SELECT 'amounts are positive (check constraint)', EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.invoice_installments'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%amount_minor > 0%'
)

UNION ALL
SELECT 'function installments_save exists', EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'installments_save'
)

UNION ALL
SELECT 'clients cannot execute installments_save', NOT EXISTS (
  SELECT 1 FROM information_schema.routine_privileges
   WHERE routine_schema = 'public' AND routine_name = 'installments_save'
     AND grantee IN ('anon', 'authenticated', 'PUBLIC')
)

UNION ALL
SELECT 'no plan adds up to more than its invoice total', NOT EXISTS (
  SELECT 1
    FROM (SELECT invoice_id, SUM(amount_minor) AS planned FROM public.invoice_installments GROUP BY invoice_id) p
    JOIN public.invoices i ON i.id = p.invoice_id
   WHERE p.planned > round(i.total * 100)
);
