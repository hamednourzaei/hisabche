-- ============================================================================
-- VERIFY — docs/developer-platform-migration.sql
--
-- Read-only. Run in the SQL Editor AFTER the migration. Every row must read
-- ok = true. Paste the result back; until then the status is
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'tables' AS check,
       to_regclass('public.api_keys') IS NOT NULL
   AND to_regclass('public.webhook_endpoints') IS NOT NULL
   AND to_regclass('public.webhook_endpoint_secrets') IS NOT NULL
   AND to_regclass('public.webhook_deliveries') IS NOT NULL AS ok
UNION ALL
SELECT 'rls on (4 tables)',
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relrowsecurity
           AND c.relname IN ('api_keys', 'webhook_endpoints', 'webhook_endpoint_secrets', 'webhook_deliveries')) = 4
UNION ALL
SELECT 'no client policy on secrets',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhook_endpoint_secrets')
UNION ALL
SELECT 'client policies are SELECT-only and owner/admin-scoped',
       (SELECT bool_and(cmd = 'SELECT' AND qual ILIKE '%workspace_members%' AND qual ILIKE '%owner%')
          FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('api_keys', 'webhook_endpoints', 'webhook_deliveries'))
   AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('api_keys', 'webhook_endpoints', 'webhook_deliveries')) = 3
UNION ALL
SELECT 'clients cannot write',
       NOT has_table_privilege('authenticated', 'public.api_keys', 'INSERT')
   AND NOT has_table_privilege('authenticated', 'public.api_keys', 'UPDATE')
   AND NOT has_table_privilege('authenticated', 'public.webhook_endpoints', 'INSERT')
   AND NOT has_table_privilege('authenticated', 'public.webhook_deliveries', 'UPDATE')
UNION ALL
SELECT 'clients cannot read secrets',
       NOT has_table_privilege('authenticated', 'public.webhook_endpoint_secrets', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.webhook_endpoint_secrets', 'SELECT')
UNION ALL
SELECT 'anon is granted nothing',
       NOT has_table_privilege('anon', 'public.api_keys', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.webhook_endpoints', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.webhook_deliveries', 'SELECT')
UNION ALL
SELECT 'key is stored as a hash only',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'key_hash')
   AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name IN ('key', 'secret', 'token'))
UNION ALL
SELECT 'one delivery per endpoint and event',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_once' AND contype = 'u')
UNION ALL
SELECT 'functions present',
       to_regprocedure('public.enqueue_webhook_event(uuid, uuid, text, jsonb)') IS NOT NULL
   AND to_regprocedure('public.claim_webhook_deliveries(text, integer, integer, uuid)') IS NOT NULL
   AND to_regprocedure('public.complete_webhook_delivery(uuid, text, integer)') IS NOT NULL
   AND to_regprocedure('public.fail_webhook_delivery(uuid, text, text, integer, integer)') IS NOT NULL
UNION ALL
SELECT 'clients cannot call the functions',
       NOT has_function_privilege('authenticated', 'public.enqueue_webhook_event(uuid, uuid, text, jsonb)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.claim_webhook_deliveries(text, integer, integer, uuid)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.fail_webhook_delivery(uuid, text, text, integer, integer)', 'EXECUTE');
