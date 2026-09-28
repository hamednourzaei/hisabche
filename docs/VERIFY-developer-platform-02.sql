-- ============================================================================
-- VERIFY — docs/developer-platform-02-migration.sql
--
-- Read-only. Run in the SQL Editor AFTER the migration. Every row must read
-- ok = true. Paste the result back; until then the status is
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'request log table' AS check,
       to_regclass('public.api_request_logs') IS NOT NULL AS ok
UNION ALL
SELECT 'request log has RLS',
       (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'api_request_logs')
UNION ALL
SELECT 'request log policy is SELECT-only, managers',
       (SELECT bool_and(cmd = 'SELECT' AND qual ILIKE '%workspace_members%' AND qual ILIKE '%manager%')
          FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_request_logs')
   AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_request_logs') = 1
UNION ALL
SELECT 'clients cannot write the log',
       NOT has_table_privilege('authenticated', 'public.api_request_logs', 'INSERT')
   AND NOT has_table_privilege('anon', 'public.api_request_logs', 'SELECT')
UNION ALL
SELECT 'replayed_at column',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'webhook_deliveries' AND column_name = 'replayed_at')
UNION ALL
SELECT 'functions present',
       to_regprocedure('public.api_key_usage(uuid, uuid, integer)') IS NOT NULL
   AND to_regprocedure('public.purge_api_request_logs(integer)') IS NOT NULL
   AND to_regprocedure('public.replay_webhook_deliveries(uuid, uuid, timestamptz)') IS NOT NULL
   AND to_regprocedure('public.products_stock_webhook()') IS NOT NULL
UNION ALL
SELECT 'clients cannot call them',
       NOT has_function_privilege('authenticated', 'public.replay_webhook_deliveries(uuid, uuid, timestamptz)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.purge_api_request_logs(integer)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.api_key_usage(uuid, uuid, integer)', 'EXECUTE')
UNION ALL
SELECT 'stock trigger installed and enabled',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_stock_webhook_trg' AND tgenabled <> 'D');
