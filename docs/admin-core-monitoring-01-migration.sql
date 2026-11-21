-- ==============================================================================
-- docs/admin-core-monitoring-01-migration.sql
--
-- Unified Core Observability (21 Nov 2026) — the core dimension of monitoring.
-- Extends admin-monitoring-01; it does NOT replace it. One collector
-- (route-metrics.ts) writes these tables in the SAME once-per-minute flush.
--
-- WHAT
--   1. core_metrics_minute    one row per core × operation group × minute × instance
--   2. core_metrics_hour      90-day rollup of the above (histograms merged)
--   3. core_gauges_minute     job-queue gauges per core per minute (exact counts)
--   4. db_metrics_minute      database vitals sampled once per closed minute
--   5. instance_metrics_minute  + rss_bytes, process_role (additive columns)
--   6. metric_alert_rules     + core_id, cooldown_minutes, core metric names
--   7. metric_alert_events    raised/resolved history with evidence; DB-level
--                             dedup: at most ONE open event per (rule, core)
--   8. functions              admin_core_monitor_rollup_hour,
--                             admin_core_monitor_prune,
--                             admin_core_monitor_snapshot,
--                             admin_core_monitor_series
--
-- ⚠️ NO PERSONAL DATA. core_id and operation_group are closed enums from
-- backend/src/services/monitoring/core-registry.ts. No user id, workspace id,
-- URL, email, IP or SQL text is stored here.
--
-- NULL MEANS UNKNOWN. Every gauge column is nullable on purpose: a failed or
-- missing measurement is NULL (UNKNOWN in the UI), never a fabricated zero.
--
-- SAFETY
--   - additive and idempotent (IF NOT EXISTS / OR REPLACE / guarded ALTERs);
--   - retention: 7 days of minutes, 90 days of hours (same as monitoring-01);
--   - RLS enabled with no policy; EXECUTE revoked from anon/authenticated;
--   - requires PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT).
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-admin-core-monitoring-01.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK (drops only what THIS migration added; monitoring-01 stays intact)
--   DROP FUNCTION IF EXISTS public.admin_core_monitor_series(text, timestamptz, text);
--   DROP FUNCTION IF EXISTS public.admin_core_monitor_snapshot(timestamptz, timestamptz);
--   DROP FUNCTION IF EXISTS public.admin_core_monitor_prune(int, int);
--   DROP FUNCTION IF EXISTS public.admin_core_monitor_rollup_hour(timestamptz);
--   DROP TABLE IF EXISTS public.metric_alert_events;
--   DROP TABLE IF EXISTS public.db_metrics_minute;
--   DROP TABLE IF EXISTS public.core_gauges_minute;
--   DROP TABLE IF EXISTS public.core_metrics_hour;
--   DROP TABLE IF EXISTS public.core_metrics_minute;
--   ALTER TABLE public.metric_alert_rules DROP CONSTRAINT IF EXISTS metric_alert_rules_metric_core_key;
--   ALTER TABLE public.metric_alert_rules DROP COLUMN IF EXISTS core_id;
--   ALTER TABLE public.metric_alert_rules DROP COLUMN IF EXISTS cooldown_minutes;
--   -- restore the original metric CHECK + UNIQUE(metric) from monitoring-01
--   ALTER TABLE public.instance_metrics_minute DROP COLUMN IF EXISTS process_role;
--   ALTER TABLE public.instance_metrics_minute DROP COLUMN IF EXISTS rss_bytes;
-- ==============================================================================

