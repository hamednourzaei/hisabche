-- ==============================================================================
-- docs/admin-monitoring-01-migration.sql
--
-- V63 · M-1 … M-7 — monitoring that is cheap to collect and honest about limits.
--
-- WHY POSTGRES AND NOT A TSDB
--   The owner runs one product on one database. Prometheus/Grafana/TimescaleDB
--   would be a second system to patch, back up and pay for, to answer questions
--   about a few dozen routes. Minute rollups in Postgres answer them, and they
--   survive a Redis outage.
--
-- WHAT
--   1. request_metrics_minute   one row per route template × minute × instance
--   2. instance_metrics_minute  CPU / RAM / event-loop / sockets per minute
--   3. active_users_minute      hashed user ids, unique per minute (dedupe)
--   4. request_metrics_hour     90-day rollup, written by the function below
--   5. metric_alert_rules       owner-editable thresholds + defaults
--   6. admin_wall_tokens        hashed, scoped, expiring TV tokens
--   7. functions                admin_monitor_rollup_hour, admin_monitor_prune,
--                               admin_db_vitals
--
-- ⚠️ NO PERSONAL DATA. The route is the Fastify TEMPLATE (`/api/invoices/:id`),
-- never the raw URL; users appear only as a SHA-256 hash; a workspace id never
-- appears at all.
--
-- SAFETY
--   - additive and idempotent (every CREATE is IF NOT EXISTS / OR REPLACE);
--   - retention defaults: 7 days of minutes, 90 days of hours;
--   - RLS enabled with no policy, and EXECUTE revoked from anon/authenticated.
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-admin-monitoring-01.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.admin_monitor_rollup_hour(timestamptz);
--   DROP FUNCTION IF EXISTS public.admin_monitor_prune(int, int);
--   DROP FUNCTION IF EXISTS public.admin_db_vitals();
--   DROP TABLE IF EXISTS public.metric_alert_rules;
--   DROP TABLE IF EXISTS public.admin_wall_tokens;
--   DROP TABLE IF EXISTS public.active_users_minute;
--   DROP TABLE IF EXISTS public.active_workspaces_minute;
--   DROP TABLE IF EXISTS public.request_metrics_hour;
--   DROP TABLE IF EXISTS public.request_metrics_minute;
--   DROP TABLE IF EXISTS public.instance_metrics_minute;
-- ==============================================================================

-- 1. Per-route traffic, one row per template × minute × instance.
CREATE TABLE IF NOT EXISTS public.request_metrics_minute (
    id BIGSERIAL PRIMARY KEY,
    minute TIMESTAMPTZ NOT NULL,
    instance_id TEXT NOT NULL,
    -- The Fastify route template. `(unmatched)` for a 404, never a raw URL.
    route TEXT NOT NULL,
    method TEXT NOT NULL,
    status_class TEXT NOT NULL CHECK (status_class IN ('1xx', '2xx', '3xx', '4xx', '5xx')),
    count INTEGER NOT NULL CHECK (count >= 0),
    -- ⚠️ NULLABLE on purpose. A compressed or streamed response has no
    -- content-length; recording `0` would claim «no bytes» about a transfer we
    -- did not measure. NULL means unknown, and the overview reports how many
    -- rows were unknown beside the total.
    bytes_out BIGINT CHECK (bytes_out IS NULL OR bytes_out >= 0),
    duration_sum_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_sum_ms >= 0),
    duration_max_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_max_ms >= 0),
    -- Fixed histogram: <50, <100, <250, <500, <1000, >=1000 ms.
    duration_buckets INTEGER[] NOT NULL DEFAULT ARRAY[0, 0, 0, 0, 0, 0],
    UNIQUE (minute, instance_id, route, method, status_class)
);

CREATE INDEX IF NOT EXISTS idx_request_metrics_minute_minute
    ON public.request_metrics_minute(minute DESC);
CREATE INDEX IF NOT EXISTS idx_request_metrics_minute_route
    ON public.request_metrics_minute(route, minute DESC);

