-- VERIFY dashboard-stock-value-01 — run after the migration; every row ok = true.
SELECT 'function clamps negative stock' AS check,
       pg_get_functiondef('public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)'::regprocedure)
         LIKE '%GREATEST(q, 0) * bp%' AS ok
UNION ALL
SELECT 'function counts negative stock',
       pg_get_functiondef('public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)'::regprocedure)
         LIKE '%negative_stock_products%'
UNION ALL
SELECT 'anon cannot execute',
       NOT has_function_privilege('anon', 'public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE')
UNION ALL
SELECT 'service_role can execute',
       has_function_privilege('service_role', 'public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE');
