-- ============================================================================
-- docs/ha-writer-fencing-01-migration.sql
--
-- Distributed Writer Fencing & Lease Authority (HA / Split-Brain Defense)
--
-- Gives multi-instance backend nodes a single shared PostgreSQL source of truth
-- for active writer identity, monotonic epochs, and time-bounded writer leases.
-- Deposed or partitioned backend nodes cannot self-renew an expired lease or
-- commit writes after a standby promotion increments the cluster epoch.
--
-- Idempotent & additive. Includes explicit privilege hardening and Rollback.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.writer_fencing_leases (
  cluster_key       TEXT PRIMARY KEY,
  epoch             BIGINT NOT NULL CHECK (epoch >= 1),
  writer_id         TEXT NOT NULL CHECK (length(trim(writer_id)) > 0),
  lease_expires_at  TIMESTAMPTZ NOT NULL,
  fence_signature   TEXT,
  previous_writer_id TEXT,
  promoted_by       TEXT,
  promotion_reason  TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.writer_fencing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key       TEXT NOT NULL,
  event_type        TEXT NOT NULL CHECK (event_type IN ('LEASE_ACQUIRED', 'LEASE_RENEWED', 'STANDBY_PROMOTED', 'FENCE_REJECTED')),
  epoch             BIGINT NOT NULL,
  writer_id         TEXT NOT NULL,
  previous_writer_id TEXT,
  actor             TEXT,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS writer_fencing_events_cluster_created_idx
  ON public.writer_fencing_events (cluster_key, created_at DESC);

-- Strict least-privilege table grants (Supabase tables grant ALL to anon/auth by default)
REVOKE ALL ON TABLE public.writer_fencing_leases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.writer_fencing_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.writer_fencing_leases TO service_role;
GRANT SELECT, INSERT ON TABLE public.writer_fencing_events TO service_role;

-- ─── RPC 1: Acquire or renew the single active writer lease ──────────────────
CREATE OR REPLACE FUNCTION public.acquire_or_renew_writer_lease(
  p_cluster_key      TEXT,
  p_writer_id        TEXT,
  p_epoch            BIGINT,
  p_ttl_ms           INTEGER DEFAULT 30000,
  p_fence_signature  TEXT DEFAULT NULL
)
RETURNS TABLE (
  cluster_key       TEXT,
  epoch             BIGINT,
  writer_id         TEXT,
  lease_expires_at  TIMESTAMPTZ,
  fence_signature   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row        public.writer_fencing_leases%ROWTYPE;
  v_ttl_ms     INTEGER := GREATEST(COALESCE(p_ttl_ms, 30000), 1000);
  v_new_expiry TIMESTAMPTZ := now() + make_interval(secs => v_ttl_ms::DOUBLE PRECISION / 1000.0);
BEGIN
  IF p_cluster_key IS NULL OR length(trim(p_cluster_key)) = 0 THEN
    RAISE EXCEPTION 'cluster_key is required' USING ERRCODE = '22023';
  END IF;
  IF p_writer_id IS NULL OR length(trim(p_writer_id)) = 0 THEN
    RAISE EXCEPTION 'writer_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_epoch IS NULL OR p_epoch < 1 THEN
    RAISE EXCEPTION 'epoch must be >= 1' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.writer_fencing_leases AS w (
    cluster_key, epoch, writer_id, lease_expires_at, fence_signature, updated_at
  )
  VALUES (
    p_cluster_key, p_epoch, p_writer_id, v_new_expiry, p_fence_signature, now()
  )
  ON CONFLICT ON CONSTRAINT writer_fencing_leases_pkey DO NOTHING;

  SELECT * INTO v_row
  FROM public.writer_fencing_leases
  WHERE writer_fencing_leases.cluster_key = p_cluster_key
  FOR UPDATE;

  -- Reject stale epoch immediately (Split-Brain defense)
  IF p_epoch < v_row.epoch THEN
    INSERT INTO public.writer_fencing_events (
      cluster_key, event_type, epoch, writer_id, previous_writer_id, reason
    ) VALUES (
      p_cluster_key, 'FENCE_REJECTED', p_epoch, p_writer_id, v_row.writer_id,
      format('Stale epoch %s < active epoch %s', p_epoch, v_row.epoch)
    );
    RAISE EXCEPTION 'ERR_FENCING_TOKEN_REJECTED: stale epoch % (active epoch %)', p_epoch, v_row.epoch
      USING ERRCODE = 'P0001';
  END IF;

  -- Same epoch: another writer cannot steal an unexpired lease
  IF p_epoch = v_row.epoch AND v_row.writer_id <> p_writer_id AND v_row.lease_expires_at > now() THEN
    INSERT INTO public.writer_fencing_events (
      cluster_key, event_type, epoch, writer_id, previous_writer_id, reason
    ) VALUES (
      p_cluster_key, 'FENCE_REJECTED', p_epoch, p_writer_id, v_row.writer_id,
      format('Active lease held by %s until %s', v_row.writer_id, v_row.lease_expires_at)
    );
    RAISE EXCEPTION 'ERR_FENCING_TOKEN_REJECTED: active lease held by % at epoch %', v_row.writer_id, v_row.epoch
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.writer_fencing_leases
  SET epoch = p_epoch,
      writer_id = p_writer_id,
      lease_expires_at = v_new_expiry,
      fence_signature = COALESCE(p_fence_signature, writer_fencing_leases.fence_signature),
      updated_at = now()
  WHERE writer_fencing_leases.cluster_key = p_cluster_key;

  INSERT INTO public.writer_fencing_events (
    cluster_key, event_type, epoch, writer_id
  ) VALUES (
    p_cluster_key, 'LEASE_RENEWED', p_epoch, p_writer_id
  );

  RETURN QUERY
  SELECT w.cluster_key, w.epoch, w.writer_id, w.lease_expires_at, w.fence_signature
  FROM public.writer_fencing_leases AS w
  WHERE w.cluster_key = p_cluster_key;
END;
$$;

-- ─── RPC 2: Promote standby & fence deposed writer atomically ────────────────
CREATE OR REPLACE FUNCTION public.promote_standby_writer(
  p_cluster_key      TEXT,
  p_expected_epoch   BIGINT,
  p_new_writer_id    TEXT,
  p_authorized_by    TEXT,
  p_reason           TEXT,
  p_ttl_ms           INTEGER DEFAULT 30000,
  p_fence_signature  TEXT DEFAULT NULL
)
RETURNS TABLE (
  cluster_key       TEXT,
  epoch             BIGINT,
  writer_id         TEXT,
  lease_expires_at  TIMESTAMPTZ,
  fence_signature   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row        public.writer_fencing_leases%ROWTYPE;
  v_ttl_ms     INTEGER := GREATEST(COALESCE(p_ttl_ms, 30000), 1000);
  v_new_expiry TIMESTAMPTZ := now() + make_interval(secs => v_ttl_ms::DOUBLE PRECISION / 1000.0);
  v_next_epoch BIGINT;
BEGIN
  IF p_authorized_by IS NULL OR length(trim(p_authorized_by)) = 0 THEN
    RAISE EXCEPTION 'authorized_by is required for writer promotion' USING ERRCODE = '22023';
  END IF;
  IF p_new_writer_id IS NULL OR length(trim(p_new_writer_id)) = 0 THEN
    RAISE EXCEPTION 'new_writer_id is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.writer_fencing_leases
  WHERE writer_fencing_leases.cluster_key = p_cluster_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_next_epoch := GREATEST(COALESCE(p_expected_epoch, 0), 0) + 1;
    INSERT INTO public.writer_fencing_leases (
      cluster_key, epoch, writer_id, lease_expires_at, fence_signature,
      previous_writer_id, promoted_by, promotion_reason, updated_at
    ) VALUES (
      p_cluster_key, v_next_epoch, p_new_writer_id, v_new_expiry, p_fence_signature,
      NULL, p_authorized_by, p_reason, now()
    );
  ELSE
    IF v_row.epoch <> p_expected_epoch THEN
      RAISE EXCEPTION 'ERR_FENCING_TOKEN_REJECTED: promotion CAS mismatch (expected epoch %, current epoch %)',
        p_expected_epoch, v_row.epoch
        USING ERRCODE = 'P0001';
    END IF;
    v_next_epoch := v_row.epoch + 1;
    UPDATE public.writer_fencing_leases
    SET epoch = v_next_epoch,
        previous_writer_id = v_row.writer_id,
        writer_id = p_new_writer_id,
        lease_expires_at = v_new_expiry,
        fence_signature = p_fence_signature,
        promoted_by = p_authorized_by,
        promotion_reason = p_reason,
        updated_at = now()
    WHERE writer_fencing_leases.cluster_key = p_cluster_key;
  END IF;

  INSERT INTO public.writer_fencing_events (
    cluster_key, event_type, epoch, writer_id, previous_writer_id, actor, reason
  ) VALUES (
    p_cluster_key, 'STANDBY_PROMOTED', v_next_epoch, p_new_writer_id, v_row.writer_id, p_authorized_by, p_reason
  );

  RETURN QUERY
  SELECT w.cluster_key, w.epoch, w.writer_id, w.lease_expires_at, w.fence_signature
  FROM public.writer_fencing_leases AS w
  WHERE w.cluster_key = p_cluster_key;
END;
$$;

-- ─── RPC 3: Assert caller holds active non-expired writer epoch ───────────────
CREATE OR REPLACE FUNCTION public.assert_writer_epoch(
  p_cluster_key TEXT,
  p_writer_id   TEXT,
  p_epoch       BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.writer_fencing_leases%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.writer_fencing_leases
  WHERE writer_fencing_leases.cluster_key = p_cluster_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_FENCING_TOKEN_REJECTED: no distributed lease registered for cluster %', p_cluster_key
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.epoch <> p_epoch OR v_row.writer_id <> p_writer_id THEN
    RAISE EXCEPTION 'ERR_FENCING_TOKEN_REJECTED: writer=% epoch=% rejected (active writer=% epoch=%)',
      p_writer_id, p_epoch, v_row.writer_id, v_row.epoch
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'ERR_FENCING_TOKEN_REJECTED: lease for writer % at epoch % expired at %',
      v_row.writer_id, v_row.epoch, v_row.lease_expires_at
      USING ERRCODE = 'P0001';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_or_renew_writer_lease(TEXT, TEXT, BIGINT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_standby_writer(TEXT, BIGINT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_writer_epoch(TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.acquire_or_renew_writer_lease(TEXT, TEXT, BIGINT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_standby_writer(TEXT, BIGINT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_writer_epoch(TEXT, TEXT, BIGINT) TO service_role;

-- ============================================================================
-- Rollback (execute manually only if reverting HA distributed fencing)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.assert_writer_epoch(TEXT, TEXT, BIGINT);
-- DROP FUNCTION IF EXISTS public.promote_standby_writer(TEXT, BIGINT, TEXT, TEXT, TEXT, INTEGER, TEXT);
-- DROP FUNCTION IF EXISTS public.acquire_or_renew_writer_lease(TEXT, TEXT, BIGINT, INTEGER, TEXT);
-- DROP TABLE IF EXISTS public.writer_fencing_events;
-- DROP TABLE IF EXISTS public.writer_fencing_leases;