-- 2. Instance vitals, one row per minute.
CREATE TABLE IF NOT EXISTS public.instance_metrics_minute (
    id BIGSERIAL PRIMARY KEY,
    minute TIMESTAMPTZ NOT NULL,
    instance_id TEXT NOT NULL,
    cpu_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    memory_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    event_loop_p99_ms NUMERIC(10, 2) NOT NULL DEFAULT 0,
    heap_used_bytes BIGINT NOT NULL DEFAULT 0,
    heap_total_bytes BIGINT NOT NULL DEFAULT 0,
    inflight_requests INTEGER NOT NULL DEFAULT 0,
    sync_sockets INTEGER NOT NULL DEFAULT 0,
    UNIQUE (minute, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_instance_metrics_minute_minute
    ON public.instance_metrics_minute(minute DESC);

-- 3. Online users. Only the hash — never an id, an email or a name.
CREATE TABLE IF NOT EXISTS public.active_users_minute (
    id BIGSERIAL PRIMARY KEY,
    minute TIMESTAMPTZ NOT NULL,
    user_hash TEXT NOT NULL,
    UNIQUE (minute, user_hash)
);

CREATE INDEX IF NOT EXISTS idx_active_users_minute_minute
    ON public.active_users_minute(minute DESC);

-- 3b. Active workspaces, also hashed. The wall shows «how many businesses are
--     using the product right now», never which ones.
CREATE TABLE IF NOT EXISTS public.active_workspaces_minute (
    id BIGSERIAL PRIMARY KEY,
    minute TIMESTAMPTZ NOT NULL,
    workspace_hash TEXT NOT NULL,
    UNIQUE (minute, workspace_hash)
);

CREATE INDEX IF NOT EXISTS idx_active_workspaces_minute_minute
    ON public.active_workspaces_minute(minute DESC);

-- 4. The 90-day rollup.
CREATE TABLE IF NOT EXISTS public.request_metrics_hour (
    id BIGSERIAL PRIMARY KEY,
    hour TIMESTAMPTZ NOT NULL,
    route TEXT NOT NULL,
    method TEXT NOT NULL,
    status_class TEXT NOT NULL CHECK (status_class IN ('1xx', '2xx', '3xx', '4xx', '5xx')),
    count BIGINT NOT NULL CHECK (count >= 0),
    bytes_out BIGINT,
    duration_sum_ms BIGINT NOT NULL DEFAULT 0,
    duration_max_ms INTEGER NOT NULL DEFAULT 0,
    slow_count BIGINT NOT NULL DEFAULT 0,
    UNIQUE (hour, route, method, status_class)
);

CREATE INDEX IF NOT EXISTS idx_request_metrics_hour_hour
    ON public.request_metrics_hour(hour DESC);

-- 5. Alert rules. The owner edits the numbers; the code names the metrics.
CREATE TABLE IF NOT EXISTS public.metric_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric TEXT NOT NULL UNIQUE CHECK (metric IN (
        'cpu_percent',
        'memory_percent',
        'event_loop_p99_ms',
        'db_connections_percent',
        'http_5xx_percent',
        'replication_lag_seconds'
    )),
    comparator TEXT NOT NULL CHECK (comparator IN ('>', '<')),
    threshold NUMERIC NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 5 CHECK (duration_minutes BETWEEN 1 AND 1440),
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.metric_alert_rules (metric, comparator, threshold, duration_minutes, severity)
VALUES
    ('cpu_percent', '>', 85, 5, 'warning'),
    ('memory_percent', '>', 85, 5, 'warning'),
    ('event_loop_p99_ms', '>', 200, 5, 'warning'),
    ('db_connections_percent', '>', 80, 5, 'critical'),
    ('http_5xx_percent', '>', 2, 5, 'critical'),
    ('replication_lag_seconds', '>', 30, 5, 'warning')
ON CONFLICT (metric) DO NOTHING;

-- 6. TV wall tokens. A television cannot hold an MFA session, so it holds a
--    hashed, scoped, expiring token instead. The value itself is shown once,
--    when it is created, and never stored.
CREATE TABLE IF NOT EXISTS public.admin_wall_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT '',
    -- Optional network binding; NULL means «any address that holds the token».
    ip_cidr TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_wall_tokens_expiry
    ON public.admin_wall_tokens(expires_at DESC);

-- 7a. Roll minute rows into the hour, idempotently. Safe to re-run: every
--     column is recomputed from the minutes of that hour.
CREATE OR REPLACE FUNCTION public.admin_monitor_rollup_hour(
    p_hour TIMESTAMPTZ DEFAULT date_trunc('hour', NOW() - INTERVAL '1 hour')
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_hour TIMESTAMPTZ := date_trunc('hour', p_hour);
    v_rows INTEGER := 0;
BEGIN
    INSERT INTO public.request_metrics_hour
        (hour, route, method, status_class, count, bytes_out,
         duration_sum_ms, duration_max_ms, slow_count)
    SELECT
        v_hour,
        route,
        method,
        status_class,
        SUM(count),
        SUM(bytes_out),
        SUM(duration_sum_ms),
        MAX(duration_max_ms),
        SUM(duration_buckets[6])
    FROM public.request_metrics_minute
    WHERE minute >= v_hour AND minute < v_hour + INTERVAL '1 hour'
    GROUP BY route, method, status_class
    ON CONFLICT (hour, route, method, status_class) DO UPDATE
       SET count = EXCLUDED.count,
           bytes_out = EXCLUDED.bytes_out,
           duration_sum_ms = EXCLUDED.duration_sum_ms,
           duration_max_ms = EXCLUDED.duration_max_ms,
           slow_count = EXCLUDED.slow_count;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

-- 7b. Retention. Deleting in one statement is fine at these volumes; the
--     caller runs it once per slot (distributed-work.ts), not per request.
CREATE OR REPLACE FUNCTION public.admin_monitor_prune(
    p_keep_minute_days INTEGER DEFAULT 7,
    p_keep_hour_days INTEGER DEFAULT 90
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_minutes INTEGER;
    v_hours INTEGER;
    v_users INTEGER;
BEGIN
    DELETE FROM public.request_metrics_minute
     WHERE minute < NOW() - make_interval(days => p_keep_minute_days);
    GET DIAGNOSTICS v_minutes = ROW_COUNT;

    DELETE FROM public.instance_metrics_minute
     WHERE minute < NOW() - make_interval(days => p_keep_minute_days);

    DELETE FROM public.active_users_minute
     WHERE minute < NOW() - make_interval(days => 1);

    DELETE FROM public.active_workspaces_minute
     WHERE minute < NOW() - make_interval(days => 1);

    DELETE FROM public.request_metrics_hour
     WHERE hour < NOW() - make_interval(days => p_keep_hour_days);
    GET DIAGNOSTICS v_hours = ROW_COUNT;

    DELETE FROM public.admin_wall_tokens
     WHERE expires_at < NOW() - INTERVAL '30 days'
       AND (revoked_at IS NOT NULL OR expires_at < NOW());

    SELECT count(*) INTO v_users FROM public.active_users_minute;

    RETURN jsonb_build_object(
        'minutesDeleted', v_minutes,
        'hoursDeleted', v_hours,
        'activeUserRowsKept', v_users
    );
END;
$$;

-- 7c. Database vitals. SECURITY DEFINER, read-only, service_role only.
--     A missing pg_stat_statements returns `statements: null` with a reason —
--     it never fails the whole page.
CREATE OR REPLACE FUNCTION public.admin_db_vitals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_size BIGINT;
    v_max INTEGER;
    v_active INTEGER;
    v_idle INTEGER;
    v_total INTEGER;
    v_hit NUMERIC;
    v_deadlocks BIGINT;
    v_temp_bytes BIGINT;
    v_waiting INTEGER;
    v_longest_tx NUMERIC;
    v_lag NUMERIC;
    v_statements JSONB := NULL;
    v_reason TEXT := NULL;
BEGIN
    SELECT pg_database_size(current_database()) INTO v_size;
    SELECT current_setting('max_connections')::INTEGER INTO v_max;

    SELECT
        count(*) FILTER (WHERE state = 'active'),
        count(*) FILTER (WHERE state = 'idle'),
        count(*)
      INTO v_active, v_idle, v_total
      FROM pg_stat_activity
     WHERE datname = current_database();

    SELECT
        COALESCE(SUM(blks_hit) * 1.0 / NULLIF(SUM(blks_hit + blks_read), 0), 0),
        COALESCE(SUM(deadlocks), 0),
        COALESCE(SUM(temp_bytes), 0)
      INTO v_hit, v_deadlocks, v_temp_bytes
      FROM pg_stat_database
     WHERE datname = current_database();

    SELECT count(*)::INTEGER INTO v_waiting
      FROM pg_locks
     WHERE NOT granted;

    SELECT COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - xact_start))), 0)
      INTO v_longest_tx
      FROM pg_stat_activity
     WHERE datname = current_database() AND xact_start IS NOT NULL;

    BEGIN
        SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())), NULL)
          INTO v_lag
          FROM pg_stat_replication
         LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_lag := NULL;
    END;

    IF to_regclass('public.pg_stat_statements') IS NOT NULL THEN
        BEGIN
            EXECUTE $q$
                SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb)
                  FROM (
                    SELECT calls,
                           ROUND(total_exec_time::numeric, 2) AS total_ms,
                           ROUND(mean_exec_time::numeric, 2) AS mean_ms,
                           rows,
                           left(query, 240) AS query
                      FROM public.pg_stat_statements
                     ORDER BY total_exec_time DESC
                     LIMIT 10
                  ) s
            $q$ INTO v_statements;
        EXCEPTION WHEN OTHERS THEN
            v_statements := NULL;
            v_reason := 'pg_stat_statements could not be read';
        END;
    ELSE
        v_reason := 'pg_stat_statements is not installed';
    END IF;

    RETURN jsonb_build_object(
        'database', jsonb_build_object('sizeBytes', v_size),
        'connections', jsonb_build_object(
            'active', v_active,
            'idle', v_idle,
            'total', v_total,
            'max', v_max
        ),
        'cache', jsonb_build_object('hitRatio', ROUND(v_hit, 4)),
        'locks', jsonb_build_object(
            'waiting', v_waiting,
            'longestTransactionSeconds', ROUND(v_longest_tx, 2)
        ),
        'replication', jsonb_build_object('lagSeconds', v_lag),
        'deadlocks', v_deadlocks,
        'tempBytes', v_temp_bytes,
        'statements', v_statements,
        'statementsUnavailableReason', v_reason
    );
