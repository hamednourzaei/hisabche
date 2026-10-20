-- ============================================================================
-- VERIFICATION FOR docs/entitlement-01-migration.sql
--
-- ⚠️ PREREQUISITE: docs/plan-limits-migration.sql MUST BE RUN BEFORE THIS MIGRATION.
--   If plan-limits-migration.sql has not run, plan_limit_settings does not exist,
--   and check 1 below will fail.
--
-- Run in the SQL editor after entitlement-01-migration.sql. Every row: ok = true.
-- ============================================================================

SELECT 'plan_limit_settings accepts FREE' AS check,
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.plan_limit_settings'::regclass
           AND pg_get_constraintdef(oid) LIKE '%ONLINE_500%'
       ) AS ok
UNION ALL
SELECT 'subscription_upgrade_requests accepts ONLINE_500',
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.subscription_upgrade_requests'::regclass
           AND pg_get_constraintdef(oid) LIKE '%ONLINE_500%'
       )
UNION ALL
SELECT 'subscription_events accepts licence_issued',
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.subscription_events'::regclass
           AND pg_get_constraintdef(oid) LIKE '%licence_issued%'
       )
UNION ALL
SELECT 'offline_licenses table exists and has RLS',
       to_regclass('public.offline_licenses') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.offline_licenses'::regclass)
UNION ALL
SELECT 'devices table exists and has RLS',
       to_regclass('public.devices') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.devices'::regclass)
UNION ALL
SELECT 'clients cannot write to offline_licenses or devices',
       NOT has_table_privilege('authenticated', 'public.offline_licenses', 'INSERT')
       AND NOT has_table_privilege('authenticated', 'public.devices', 'INSERT')
       AND NOT has_table_privilege('anon', 'public.offline_licenses', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.devices', 'SELECT');
