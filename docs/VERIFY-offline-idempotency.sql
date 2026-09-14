-- docs/VERIFY-offline-idempotency.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT t.tbl || ': column exists' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t.tbl AND column_name = 'client_request_id') AS ok
FROM (VALUES ('customers'), ('products'), ('transactions'), ('payments')) AS t(tbl)
UNION ALL
SELECT t.tbl || ': unique partial index',
       EXISTS (SELECT 1 FROM pg_indexes
               WHERE schemaname = 'public' AND indexname = t.tbl || '_client_request_key'
                 AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%WHERE%')
FROM (VALUES ('customers'), ('products'), ('transactions'), ('payments')) AS t(tbl)
UNION ALL
SELECT 'payments_record_keyed exists',
       to_regprocedure('public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text)') IS NOT NULL
UNION ALL
SELECT 'payments_record_keyed: only service_role may execute',
       has_function_privilege('service_role', 'public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text)', 'EXECUTE')
UNION ALL
SELECT 'payments_record_keyed: search_path pinned',
       EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text)')
               AND proconfig::text LIKE '%search_path=%');