END;
$$;

-- 7d. One-round-trip overview. Totals are SUMs over the window; only the
--     DISPLAY lists are limited to five rows. No capped read feeds a number.
CREATE OR REPLACE FUNCTION public.admin_monitor_overview(p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_requests BIGINT;
    v_errors BIGINT;
    v_bytes BIGINT;
    v_unknown BIGINT;
    v_users INTEGER;
    v_workspaces INTEGER;
    v_status JSONB;
    v_top_time JSONB;
    v_top_bytes JSONB;
    v_instances JSONB;
BEGIN
    SELECT
        COALESCE(SUM(count), 0),
        COALESCE(SUM(count) FILTER (WHERE status_class = '5xx'), 0),
        SUM(bytes_out),
        COUNT(*) FILTER (WHERE bytes_out IS NULL)
      INTO v_requests, v_errors, v_bytes, v_unknown
      FROM public.request_metrics_minute
     WHERE minute >= p_since;

    SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO v_status
      FROM (
        SELECT status_class, SUM(count)::BIGINT AS count
          FROM public.request_metrics_minute
         WHERE minute >= p_since
         GROUP BY status_class
         ORDER BY status_class
      ) s;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_time
      FROM (
        SELECT route,
               method,
               SUM(duration_sum_ms)::BIGINT AS total_ms,
               SUM(count)::BIGINT AS count,
               MAX(duration_max_ms)::INTEGER AS max_ms
          FROM public.request_metrics_minute
         WHERE minute >= p_since
         GROUP BY route, method
         ORDER BY total_ms DESC
         LIMIT 5
      ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(b)), '[]'::jsonb) INTO v_top_bytes
      FROM (
        SELECT route,
               method,
               SUM(bytes_out)::BIGINT AS bytes,
               SUM(count)::BIGINT AS count
          FROM public.request_metrics_minute
         WHERE minute >= p_since
         GROUP BY route, method
         ORDER BY bytes DESC NULLS LAST
         LIMIT 5
      ) b;

    SELECT COUNT(DISTINCT user_hash) INTO v_users
      FROM public.active_users_minute
     WHERE minute >= NOW() - INTERVAL '5 minutes';

    SELECT COUNT(DISTINCT workspace_hash) INTO v_workspaces
      FROM public.active_workspaces_minute
     WHERE minute >= NOW() - INTERVAL '5 minutes';

    SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) INTO v_instances
      FROM (
        SELECT DISTINCT ON (instance_id)
               instance_id,
               minute,
               cpu_percent,
               memory_percent,
               event_loop_p99_ms,
               heap_used_bytes,
               heap_total_bytes,
               inflight_requests,
               sync_sockets
          FROM public.instance_metrics_minute
         WHERE minute >= NOW() - INTERVAL '10 minutes'
         ORDER BY instance_id, minute DESC
      ) i;

    RETURN jsonb_build_object(
        'since', p_since,
        'requests', v_requests,
        'errors5xx', v_errors,
        'bytesOut', v_bytes,
        'bytesUnknownRows', v_unknown,
        'onlineUsers', v_users,
        'onlineWorkspaces', v_workspaces,
        'statusClasses', v_status,
        'topRoutesByTime', v_top_time,
        'topRoutesByBytes', v_top_bytes,
        'instances', v_instances
    );
