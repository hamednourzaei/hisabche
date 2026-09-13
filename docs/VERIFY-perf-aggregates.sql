-- ============================================================================
-- docs/VERIFY-perf-aggregates.sql
--
-- Run AFTER docs/perf-aggregates-analytics-migration.sql and
-- docs/perf-aggregates-ledger-migration.sql. Read-only.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- V1. All six functions exist, are SECURITY DEFINER, and are NOT executable by
--     anon / authenticated / PUBLIC, but ARE by service_role.
--     Expect 6 rows: prosecdef = true, anon = false, authenticated = false,
--     service_role = true.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid)                         AS args,
       p.prosecdef                                                       AS security_definer,
       has_function_privilege('anon',          p.oid, 'EXECUTE')         AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')         AS authenticated_can_execute,
       has_function_privilege('service_role',  p.oid, 'EXECUTE')         AS service_role_can_execute
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.proname IN ('analytics_dashboard_kpis', 'analytics_sales_summary',
                     'analytics_inventory_summary', 'invoices_summary_kpis',
                     'accounting_customer_debt', 'budget_consumption')
ORDER  BY p.proname;

-- V2. Indexes exist. Expect 2 rows.
SELECT indexname FROM pg_indexes
WHERE  schemaname = 'public'
  AND  indexname IN ('invoices_workspace_id_date_idx', 'journal_lines_workspace_id_account_id_idx');

-- V3. Numbers agree with a direct count, for ONE workspace you own.
--     Replace the uuid. Expect total_sales_sql = total_sales_direct and
--     invoice counts equal (the whole point: > 1000 invoices must still match).
WITH ws AS (SELECT '00000000-0000-0000-0000-000000000000'::uuid AS id)
SELECT
  (SELECT SUM((c->>'total_sales')::numeric)
     FROM jsonb_array_elements(public.analytics_dashboard_kpis((SELECT id FROM ws), now(), now(), now()) -> 'currencies') c)
                                                                              AS total_sales_sql,
  (SELECT COALESCE(SUM(total), 0) FROM invoices
     WHERE workspace_id = (SELECT id FROM ws) AND type IS DISTINCT FROM 'purchase')
                                                                              AS total_sales_direct,
  (public.analytics_sales_summary((SELECT id FROM ws), '-infinity', 'infinity', now()) ->> 'total_invoices')::bigint
                                                                              AS sales_invoices_sql,
  (SELECT COUNT(*) FROM invoices
     WHERE workspace_id = (SELECT id FROM ws) AND (type = 'sale' OR type IS NULL))
                                                                              AS sales_invoices_direct;
