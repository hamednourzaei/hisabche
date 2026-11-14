-- ==============================================================================
-- docs/VERIFY-admin-monitoring-01.sql
--
-- Read-only. Run AFTER docs/admin-monitoring-01-migration.sql.
-- Every row must say `pass = true`.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ==============================================================================

WITH tables(name) AS (
    VALUES
        ('request_metrics_minute'),
        ('instance_metrics_minute'),
        ('active_users_minute'),
        ('active_workspaces_minute'),
        ('request_metrics_hour'),
        ('metric_alert_rules'),
        ('admin_wall_tokens')
),
checks (check_name, pass) AS (
    -- 1. Every table exists.
    SELECT 'every monitoring table exists',
           (SELECT count(*) FROM tables t
             WHERE to_regclass('public.' || t.name) IS NOT NULL) = (SELECT count(*) FROM tables)

    UNION ALL

    -- 2. RLS is on for every table.
    SELECT 'row level security is enabled on every table',
           NOT EXISTS (
               SELECT 1 FROM tables t
                WHERE NOT COALESCE((
                    SELECT c.relrowsecurity
                      FROM pg_class c
                      JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND c.relname = t.name
                ), false)
           )

    UNION ALL

    -- 3. anon/authenticated hold no table privilege.
    SELECT 'anon/authenticated hold no table privilege',
           NOT EXISTS (
               SELECT 1 FROM information_schema.role_table_grants g
                JOIN tables t ON t.name = g.table_name
                WHERE g.table_schema = 'public'
                  AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
           )

    UNION ALL

    -- 4. anon/authenticated cannot execute the monitoring functions.
    SELECT 'anon/authenticated cannot execute the monitoring functions',
           NOT EXISTS (
               SELECT 1
                 FROM information_schema.role_routine_grants r
                WHERE r.routine_schema = 'public'
                  AND r.routine_name IN (
                      'admin_monitor_rollup_hour',
                      'admin_monitor_prune',
                      'admin_db_vitals',
                      'admin_monitor_overview',
                      'admin_monitor_series'
                  )
                  AND r.grantee IN ('anon', 'authenticated', 'PUBLIC')
           )

    UNION ALL

    -- 5. The six default alert rules are present.
    SELECT 'six default alert rules are seeded',
           (SELECT count(*) FROM public.metric_alert_rules
             WHERE metric IN (
                 'cpu_percent', 'memory_percent', 'event_loop_p99_ms',
                 'db_connections_percent', 'http_5xx_percent',
                 'replication_lag_seconds'
             )) = 6

    UNION ALL

    -- 6. No metric table names a person, a workspace id or an address.
    SELECT 'no metric table stores personal data',
           NOT EXISTS (
               SELECT 1
                 FROM information_schema.columns c
                 JOIN tables t ON t.name = c.table_name
                WHERE c.table_schema = 'public'
                  AND c.column_name IN (
                      'user_id', 'workspace_id', 'email', 'ip', 'ip_address',
                      'user_agent', 'customer_id', 'admin_email', 'url', 'query'
                  )
           )

    UNION ALL

    -- 7. The overview and series functions exist.
    SELECT 'overview, series and db vitals functions exist',
           to_regprocedure('public.admin_monitor_overview(timestamptz)') IS NOT NULL
           AND to_regprocedure('public.admin_monitor_series(timestamptz,text)') IS NOT NULL
           AND to_regprocedure('public.admin_db_vitals()') IS NOT NULL
)
SELECT check_name, pass FROM checks ORDER BY check_name;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Diagnostic — current rows. Informational only.
--
--     SELECT 'request_metrics_minute' AS table_name, count(*) FROM public.request_metrics_minute
--     UNION ALL
--     SELECT 'instance_metrics_minute', count(*) FROM public.instance_metrics_minute
--     UNION ALL
--     SELECT 'active_users_minute', count(*) FROM public.active_users_minute
--     UNION ALL
--     SELECT 'active_workspaces_minute', count(*) FROM public.active_workspaces_minute
--     UNION ALL
--     SELECT 'request_metrics_hour', count(*) FROM public.request_metrics_hour;
-- ──────────────────────────────────────────────────────────────────────────────
