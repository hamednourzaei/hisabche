-- ============================================================================
-- VERIFY — docs/developer-platform-05-oauth-migration.sql
-- Read-only. Every row must read ok = true. Until a human reports the result:
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'tables' AS check,
       to_regclass('public.oauth_apps') IS NOT NULL
   AND to_regclass('public.oauth_authorization_codes') IS NOT NULL AS ok
UNION ALL
SELECT 'api_keys.app_id',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'app_id')
UNION ALL
SELECT 'rls on both',
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relrowsecurity
           AND c.relname IN ('oauth_apps', 'oauth_authorization_codes')) = 2
UNION ALL
SELECT 'no client policy on codes, one publisher policy on apps',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'oauth_authorization_codes')
   AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'oauth_apps') = 1
UNION ALL
SELECT 'clients cannot read codes or write apps',
       NOT has_table_privilege('authenticated', 'public.oauth_authorization_codes', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.oauth_authorization_codes', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.oauth_apps', 'INSERT')
   AND NOT has_table_privilege('authenticated', 'public.oauth_apps', 'UPDATE')
UNION ALL
SELECT 'apps are private by default',
       (SELECT column_default FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'oauth_apps' AND column_name = 'status') LIKE '%private%'
UNION ALL
SELECT 'redeem function present and not callable by clients',
       to_regprocedure('public.redeem_oauth_code(text, uuid, text)') IS NOT NULL
   AND NOT has_function_privilege('authenticated', 'public.redeem_oauth_code(text, uuid, text)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.redeem_oauth_code(text, uuid, text)', 'EXECUTE');