-- 1. Core operations, one row per core × group × minute × instance.
CREATE TABLE IF NOT EXISTS public.core_metrics_minute (
    id BIGSERIAL PRIMARY KEY,
    minute TIMESTAMPTZ NOT NULL,
    instance_id TEXT NOT NULL,
    process_role TEXT NOT NULL DEFAULT 'all' CHECK (process_role IN ('api', 'worker', 'all')),
    core_id TEXT NOT NULL,
    operation_group TEXT NOT NULL CHECK (operation_group IN (
        'read', 'create', 'update', 'delete', 'action', 'other'
    )),
    operation_count INTEGER NOT NULL DEFAULT 0 CHECK (operation_count >= 0),
    success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
    error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
    client_error_count INTEGER NOT NULL DEFAULT 0 CHECK (client_error_count >= 0),
    duration_sum_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_sum_ms >= 0),
    duration_max_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_max_ms >= 0),
    -- Fixed histogram: <50, <100, <250, <500, <1000, >=1000 ms.
    duration_buckets INTEGER[] NOT NULL DEFAULT ARRAY[0, 0, 0, 0, 0, 0],
    inflight_max INTEGER NOT NULL DEFAULT 0 CHECK (inflight_max >= 0),
    concurrency_max INTEGER NOT NULL DEFAULT 0 CHECK (concurrency_max >= 0),
    timeout_count INTEGER NOT NULL DEFAULT 0 CHECK (timeout_count >= 0),
    -- NULL when no operation in the minute carried a measured dependency wait.
    dependency_wait_total_ms BIGINT CHECK (dependency_wait_total_ms IS NULL OR dependency_wait_total_ms >= 0),
    dependency_measured_count INTEGER NOT NULL DEFAULT 0 CHECK (dependency_measured_count >= 0),
    UNIQUE (minute, instance_id, core_id, operation_group)
);

CREATE INDEX IF NOT EXISTS idx_core_metrics_minute_minute
    ON public.core_metrics_minute(minute DESC);
CREATE INDEX IF NOT EXISTS idx_core_metrics_minute_core
    ON public.core_metrics_minute(core_id, minute DESC);

-- 2. The 90-day core rollup. Histograms merge element-wise; gauges roll up as
--    the hour's MAX queue depth (a gauge is a moment, its hour summary is a max).
CREATE TABLE IF NOT EXISTS public.core_metrics_hour (
    id BIGSERIAL PRIMARY KEY,
    hour TIMESTAMPTZ NOT NULL,
    instance_id TEXT NOT NULL,
    core_id TEXT NOT NULL,
    operation_group TEXT NOT NULL CHECK (operation_group IN (
        'read', 'create', 'update', 'delete', 'action', 'other'
    )),
    operation_count BIGINT NOT NULL DEFAULT 0 CHECK (operation_count >= 0),
    success_count BIGINT NOT NULL DEFAULT 0 CHECK (success_count >= 0),
    error_count BIGINT NOT NULL DEFAULT 0 CHECK (error_count >= 0),
    client_error_count BIGINT NOT NULL DEFAULT 0 CHECK (client_error_count >= 0),
    duration_sum_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_sum_ms >= 0),
    duration_max_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_max_ms >= 0),
    duration_buckets INTEGER[] NOT NULL DEFAULT ARRAY[0, 0, 0, 0, 0, 0],
    inflight_max INTEGER NOT NULL DEFAULT 0 CHECK (inflight_max >= 0),
    concurrency_max INTEGER NOT NULL DEFAULT 0 CHECK (concurrency_max >= 0),
    timeout_count BIGINT NOT NULL DEFAULT 0 CHECK (timeout_count >= 0),
    dependency_wait_total_ms BIGINT,
    dependency_measured_count BIGINT NOT NULL DEFAULT 0,
    queue_depth_max INTEGER,
    UNIQUE (hour, instance_id, core_id, operation_group)
);

CREATE INDEX IF NOT EXISTS idx_core_metrics_hour_hour
    ON public.core_metrics_hour(hour DESC);
CREATE INDEX IF NOT EXISTS idx_core_metrics_hour_core
    ON public.core_metrics_hour(core_id, hour DESC);

-- 3. Core gauges (job queue today). One row per core × minute × instance.
CREATE TABLE IF NOT EXISTS public.core_gauges_minute (
    id BIGSERIAL PRIMARY KEY,
    minute TIMESTAMPTZ NOT NULL,
    instance_id TEXT NOT NULL,
    core_id TEXT NOT NULL,
    queue_depth INTEGER CHECK (queue_depth IS NULL OR queue_depth >= 0),
    processing_count INTEGER CHECK (processing_count IS NULL OR processing_count >= 0),
    stuck_count INTEGER CHECK (stuck_count IS NULL OR stuck_count >= 0),
    retry_count INTEGER CHECK (retry_count IS NULL OR retry_count >= 0),
    queue_wait_total_ms BIGINT CHECK (queue_wait_total_ms IS NULL OR queue_wait_total_ms >= 0),
    UNIQUE (minute, instance_id, core_id)
);

