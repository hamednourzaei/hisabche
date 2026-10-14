-- VERIFY custom-units-01 — read-only. Every row must say ok = true.
SELECT 'table exists' AS check, to_regclass('public.custom_unit_rates') IS NOT NULL AS ok
UNION ALL
SELECT 'one quote per unit per day',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'custom_unit_rates_one_per_day')
UNION ALL
SELECT 'positive worth enforced',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_unit_rates_positive')
UNION ALL
SELECT 'row level security on',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.custom_unit_rates'::regclass), false)
UNION ALL
SELECT 'browser roles have nothing',
       NOT has_table_privilege('anon', 'public.custom_unit_rates', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.custom_unit_rates', 'SELECT')
UNION ALL
SELECT 'server cannot delete',
       NOT has_table_privilege('service_role', 'public.custom_unit_rates', 'DELETE');
