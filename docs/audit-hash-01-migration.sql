-- ============================================
-- audit-hash-01 (V53 4.7): tamper-evident audit log
--
-- WHAT THIS IS: every NEW audit row of a workspace is chained to the one before it. The database
-- (a BEFORE INSERT trigger, inside the inserting transaction) numbers the row, stores the previous row's
-- hash and its own hash. `audit_chain_verify(workspace)` recomputes the chain and says where it breaks.
--
-- DETECTS: an edited row (payload, actor, action, time), an edited/forged hash, a broken link, a row
-- removed from the middle (gap in the sequence), the newest rows removed (head says more existed).
--
-- DOES NOT PREVENT, and does not claim to: someone with full database write access who recomputes every
-- hash from the point of change AND rewrites the head. Without a trust anchor outside the database (a
-- periodically exported head hash kept elsewhere, or a keyed HMAC whose key the database never sees) that
-- cannot be excluded. `audit_chain_head(workspace)` returns the value worth exporting. OWNER DECISION: where
-- that anchor lives.
--
-- LEGACY: rows written before this migration have chain_seq / hash NULL. They are counted, never rewritten,
-- never invented a hash. Workspace-less rows (workspace_id NULL) are not chained.
-- RETENTION: cleanup_audit_logs_retention may delete the OLDEST rows. Verification then starts at the first
-- remaining row (its link to the deleted row cannot be checked; its own hash still can).
--
-- Additive and re-runnable. Depends on: audit_logs (admin-02-security-migration.sql). No BEGIN/COMMIT.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS audit_logs_chain_trigger ON public.audit_logs;
--   DROP FUNCTION IF EXISTS public.audit_logs_chain();
--   DROP FUNCTION IF EXISTS public.audit_chain_verify(uuid);
--   DROP FUNCTION IF EXISTS public.audit_chain_head(uuid);
--   DROP FUNCTION IF EXISTS public.audit_row_hash(public.audit_logs, bigint, text);
--   DROP TABLE IF EXISTS public.audit_chain_heads;
--   (the columns stay: dropping them would erase the evidence already written)
-- ============================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS chain_seq bigint,
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS hash text;

CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_chain_seq_uq
  ON public.audit_logs (workspace_id, chain_seq) WHERE chain_seq IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.audit_chain_heads (
  workspace_id uuid PRIMARY KEY,
  last_seq bigint NOT NULL,
  last_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_chain_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_chain_heads FROM PUBLIC;
REVOKE ALL ON public.audit_chain_heads FROM anon, authenticated, service_role;
GRANT SELECT ON public.audit_chain_heads TO service_role;

-- The canonical content of one row. Explicit fields only: a column added to audit_logs later must not change
-- the hash of rows already written. jsonb text is canonical (keys sorted, no insignificant whitespace).
CREATE OR REPLACE FUNCTION public.audit_row_hash(r public.audit_logs, p_seq bigint, p_prev text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT encode(
    sha256(convert_to(
      jsonb_build_array(
        p_seq,
        p_prev,
        r.id::text,
        r.workspace_id::text,
        r.user_id::text,
        r.action,
        r.entity_type,
        r.entity_id::text,
        to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        r.old_data,
        r.new_data,
        to_jsonb(r) -> 'reason'
      )::text,
      'UTF8')),
    'hex')
$fn$;

CREATE OR REPLACE FUNCTION public.audit_logs_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  head public.audit_chain_heads%ROWTYPE;
  seq bigint;
  prev text;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW; -- not chainable: no workspace to chain it in
  END IF;
  IF NEW.created_at IS NULL THEN
    NEW.created_at := now(); -- the hash covers the time, so it is fixed here, before hashing
  END IF;

  -- One writer at a time PER WORKSPACE: the row lock is held until this transaction ends, so two concurrent
  -- inserts cannot read the same head and fork the chain. A rolled-back insert rolls the head back with it.
  INSERT INTO public.audit_chain_heads (workspace_id, last_seq, last_hash)
  VALUES (NEW.workspace_id, 0, repeat('0', 64))
  ON CONFLICT (workspace_id) DO NOTHING;

  SELECT * INTO head FROM public.audit_chain_heads WHERE workspace_id = NEW.workspace_id FOR UPDATE;

  seq := head.last_seq + 1;
  prev := head.last_hash;
  NEW.chain_seq := seq;
  NEW.prev_hash := prev;
  NEW.hash := public.audit_row_hash(NEW, seq, prev);

  UPDATE public.audit_chain_heads
     SET last_seq = seq, last_hash = NEW.hash, updated_at = now()
   WHERE workspace_id = NEW.workspace_id;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS audit_logs_chain_trigger ON public.audit_logs;
CREATE TRIGGER audit_logs_chain_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_chain();

-- ok / checked / legacy_unchained / first_bad_seq / reason
--   reason: NULL when ok; HASH_MISMATCH | BROKEN_LINK | MISSING_RECORD | TAIL_REMOVED
CREATE OR REPLACE FUNCTION public.audit_chain_verify(p_workspace_id uuid)
RETURNS TABLE (ok boolean, checked bigint, legacy_unchained bigint, first_bad_seq bigint, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  r public.audit_logs%ROWTYPE;
  expected_prev text := NULL;
  last_seq_seen bigint := NULL;
  n bigint := 0;
  head public.audit_chain_heads%ROWTYPE;
BEGIN
  legacy_unchained := (SELECT count(*) FROM public.audit_logs a
                        WHERE a.workspace_id = p_workspace_id AND a.chain_seq IS NULL);

  FOR r IN
    SELECT * FROM public.audit_logs a
     WHERE a.workspace_id = p_workspace_id AND a.chain_seq IS NOT NULL
     ORDER BY a.chain_seq
  LOOP
    n := n + 1;
    IF last_seq_seen IS NOT NULL AND r.chain_seq <> last_seq_seen + 1 THEN
      RETURN QUERY SELECT false, n - 1, legacy_unchained, r.chain_seq, 'MISSING_RECORD'::text;
      RETURN;
    END IF;
    -- The first remaining row has no predecessor to compare with (retention may have removed it).
    IF expected_prev IS NOT NULL AND r.prev_hash IS DISTINCT FROM expected_prev THEN
      RETURN QUERY SELECT false, n - 1, legacy_unchained, r.chain_seq, 'BROKEN_LINK'::text;
      RETURN;
    END IF;
    IF r.hash IS DISTINCT FROM public.audit_row_hash(r, r.chain_seq, r.prev_hash) THEN
      RETURN QUERY SELECT false, n - 1, legacy_unchained, r.chain_seq, 'HASH_MISMATCH'::text;
      RETURN;
    END IF;
    expected_prev := r.hash;
    last_seq_seen := r.chain_seq;
  END LOOP;

  SELECT * INTO head FROM public.audit_chain_heads WHERE workspace_id = p_workspace_id;
  IF FOUND AND (last_seq_seen IS DISTINCT FROM head.last_seq OR expected_prev IS DISTINCT FROM head.last_hash) THEN
    RETURN QUERY SELECT false, n, legacy_unchained, COALESCE(last_seq_seen, 0) + 1, 'TAIL_REMOVED'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, n, legacy_unchained, NULL::bigint, NULL::text;
END
$fn$;

-- The value worth exporting to somewhere the database cannot reach (the trust anchor).
CREATE OR REPLACE FUNCTION public.audit_chain_head(p_workspace_id uuid)
RETURNS TABLE (last_seq bigint, last_hash text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT h.last_seq, h.last_hash FROM public.audit_chain_heads h WHERE h.workspace_id = p_workspace_id
$fn$;

REVOKE ALL ON FUNCTION public.audit_logs_chain() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.audit_row_hash(public.audit_logs, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_chain_verify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_chain_head(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_row_hash(public.audit_logs, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_chain_verify(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_chain_head(uuid) TO service_role;
