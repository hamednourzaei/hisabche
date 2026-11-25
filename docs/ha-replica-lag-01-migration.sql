-- ============================================================================
-- docs/ha-replica-lag-01-migration.sql
--
-- Authoritative PostgreSQL WAL Replay Replication Lag Measurement RPC
-- Computes genuine physical replication lag in milliseconds on standby/replica
-- nodes using `pg_is_in_recovery()` and `pg_last_xact_replay_timestamp()`.
-- Returns NULL when node is primary or replay timestamp is unknown (never 0).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_replication_lag_ms()
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_in_recovery BOOLEAN;
  v_replay_ts   TIMESTAMPTZ;
  v_lag_ms      DOUBLE PRECISION;
BEGIN
  SELECT pg_is_in_recovery() INTO v_in_recovery;
  IF NOT COALESCE(v_in_recovery, false) THEN
    -- Primary / non-replica node cannot report replica replay lag; return NULL.
    RETURN NULL;
  END IF;

  SELECT pg_last_xact_replay_timestamp() INTO v_replay_ts;
  IF v_replay_ts IS NULL THEN
    -- Unknown replay timestamp stays NULL (fail closed to Primary).
    RETURN NULL;
  END IF;

  v_lag_ms := GREATEST(0.0, EXTRACT(EPOCH FROM (now() - v_replay_ts)) * 1000.0);
  RETURN v_lag_ms;
END;
$$;

REVOKE ALL ON FUNCTION public.get_replication_lag_ms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_replication_lag_ms() TO service_role;

-- ============================================================================
-- Rollback (execute manually only if reverting replica lag RPC)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.get_replication_lag_ms();
