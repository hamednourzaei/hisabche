-- ==============================================================================
-- docs/VERIFY-admin-core-monitoring-01.sql
--
-- Read-only. Run AFTER docs/admin-core-monitoring-01-migration.sql.
-- Every row must say `pass = true`.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ==============================================================================

WITH tables(name) AS (
    VALUES
        ('core_metrics_minute'),
        ('core_metrics_hour'),
        ('core_gauges_minute'),
        ('db_metrics_minute'),
        ('metric_alert_events')
),
checks (check_name, pass) AS (
    -- 1. Every new table exists.
    SELECT 'every core monitoring table exists',
           (SELECT count(*) FROM tables t
             WHERE to_regclass('public.' || t.name) IS NOT NULL) = (SELECT count(*) FROM tables)

    UNION ALL

    -- 2. RLS is on for every new table.
    SELECT 'row level security is enabled on every core table',
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

    -- 3. anon/authenticated hold no privilege on the new tables.
    SELECT 'anon/authenticated hold no core table privilege',
           NOT EXISTS (
               SELECT 1 FROM information_schema.role_table_grants g
                JOIN tables t ON t.name = g.table_name
                WHERE g.table_schema = 'public'
                  AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
           )

    UNION ALL

    -- 4. anon/authenticated cannot execute the core functions.
    SELECT 'anon/authenticated cannot execute the core functions',
           NOT EXISTS (
               SELECT 1
                 FROM information_schema.role_routine_grants r
                WHERE r.routine_schema = 'public'
                  AND r.routine_name IN (
                      'admin_core_monitor_rollup_hour',
                      'admin_core_monitor_prune',
                      'admin_core_monitor_snapshot',
                      'admin_core_monitor_series'
                  )
                  AND r.grantee IN ('anon', 'authenticated', 'PUBLIC')
           )

    UNION ALL

    -- 5. The four core functions exist.
    SELECT 'core rollup, prune, snapshot and series functions exist',
           to_regprocedure('public.admin_core_monitor_rollup_hour(timestamptz)') IS NOT NULL
           AND to_regprocedure('public.admin_core_monitor_prune(integer,integer)') IS NOT NULL
           AND to_regprocedure('public.admin_core_monitor_snapshot(timestamptz,timestamptz)') IS NOT NULL
           AND to_regprocedure('public.admin_core_monitor_series(text,timestamptz,text)') IS NOT NULL

    UNION ALL

    -- 6. The instance table gained rss_bytes and process_role.
    SELECT 'instance_metrics_minute has rss_bytes and process_role',
           EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'instance_metrics_minute'
                  AND column_name = 'rss_bytes'
           )
           AND EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'instance_metrics_minute'
                  AND column_name = 'process_role'
           )

    UNION ALL

    -- 7. Alert rules gained the core dimension and the wildcard default.
    SELECT 'metric_alert_rules has core_id, cooldown and the default core rule',
           EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'metric_alert_rules'
                  AND column_name = 'core_id'
           )
           AND EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'metric_alert_rules'
                  AND column_name = 'cooldown_minutes'
           )
           AND EXISTS (
               SELECT 1 FROM public.metric_alert_rules
                WHERE metric = 'core_pressure' AND core_id = '*'
           )

    UNION ALL

    -- 8. The six infrastructure rules survived the constraint swap.
    SELECT 'six infrastructure alert rules still present',
           (SELECT count(*) FROM public.metric_alert_rules
             WHERE core_id IS NULL AND metric IN (
                 'cpu_percent', 'memory_percent', 'event_loop_p99_ms',
                 'db_connections_percent', 'http_5xx_percent',
                 'replication_lag_seconds'
             )) = 6

    UNION ALL

    -- 9. Open-event dedup index exists (at most one open event per rule+core).
    SELECT 'open alert event dedup index exists',
           EXISTS (
               SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'metric_alert_events'
                  AND indexname = 'idx_metric_alert_events_open'
           )

    UNION ALL

    -- 10. No core metric table names a person, a workspace id or an address.
    SELECT 'no core metric table stores personal data',
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

    -- 11. The operation group enum is closed (no dynamic labels possible).
    SELECT 'operation_group check constraint is present on both core tables',
           EXISTS (
               SELECT 1 FROM pg_constraint
                WHERE conname = 'core_metrics_minute_operation_group_check'
           )
           AND EXISTS (
               SELECT 1 FROM pg_constraint
                WHERE conname = 'core_metrics_hour_operation_group_check'
           )
)
SELECT check_name, pass FROM checks ORDER BY check_name;

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. Diagnostic — current rows. Informational only.
--
--     SELECT 'core_metrics_minute' AS table_name, count(*) FROM public.core_metrics_minute
--     UNION ALL
--     SELECT 'core_metrics_hour', count(*) FROM public.core_metrics_hour
--     UNION ALL
--     SELECT 'core_gauges_minute', count(*) FROM public.core_gauges_minute
--     UNION ALL
--     SELECT 'db_metrics_minute', count(*) FROM public.db_metrics_minute
--     UNION ALL
--     SELECT 'metric_alert_events', count(*) FROM public.metric_alert_events;
-- ──────────────────────────────────────────────────────────────────────────────