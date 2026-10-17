-- VERIFY warehouse-map-01 — read-only. Every row must say ok = true.
SELECT 'location table exists' AS check,
       to_regclass('public.storage_locations') IS NOT NULL AS ok
UNION ALL
SELECT 'placement table exists',
       to_regclass('public.storage_location_placements') IS NOT NULL
UNION ALL
SELECT 'a code is unique inside its warehouse',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'storage_locations_code_per_warehouse')
UNION ALL
SELECT 'kind is one of the five',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storage_locations_kind')
UNION ALL
SELECT 'a rectangle is positive',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storage_locations_size_positive')
UNION ALL
SELECT 'capacity, when given, is positive',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storage_locations_capacity_positive')
UNION ALL
SELECT 'a location is not its own parent',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storage_locations_not_own_parent')
UNION ALL
SELECT 'warehouse and parent are checked on write',
       EXISTS (SELECT 1 FROM pg_trigger
                WHERE tgname = 'storage_locations_shape' AND NOT tgisinternal)
UNION ALL
SELECT 'the tree can be walked by warehouse',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'storage_locations_tree')
UNION ALL
SELECT 'placement quantity is never negative',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'storage_location_placements_not_negative')
UNION ALL
SELECT 'one placement row per location and product',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'storage_location_placements_one_per_product')
UNION ALL
SELECT 'the one writing path exists',
       EXISTS (SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public'
                 AND p.proname = 'storage_place_stock'
                 AND pg_get_function_identity_arguments(p.oid) =
                     'p_workspace uuid, p_actor uuid, p_location uuid, p_product uuid, p_quantity numeric')
UNION ALL
SELECT 'the writing path pins its search_path',
       EXISTS (SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public'
                 AND p.proname = 'storage_place_stock'
                 AND p.proconfig::text LIKE '%search_path=public, pg_temp%')
UNION ALL
SELECT 'row level security on, both tables',
       COALESCE((SELECT relrowsecurity FROM pg_class
                  WHERE oid = 'public.storage_locations'::regclass), false)
   AND COALESCE((SELECT relrowsecurity FROM pg_class
                  WHERE oid = 'public.storage_location_placements'::regclass), false)
UNION ALL
SELECT 'browser roles can read nothing',
       NOT has_table_privilege('anon', 'public.storage_locations', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.storage_locations', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.storage_location_placements', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.storage_location_placements', 'SELECT')
UNION ALL
SELECT 'browser roles cannot place stock themselves',
       NOT has_function_privilege('anon',
             'public.storage_place_stock(uuid, uuid, uuid, uuid, numeric)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated',
             'public.storage_place_stock(uuid, uuid, uuid, uuid, numeric)', 'EXECUTE')
UNION ALL
SELECT 'the server cannot delete a location or a placement',
       NOT has_table_privilege('service_role', 'public.storage_locations', 'DELETE')
   AND NOT has_table_privilege('service_role', 'public.storage_location_placements', 'DELETE');