END;
$$;

-- 7e. The history series. `p_unit` picks the table: minutes for a short window,
--     hourly rollups for a long one. Both are aggregates, never raw request rows.
CREATE OR REPLACE FUNCTION public.admin_monitor_series(
    p_since TIMESTAMPTZ,
    p_unit TEXT DEFAULT 'minute'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rows JSONB;
BEGIN
    IF p_unit = 'hour' THEN
        SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO v_rows
          FROM (
            SELECT date_trunc('hour', hour) AS bucket,
                   SUM(count)::BIGINT AS requests,
                   SUM(count) FILTER (WHERE status_class = '5xx')::BIGINT AS errors,
                   SUM(bytes_out)::BIGINT AS bytes,
                   ROUND(AVG(CASE WHEN count > 0
                                  THEN duration_sum_ms::NUMERIC / count END), 2) AS avg_ms
              FROM public.request_metrics_hour
             WHERE hour >= p_since
             GROUP BY 1
             ORDER BY 1
          ) s;
    ELSE
        SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO v_rows
          FROM (
            SELECT date_trunc('minute', minute) AS bucket,
                   SUM(count)::BIGINT AS requests,
                   SUM(count) FILTER (WHERE status_class = '5xx')::BIGINT AS errors,
                   SUM(bytes_out)::BIGINT AS bytes,
                   ROUND(AVG(CASE WHEN count > 0
                                  THEN duration_sum_ms::NUMERIC / count END), 2) AS avg_ms
              FROM public.request_metrics_minute
             WHERE minute >= p_since
             GROUP BY 1
             ORDER BY 1
          ) s;
    END IF;

    RETURN v_rows;
END;
$$;

-- 8. Lock every table down, then grant the one role that needs it.
ALTER TABLE public.request_metrics_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_metrics_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_users_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_workspaces_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_metrics_hour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_wall_tokens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'request_metrics_minute',
        'instance_metrics_minute',
        'active_users_minute',
        'active_workspaces_minute',
        'request_metrics_hour',
        'metric_alert_rules',
        'admin_wall_tokens'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
        END IF;
        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
        END IF;
    END LOOP;

    -- BIGSERIAL sequences need their own grant for service_role inserts.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.admin_monitor_rollup_hour(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_monitor_prune(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_db_vitals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_monitor_overview(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_monitor_series(timestamptz, text) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.admin_monitor_rollup_hour(timestamptz) FROM anon;
        REVOKE ALL ON FUNCTION public.admin_monitor_prune(integer, integer) FROM anon;
        REVOKE ALL ON FUNCTION public.admin_db_vitals() FROM anon;
        REVOKE ALL ON FUNCTION public.admin_monitor_overview(timestamptz) FROM anon;
        REVOKE ALL ON FUNCTION public.admin_monitor_series(timestamptz, text) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.admin_monitor_rollup_hour(timestamptz) FROM authenticated;
        REVOKE ALL ON FUNCTION public.admin_monitor_prune(integer, integer) FROM authenticated;
        REVOKE ALL ON FUNCTION public.admin_db_vitals() FROM authenticated;
        REVOKE ALL ON FUNCTION public.admin_monitor_overview(timestamptz) FROM authenticated;
        REVOKE ALL ON FUNCTION public.admin_monitor_series(timestamptz, text) FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.admin_monitor_rollup_hour(timestamptz) TO service_role;
        GRANT EXECUTE ON FUNCTION public.admin_monitor_prune(integer, integer) TO service_role;
        GRANT EXECUTE ON FUNCTION public.admin_db_vitals() TO service_role;
        GRANT EXECUTE ON FUNCTION public.admin_monitor_overview(timestamptz) TO service_role;
        GRANT EXECUTE ON FUNCTION public.admin_monitor_series(timestamptz, text) TO service_role;
    END IF;
END $$;
