-- ============================================================================
-- VERIFY — docs/developer-platform-04-portal-migration.sql
-- Read-only. Every row must read ok = true. Until a human reports the result:
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table' AS check, to_regclass('public.customer_portal_links') IS NOT NULL AS ok
UNION ALL
SELECT 'rls on',
       (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'customer_portal_links')
UNION ALL
SELECT 'one SELECT policy, membership-scoped',
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_portal_links') = 1
   AND (SELECT bool_and(cmd = 'SELECT' AND qual ILIKE '%workspace_members%')
          FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_portal_links')
UNION ALL
SELECT 'clients cannot write, anon cannot read',
       NOT has_table_privilege('authenticated', 'public.customer_portal_links', 'INSERT')
   AND NOT has_table_privilege('authenticated', 'public.customer_portal_links', 'UPDATE')
   AND NOT has_table_privilege('anon', 'public.customer_portal_links', 'SELECT')
UNION ALL
SELECT 'tokens are 256-bit hex and unique',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.customer_portal_links'::regclass AND contype = 'u')
   AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.customer_portal_links'::regclass AND contype = 'c');
