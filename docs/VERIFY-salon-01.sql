-- docs/VERIFY-salon-01.sql — every row must say ok = true.
SELECT 'service_resources exists' AS check_name, to_regclass('public.service_resources') IS NOT NULL AS ok
UNION ALL SELECT 'service_catalog exists', to_regclass('public.service_catalog') IS NOT NULL
UNION ALL SELECT 'catalog holds its recipe',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
           AND table_name = 'service_catalog' AND column_name = 'consumables')
UNION ALL SELECT 'sessions carry a resource',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
           AND table_name = 'service_delivery_sessions' AND column_name = 'resource_id')
UNION ALL SELECT 'sessions carry a department',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
           AND table_name = 'service_delivery_sessions' AND column_name = 'department_id')
UNION ALL SELECT 'resource double-booking trigger',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'service_sessions_resource_guard_trg')
UNION ALL SELECT 'catalog rows are never deleted',
  NOT has_table_privilege('service_role', 'public.service_catalog', 'DELETE')
UNION ALL SELECT 'anon cannot read the catalog',
  NOT has_table_privilege('anon', 'public.service_catalog', 'SELECT')
UNION ALL SELECT 'resource guard closed to service_role',
  NOT has_function_privilege('service_role', 'public.service_sessions_resource_guard()', 'EXECUTE');
