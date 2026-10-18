-- VERIFY shelf-capacity-01 — read-only. Every row must say ok = true.
SELECT 'auto shelf table exists' AS check,
       to_regclass('public.storage_auto_shelves') IS NOT NULL AS ok
UNION ALL
SELECT 'auto receipt table exists',
       to_regclass('public.storage_auto_receipts') IS NOT NULL
UNION ALL
SELECT 'one auto shelf per warehouse and product',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storage_auto_shelves_pkey')
UNION ALL
SELECT 'one auto-fill per invoice and product',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storage_auto_receipts_pkey')
UNION ALL
SELECT 'placement refuses to go past capacity',
       EXISTS (SELECT 1 FROM pg_proc
                WHERE proname = 'storage_place_stock'
                  AND prosrc LIKE '%STORAGE_PLACEMENT_EXCEEDS_CAPACITY%')
UNION ALL
SELECT 'the auto-fill function exists',
       to_regprocedure('public.storage_auto_shelve_invoice(uuid, uuid)') IS NOT NULL
UNION ALL
SELECT 'row level security on both tables',
       (SELECT bool_and(relrowsecurity) FROM pg_class
         WHERE oid IN ('public.storage_auto_shelves'::regclass,
                       'public.storage_auto_receipts'::regclass))
UNION ALL
SELECT 'nobody but the server reaches the tables',
       NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                    WHERE table_schema = 'public'
                      AND table_name IN ('storage_auto_shelves', 'storage_auto_receipts')
                      AND grantee IN ('anon', 'authenticated'))
UNION ALL
SELECT 'the server cannot delete an auto-fill record',
       NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                    WHERE table_schema = 'public'
                      AND table_name = 'storage_auto_receipts'
                      AND grantee = 'service_role'
                      AND privilege_type IN ('DELETE', 'TRUNCATE'))
UNION ALL
SELECT 'only the server runs the auto-fill',
       NOT has_function_privilege('anon', 'public.storage_auto_shelve_invoice(uuid, uuid)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.storage_auto_shelve_invoice(uuid, uuid)', 'EXECUTE');
