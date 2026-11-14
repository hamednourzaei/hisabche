-- ==============================================================================
-- docs/VERIFY-admin-ip-allowlist-01.sql
--
-- Read-only. Run AFTER docs/admin-ip-allowlist-01-migration.sql.
-- Every row must say `pass = true`.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ==============================================================================

WITH checks (check_name, pass) AS (
    -- 1. The table exists.
    SELECT 'admin_ip_allowlist exists',
           to_regclass('public.admin_ip_allowlist') IS NOT NULL

    UNION ALL

    -- 2. RLS is on: a leaked anon/authenticated grant cannot read rows.
    SELECT 'row level security is enabled',
           COALESCE((
               SELECT c.relrowsecurity
                 FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'admin_ip_allowlist'
           ), false)

    UNION ALL

    -- 3. anon and authenticated hold nothing.
    SELECT 'anon/authenticated hold no privilege',
           NOT EXISTS (
               SELECT 1
                 FROM information_schema.role_table_grants g
                WHERE g.table_schema = 'public'
                  AND g.table_name = 'admin_ip_allowlist'
                  AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
           )

    UNION ALL

    -- 4. service_role can read and write.
    SELECT 'service_role can read and write',
           EXISTS (
               SELECT 1 FROM information_schema.role_table_grants g
                WHERE g.table_schema = 'public'
                  AND g.table_name = 'admin_ip_allowlist'
                  AND g.grantee = 'service_role'
                  AND g.privilege_type = 'SELECT'
           )
           AND EXISTS (
               SELECT 1 FROM information_schema.role_table_grants g
                WHERE g.table_schema = 'public'
                  AND g.table_name = 'admin_ip_allowlist'
                  AND g.grantee = 'service_role'
                  AND g.privilege_type = 'INSERT'
           )

    UNION ALL

    -- 5. The duplicate guard is in place.
    SELECT 'unique index on cidr exists',
           EXISTS (
               SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'admin_ip_allowlist'
                  AND indexname = 'ux_admin_ip_allowlist_cidr'
           )
)
SELECT check_name, pass FROM checks ORDER BY check_name;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Diagnostic — who is allow-listed right now. Informational only.
--
--     SELECT cidr, label, created_by, created_at
--       FROM public.admin_ip_allowlist
--      ORDER BY created_at DESC;
--
--     An empty result means the feature is OFF, not that the migration failed.
-- ──────────────────────────────────────────────────────────────────────────────
