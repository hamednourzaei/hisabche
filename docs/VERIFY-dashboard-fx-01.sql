-- ============================================================================
-- VERIFY dashboard-fx-01 — read-only. Run AFTER dashboard-fx-01-migration.sql.
-- One result set; every row must say ok = true.
-- ============================================================================

SELECT * FROM (
  SELECT 1 AS n, 'invoice_books_amount exists' AS check,
         to_regprocedure('public.invoice_books_amount(numeric, text, numeric, text)') IS NOT NULL AS ok
  UNION ALL
  SELECT 2, 'analytics_dashboard_kpis_v2 exists',
         to_regprocedure('public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)') IS NOT NULL
  UNION ALL
  SELECT 3, 'analytics_sales_summary_v2 exists',
         to_regprocedure('public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text)') IS NOT NULL
  UNION ALL
  SELECT 4, 'v1 functions untouched (fallback still there)',
         to_regprocedure('public.analytics_dashboard_kpis(uuid, timestamptz, timestamptz, timestamptz)') IS NOT NULL
     AND to_regprocedure('public.analytics_sales_summary(uuid, timestamptz, timestamptz, timestamptz)') IS NOT NULL
  UNION ALL
  SELECT 5, 'anon / authenticated cannot call the v2 functions',
         NOT has_function_privilege('anon', 'public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE')
  UNION ALL
  SELECT 6, 'service_role can call them',
         has_function_privilege('service_role', 'public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE')
     AND has_function_privilege('service_role', 'public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE')
  UNION ALL
  SELECT 7, 'owner example: 2,307,692.3 USD × 65 = 150,000,000 AFN (± rounding)',
         abs(public.invoice_books_amount(2307692.3, 'USD', 65, 'AFN') - 150000000) < 1
  UNION ALL
  SELECT 8, 'books currency counts as itself, rate ignored',
         public.invoice_books_amount(30000000, 'AFN', NULL, 'AFN') = 30000000
     AND public.invoice_books_amount(30000000, NULL, NULL, 'AFN') = 30000000
  UNION ALL
  SELECT 9, 'foreign without a rate is NULL, never × 1',
         public.invoice_books_amount(80, 'USD', NULL, 'AFN') IS NULL
     AND public.invoice_books_amount(80, 'USD', 0, 'AFN') IS NULL
  UNION ALL
  SELECT 10, 'invoices.exchange_rate column is present (required)',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'exchange_rate')
) v ORDER BY n;

-- Optional — how many invoices on the live database the dashboard cannot
-- convert (another currency, no frozen rate). Not a failure: they are shown
-- as «not convertible», never added in at 1.
-- SELECT w.id, w.base_currency, COUNT(*) AS not_convertible
--   FROM invoices i JOIN workspaces w ON w.id = i.workspace_id
--  WHERE COALESCE(NULLIF(i.currency, ''), w.base_currency) <> w.base_currency
--    AND (i.exchange_rate IS NULL OR i.exchange_rate <= 0)
--  GROUP BY w.id, w.base_currency;
