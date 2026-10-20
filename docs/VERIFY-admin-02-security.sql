-- ============================================================================
-- VERIFICATION FOR docs/admin-02-security-migration.sql
--
-- Run in SQL editor after admin-02-security-migration.sql.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT 'admin_accounts table exists and has RLS' AS check,
       to_regclass('public.admin_accounts') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_accounts'::regclass) AS ok
UNION ALL
SELECT 'admin_permissions table exists and has RLS',
       to_regclass('public.admin_permissions') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_permissions'::regclass)
UNION ALL
SELECT 'admin_security_events table exists and has RLS',
       to_regclass('public.admin_security_events') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_security_events'::regclass)
UNION ALL
SELECT 'audit_logs has reason, request_id, correlation_id',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'reason')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'request_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'correlation_id')
UNION ALL
SELECT 'audit_logs immutable trigger exists',
       EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid = 'public.audit_logs'::regclass
           AND tgname = 'audit_logs_immutable_trigger'
       )
UNION ALL
SELECT 'clients cannot access admin tables',
       NOT has_table_privilege('authenticated', 'public.admin_accounts', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.admin_permissions', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.admin_security_events', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.admin_accounts', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.admin_permissions', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.admin_security_events', 'SELECT')
UNION ALL
SELECT 'admin_permissions seeded with 7 roles',
       (SELECT count(DISTINCT role) FROM public.admin_permissions) = 7;