CREATE INDEX IF NOT EXISTS idx_core_gauges_minute_minute
    ON public.core_gauges_minute(minute DESC);

-- 4. Database vitals history — the same numbers admin_db_vitals() reports live,
--    kept once per closed minute so «waiting locks at 03:00» is answerable.
CREATE TABLE IF NOT EXISTS public.db_metrics_minute (
    id BIGSERIAL PRIMARY KEY,
    minute TIMESTAMPTZ NOT NULL,
    instance_id TEXT NOT NULL,
    connections_active INTEGER,
    connections_idle INTEGER,
    connections_total INTEGER,
    connections_max INTEGER,
    waiting_locks INTEGER,
    cache_hit_ratio NUMERIC(6, 4),
    longest_transaction_seconds NUMERIC(12, 2),
    database_size_bytes BIGINT,
    UNIQUE (minute, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_db_metrics_minute_minute
    ON public.db_metrics_minute(minute DESC);

-- 5. Instance table: the collector already samples RSS and knows its role.
ALTER TABLE public.instance_metrics_minute
    ADD COLUMN IF NOT EXISTS rss_bytes BIGINT;
ALTER TABLE public.instance_metrics_minute
    ADD COLUMN IF NOT EXISTS process_role TEXT NOT NULL DEFAULT 'all';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'instance_metrics_minute_process_role_check'
    ) THEN
        ALTER TABLE public.instance_metrics_minute
            ADD CONSTRAINT instance_metrics_minute_process_role_check
            CHECK (process_role IN ('api', 'worker', 'all'));
    END IF;
END $$;

-- 6. Alert rules gain the core dimension. core_id NULL = infrastructure rule
--    (the six monitoring-01 metrics); '*' = template applied to EVERY core;
--    a concrete core id = per-core override (evaluator: specific wins).
ALTER TABLE public.metric_alert_rules
    ADD COLUMN IF NOT EXISTS core_id TEXT;
ALTER TABLE public.metric_alert_rules
    ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER NOT NULL DEFAULT 60;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'metric_alert_rules_cooldown_minutes_check'
    ) THEN
        ALTER TABLE public.metric_alert_rules
            ADD CONSTRAINT metric_alert_rules_cooldown_minutes_check
            CHECK (cooldown_minutes BETWEEN 1 AND 1440);
    END IF;

    -- Replace the closed metric list with the extended one (infra + core).
    ALTER TABLE public.metric_alert_rules
        DROP CONSTRAINT IF EXISTS metric_alert_rules_metric_check;
    ALTER TABLE public.metric_alert_rules
        ADD CONSTRAINT metric_alert_rules_metric_check CHECK (metric IN (
            'cpu_percent',
            'memory_percent',
            'event_loop_p99_ms',
            'db_connections_percent',
            'http_5xx_percent',
            'replication_lag_seconds',
            'core_pressure',
            'core_p95_ms',
            'core_error_percent',
            'core_queue_depth'
        ));

    -- One rule per (metric, core). NULLS NOT DISTINCT keeps the six infra
    -- rules unique with core_id NULL (PostgreSQL 15+).
    ALTER TABLE public.metric_alert_rules
        DROP CONSTRAINT IF EXISTS metric_alert_rules_metric_key;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'metric_alert_rules_metric_core_key'
    ) THEN
        ALTER TABLE public.metric_alert_rules
            ADD CONSTRAINT metric_alert_rules_metric_core_key
            UNIQUE NULLS NOT DISTINCT (metric, core_id);
    END IF;
END $$;

-- The default core rule: pressure ≥ 70 (the documented critical threshold)
-- sustained 5 minutes, evaluated for every core. The owner can add per-core
-- overrides or disable it; nothing here is hidden.
INSERT INTO public.metric_alert_rules (metric, core_id, comparator, threshold, duration_minutes, severity)
VALUES ('core_pressure', '*', '>', 70, 5, 'critical')
ON CONFLICT ON CONSTRAINT metric_alert_rules_metric_core_key DO NOTHING;

