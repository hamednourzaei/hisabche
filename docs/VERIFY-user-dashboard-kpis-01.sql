-- docs/VERIFY-user-dashboard-kpis-01.sql — read-only. Every row must be ok = true.
SELECT 'table exists' AS "check",
       to_regclass('public.user_dashboard_kpis') IS NOT NULL AS ok
UNION ALL
SELECT 'rls on',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.user_dashboard_kpis')), false)
UNION ALL
SELECT 'clients locked out',
       NOT has_table_privilege('anon', 'public.user_dashboard_kpis', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.user_dashboard_kpis', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.user_dashboard_kpis', 'INSERT')
UNION ALL
SELECT 'backend may read and write, never delete',
       has_table_privilege('service_role', 'public.user_dashboard_kpis', 'SELECT')
       AND has_table_privilege('service_role', 'public.user_dashboard_kpis', 'INSERT')
       AND has_table_privilege('service_role', 'public.user_dashboard_kpis', 'UPDATE')
       AND NOT has_table_privilege('service_role', 'public.user_dashboard_kpis', 'DELETE')
UNION ALL
SELECT 'at most 4 per row',
       EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'user_dashboard_kpis_shape'
                 AND conrelid = 'public.user_dashboard_kpis'::regclass);
