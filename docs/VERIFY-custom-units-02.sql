-- VERIFY custom-units-02 — read-only. Every row must say ok = true.
SELECT 'server can delete a unit' AS check,
       has_table_privilege('service_role', 'public.custom_unit_rates', 'DELETE') AS ok
UNION ALL
SELECT 'browser roles still have nothing',
       NOT has_table_privilege('anon', 'public.custom_unit_rates', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.custom_unit_rates', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.custom_unit_rates', 'DELETE')
   AND NOT has_table_privilege('authenticated', 'public.custom_unit_rates', 'DELETE');