-- 7. Alert events — the history the mission asks for. At most ONE open event
--    per (rule, core): the partial unique index IS the deduplication, so two
--    concurrent evaluators cannot raise the same alert twice.
CREATE TABLE IF NOT EXISTS public.metric_alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.metric_alert_rules(id) ON DELETE CASCADE,
    -- The concrete core this event is about ('' for infrastructure rules).
    core_id TEXT NOT NULL DEFAULT '',
    metric TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    value NUMERIC,
    threshold NUMERIC NOT NULL,
    -- Sanitized evidence: which pressure component breached, its normalized
    -- value and note. Never a stack trace, never a user identifier.
    evidence JSONB,
    raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_alert_events_open
    ON public.metric_alert_events(rule_id, core_id)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_metric_alert_events_raised
    ON public.metric_alert_events(raised_at DESC);

-- 8a. Roll the closed hour into core_metrics_hour, idempotently.
CREATE OR REPLACE FUNCTION public.admin_core_monitor_rollup_hour(
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
    INSERT INTO public.core_metrics_hour
        (hour, instance_id, core_id, operation_group,
         operation_count, success_count, error_count, client_error_count,
         duration_sum_ms, duration_max_ms, duration_buckets,
         inflight_max, concurrency_max, timeout_count,
         dependency_wait_total_ms, dependency_measured_count, queue_depth_max)
    SELECT
        v_hour,
        m.instance_id,
        m.core_id,
        m.operation_group,
        SUM(m.operation_count),
        SUM(m.success_count),
        SUM(m.error_count),
        SUM(m.client_error_count),
        SUM(m.duration_sum_ms),
        MAX(m.duration_max_ms),
        ARRAY[
            SUM(m.duration_buckets[1]), SUM(m.duration_buckets[2]),
            SUM(m.duration_buckets[3]), SUM(m.duration_buckets[4]),
            SUM(m.duration_buckets[5]), SUM(m.duration_buckets[6])
        ]::INTEGER[],
        MAX(m.inflight_max),
        MAX(m.concurrency_max),
        SUM(m.timeout_count),
        SUM(m.dependency_wait_total_ms),
        SUM(m.dependency_measured_count),
        MAX(g.queue_depth)
    FROM public.core_metrics_minute m
    LEFT JOIN public.core_gauges_minute g
        ON g.minute = m.minute AND g.instance_id = m.instance_id AND g.core_id = m.core_id
    WHERE m.minute >= v_hour AND m.minute < v_hour + INTERVAL '1 hour'
    GROUP BY m.instance_id, m.core_id, m.operation_group
    ON CONFLICT (hour, instance_id, core_id, operation_group) DO UPDATE
       SET operation_count = EXCLUDED.operation_count,
           success_count = EXCLUDED.success_count,
           error_count = EXCLUDED.error_count,
           client_error_count = EXCLUDED.client_error_count,
           duration_sum_ms = EXCLUDED.duration_sum_ms,
           duration_max_ms = EXCLUDED.duration_max_ms,
           duration_buckets = EXCLUDED.duration_buckets,
           inflight_max = EXCLUDED.inflight_max,
           concurrency_max = EXCLUDED.concurrency_max,
           timeout_count = EXCLUDED.timeout_count,
           dependency_wait_total_ms = EXCLUDED.dependency_wait_total_ms,
           dependency_measured_count = EXCLUDED.dependency_measured_count,
           queue_depth_max = EXCLUDED.queue_depth_max;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

-- 8b. Retention for the core tables (same 7d/90d contract as monitoring-01).
CREATE OR REPLACE FUNCTION public.admin_core_monitor_prune(
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
    v_events INTEGER;
BEGIN
    DELETE FROM public.core_metrics_minute
     WHERE minute < NOW() - make_interval(days => p_keep_minute_days);
    GET DIAGNOSTICS v_minutes = ROW_COUNT;

    DELETE FROM public.core_gauges_minute
     WHERE minute < NOW() - make_interval(days => p_keep_minute_days);

    DELETE FROM public.db_metrics_minute
     WHERE minute < NOW() - make_interval(days => p_keep_minute_days);

    DELETE FROM public.core_metrics_hour
     WHERE hour < NOW() - make_interval(days => p_keep_hour_days);
    GET DIAGNOSTICS v_hours = ROW_COUNT;

    -- Resolved alert history keeps 90 days; open events are never pruned.
    DELETE FROM public.metric_alert_events
     WHERE resolved_at IS NOT NULL
       AND resolved_at < NOW() - make_interval(days => p_keep_hour_days);
    GET DIAGNOSTICS v_events = ROW_COUNT;

    RETURN jsonb_build_object(
        'coreMinutesDeleted', v_minutes,
        'coreHoursDeleted', v_hours,
        'resolvedEventsDeleted', v_events
    );
END;
$$;

-- 8c. One-round-trip core snapshot: per-core window aggregates (SUMs, never a
--     capped list), the latest gauge per core, every instance seen in 24 h
--     (offline ones included — last_seen tells the truth), latest DB vitals.
--     p_until bounds the window so the caller can also read the PREVIOUS
--     window and show a pressure trend without a second query shape.
CREATE OR REPLACE FUNCTION public.admin_core_monitor_snapshot(
    p_since TIMESTAMPTZ,
    p_until TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cores JSONB;
    v_gauges JSONB;
    v_instances JSONB;
    v_db JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) INTO v_cores
      FROM (
        SELECT core_id,
               SUM(operation_count)::BIGINT AS operations,
               SUM(success_count)::BIGINT AS success,
               SUM(error_count)::BIGINT AS errors,
               SUM(client_error_count)::BIGINT AS client_errors,
               SUM(duration_sum_ms)::BIGINT AS duration_sum_ms,
               MAX(duration_max_ms)::INTEGER AS duration_max_ms,
               ARRAY[
                   SUM(duration_buckets[1]), SUM(duration_buckets[2]),
                   SUM(duration_buckets[3]), SUM(duration_buckets[4]),
                   SUM(duration_buckets[5]), SUM(duration_buckets[6])
               ]::INTEGER[] AS duration_buckets,
               MAX(inflight_max)::INTEGER AS inflight_max,
               MAX(concurrency_max)::INTEGER AS concurrency_max,
               SUM(timeout_count)::BIGINT AS timeouts,
               SUM(dependency_wait_total_ms)::BIGINT AS dependency_wait_total_ms,
               SUM(dependency_measured_count)::BIGINT AS dependency_measured_count,
               MAX(minute) AS last_minute
          FROM public.core_metrics_minute
         WHERE minute >= p_since AND minute < p_until
         GROUP BY core_id
      ) c;

    SELECT COALESCE(jsonb_agg(row_to_json(g)), '[]'::jsonb) INTO v_gauges
      FROM (
        SELECT DISTINCT ON (core_id)
               core_id, minute, queue_depth, processing_count,
               stuck_count, retry_count, queue_wait_total_ms
          FROM public.core_gauges_minute
         WHERE minute >= p_since AND minute < p_until
         ORDER BY core_id, minute DESC
      ) g;

    -- 24 h lookback: an instance that died keeps its last row and is shown
    -- OFFLINE by the caller (last_seen older than the flush cadence).
    SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) INTO v_instances
      FROM (
        SELECT DISTINCT ON (instance_id)
               instance_id, minute AS last_seen, process_role,
               cpu_percent, memory_percent, event_loop_p99_ms,
               heap_used_bytes, heap_total_bytes, rss_bytes,
               inflight_requests, sync_sockets
          FROM public.instance_metrics_minute
         WHERE minute >= NOW() - INTERVAL '24 hours'
         ORDER BY instance_id, minute DESC
      ) i;

    SELECT row_to_json(d) INTO v_db
      FROM (
        SELECT * FROM public.db_metrics_minute
         ORDER BY minute DESC LIMIT 1
      ) d;

    RETURN jsonb_build_object(
        'since', p_since,
        'cores', v_cores,
        'gauges', v_gauges,
        'instances', v_instances,
        'db', COALESCE(v_db, 'null'::jsonb)
    );
END;
$$;

-- 8d. Per-core history. minute unit reads minutes + gauges; hour unit reads the
--     rollup. Gaps stay gaps: a bucket with no row is absent, never zero-filled.
CREATE OR REPLACE FUNCTION public.admin_core_monitor_series(
    p_core_id TEXT,
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
                   SUM(operation_count)::BIGINT AS operations,
                   SUM(error_count)::BIGINT AS errors,
                   SUM(client_error_count)::BIGINT AS client_errors,
                   ROUND(AVG(CASE WHEN operation_count > 0
                                  THEN duration_sum_ms::NUMERIC / operation_count END), 2) AS avg_ms,
                   ARRAY[
                       SUM(duration_buckets[1]), SUM(duration_buckets[2]),
                       SUM(duration_buckets[3]), SUM(duration_buckets[4]),
                       SUM(duration_buckets[5]), SUM(duration_buckets[6])
                   ]::INTEGER[] AS duration_buckets,
                   SUM(timeout_count)::BIGINT AS timeouts,
                   MAX(inflight_max)::INTEGER AS inflight_max,
                   MAX(queue_depth_max)::INTEGER AS queue_depth,
                   ROUND(AVG(CASE WHEN dependency_measured_count > 0
                                  THEN dependency_wait_total_ms::NUMERIC / dependency_measured_count END), 2) AS dep_wait_avg_ms
              FROM public.core_metrics_hour
             WHERE core_id = p_core_id AND hour >= p_since
             GROUP BY 1
             ORDER BY 1
          ) s;
    ELSE
        SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO v_rows
          FROM (
            SELECT date_trunc('minute', m.minute) AS bucket,
                   SUM(m.operation_count)::BIGINT AS operations,
                   SUM(m.error_count)::BIGINT AS errors,
                   SUM(m.client_error_count)::BIGINT AS client_errors,
                   ROUND(AVG(CASE WHEN m.operation_count > 0
                                  THEN m.duration_sum_ms::NUMERIC / m.operation_count END), 2) AS avg_ms,
                   ARRAY[
                       SUM(m.duration_buckets[1]), SUM(m.duration_buckets[2]),
                       SUM(m.duration_buckets[3]), SUM(m.duration_buckets[4]),
                       SUM(m.duration_buckets[5]), SUM(m.duration_buckets[6])
                   ]::INTEGER[] AS duration_buckets,
                   SUM(m.timeout_count)::BIGINT AS timeouts,
                   MAX(m.inflight_max)::INTEGER AS inflight_max,
                   MAX(g.queue_depth)::INTEGER AS queue_depth,
                   ROUND(AVG(CASE WHEN m.dependency_measured_count > 0
                                  THEN m.dependency_wait_total_ms::NUMERIC / m.dependency_measured_count END), 2) AS dep_wait_avg_ms
              FROM public.core_metrics_minute m
              LEFT JOIN public.core_gauges_minute g
                ON g.minute = m.minute AND g.instance_id = m.instance_id AND g.core_id = m.core_id
             WHERE m.core_id = p_core_id AND m.minute >= p_since
             GROUP BY 1
             ORDER BY 1
          ) s;
    END IF;

    RETURN v_rows;
END;
$$;

-- 9. Lock every new table down, then grant the one role that needs it.
ALTER TABLE public.core_metrics_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_metrics_hour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_gauges_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.db_metrics_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_alert_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'core_metrics_minute',
        'core_metrics_hour',
        'core_gauges_minute',
        'db_metrics_minute',
        'metric_alert_events'
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

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.admin_core_monitor_rollup_hour(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_core_monitor_prune(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_core_monitor_snapshot(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_core_monitor_series(text, timestamptz, text) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.admin_core_monitor_rollup_hour(timestamptz) FROM anon;
        REVOKE ALL ON FUNCTION public.admin_core_monitor_prune(integer, integer) FROM anon;
        REVOKE ALL ON FUNCTION public.admin_core_monitor_snapshot(timestamptz, timestamptz) FROM anon;
        REVOKE ALL ON FUNCTION public.admin_core_monitor_series(text, timestamptz, text) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.admin_core_monitor_rollup_hour(timestamptz) FROM authenticated;
        REVOKE ALL ON FUNCTION public.admin_core_monitor_prune(integer, integer) FROM authenticated;
        REVOKE ALL ON FUNCTION public.admin_core_monitor_snapshot(timestamptz, timestamptz) FROM authenticated;
        REVOKE ALL ON FUNCTION public.admin_core_monitor_series(text, timestamptz, text) FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.admin_core_monitor_rollup_hour(timestamptz) TO service_role;
        GRANT EXECUTE ON FUNCTION public.admin_core_monitor_prune(integer, integer) TO service_role;
        GRANT EXECUTE ON FUNCTION public.admin_core_monitor_snapshot(timestamptz, timestamptz) TO service_role;
        GRANT EXECUTE ON FUNCTION public.admin_core_monitor_series(text, timestamptz, text) TO service_role;
    END IF;
END $$;