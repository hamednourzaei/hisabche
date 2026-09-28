-- ============================================================================
-- DEVELOPER PLATFORM 02 — request log, usage, event replay, stock events.
-- Additive, idempotent, re-runnable. Requires docs/developer-platform-migration.sql.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-02.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- Until it runs: API keys and webhooks keep working exactly as after 01; the
-- usage view answers «not configured», replay answers 503, and no stock event
-- is emitted. Nothing else changes.
--
-- WHAT THIS ADDS
--
--   api_request_logs                one row per request made WITH AN API KEY
--                                   (never for a signed-in person): method,
--                                   route PATTERN (not the URL — no ids or query
--                                   strings are stored), status, duration
--   api_key_usage(...)              exact per-day counts for one key; `count(*)`,
--                                   never an estimate or a page of rows
--   purge_api_request_logs(...)     retention: rows older than N days (default 30)
--   replay_webhook_deliveries(...)  put an endpoint's finished deliveries since a
--                                   moment back in line — same event ids
--   products_stock_webhook()        AFTER UPDATE trigger on products: emits
--                                   inventory.low_stock / inventory.restocked
--                                   when the quantity CROSSES min_stock_level
--
-- WHY A TRIGGER FOR STOCK EVENTS
--
--   products.quantity is the projection every stock writer ends in (sales,
--   receipts, transfers, counts, production — phase-c-01). A trigger there
--   sees a crossing whichever path caused it, in the same transaction, so an
--   event exists exactly when the stock really moved. Emitting from each
--   service instead would miss the next writer somebody adds.
--
--   ⚠️ It can NEVER fail the sale: the body runs in its own exception block and
--   a failure is a WARNING, not an error. An integration must not be able to
--   stop a till.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.webhook_endpoints') IS NULL OR to_regclass('public.api_keys') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-migration.sql first.';
  END IF;
END $$;

-- ─── Request log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id           bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_id       uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  method       text NOT NULL CHECK (char_length(method) <= 10),
  route        text NOT NULL CHECK (char_length(route) <= 200),
  status       integer NOT NULL CHECK (status BETWEEN 100 AND 599),
  duration_ms  integer NOT NULL CHECK (duration_ms >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_request_logs_key_idx ON public.api_request_logs (key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_request_logs_age_idx ON public.api_request_logs (created_at);

ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_request_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.api_request_logs_id_seq TO service_role;

-- Same readers as the keys themselves (01): owners and managers.
DROP POLICY IF EXISTS api_request_logs_managers_read ON api_request_logs;
CREATE POLICY api_request_logs_managers_read ON api_request_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = api_request_logs.workspace_id
       AND m.user_id = auth.uid()
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

-- ─── Usage: exact counts per day ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.api_key_usage(
  p_workspace_id uuid,
  p_key_id       uuid,
  p_days         integer DEFAULT 7
)
RETURNS TABLE (
  day           date,
  requests      bigint,
  client_errors bigint,
  server_errors bigint,
  avg_ms        integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (l.created_at AT TIME ZONE 'UTC')::date                AS day,
         count(*)                                                AS requests,
         count(*) FILTER (WHERE l.status BETWEEN 400 AND 499)    AS client_errors,
         count(*) FILTER (WHERE l.status >= 500)                 AS server_errors,
         round(avg(l.duration_ms))::integer                      AS avg_ms
    FROM public.api_request_logs l
   WHERE l.workspace_id = p_workspace_id
     AND l.key_id = p_key_id
     AND l.created_at >= now() - make_interval(days => GREATEST(1, LEAST(p_days, 90)))
   GROUP BY 1
   ORDER BY 1 DESC;
$$;

-- Retention. A log, not a record: the books never read it.
CREATE OR REPLACE FUNCTION public.purge_api_request_logs(p_keep_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.api_request_logs
   WHERE created_at < now() - make_interval(days => GREATEST(7, p_keep_days));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Event replay ────────────────────────────────────────────────────────────

-- Marks a delivery the sender is re-sending on purpose.
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS replayed_at timestamptz;

-- Finished deliveries (succeeded or failed) of ONE endpoint since p_since go
-- back to pending. Same event ids: a receiver that deduplicates on the id must
-- be told to accept a replay (the Hisabche-Replay header, set by the sender).
-- At most 30 days back; returns how many were requeued.
CREATE OR REPLACE FUNCTION public.replay_webhook_deliveries(
  p_workspace_id uuid,
  p_endpoint_id  uuid,
  p_since        timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_since < now() - interval '30 days' THEN
    RAISE EXCEPTION 'REPLAY_WINDOW_TOO_LONG' USING ERRCODE = '22023';
  END IF;
  UPDATE public.webhook_deliveries
     SET status = 'pending', attempts = 0, next_attempt_at = now(),
         last_error = NULL, replayed_at = now()
   WHERE workspace_id = p_workspace_id
     AND endpoint_id = p_endpoint_id
     AND created_at >= p_since
     AND status IN ('succeeded', 'failed');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Stock events ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.products_stock_webhook()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_id   uuid;
BEGIN
  -- The same rule as GET /api/products/low-stock: quantity <= min_stock_level.
  IF NEW.workspace_id IS NULL OR NOT COALESCE(NEW.is_active, true) THEN
    RETURN NEW;
  END IF;
  IF COALESCE(OLD.quantity, 0) > COALESCE(OLD.min_stock_level, 0)
     AND COALESCE(NEW.quantity, 0) <= COALESCE(NEW.min_stock_level, 0) THEN
    v_type := 'inventory.low_stock';
  ELSIF COALESCE(OLD.quantity, 0) <= COALESCE(OLD.min_stock_level, 0)
     AND COALESCE(NEW.quantity, 0) > COALESCE(NEW.min_stock_level, 0) THEN
    v_type := 'inventory.restocked';
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    v_id := gen_random_uuid();
    -- The envelope buildEnvelope() writes (developer.domain.ts), field for field.
    PERFORM public.enqueue_webhook_event(
      NEW.workspace_id, v_id, v_type,
      jsonb_build_object(
        'id', v_id,
        'type', v_type,
        'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'workspaceId', NEW.workspace_id,
        'data', jsonb_build_object('resource', 'product', 'id', NEW.id),
        'apiVersion', 1
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'products_stock_webhook: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_stock_webhook_trg ON public.products;
CREATE TRIGGER products_stock_webhook_trg
  AFTER UPDATE OF quantity, min_stock_level ON public.products
  FOR EACH ROW
  WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.min_stock_level IS DISTINCT FROM NEW.min_stock_level)
  EXECUTE FUNCTION public.products_stock_webhook();

-- ─── Grants ──────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.api_key_usage(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_api_request_logs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_webhook_deliveries(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.products_stock_webhook() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_key_usage(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_api_request_logs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_webhook_deliveries(uuid, uuid, timestamptz) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Stop stock events only (keeps everything else):
--   DROP TRIGGER IF EXISTS products_stock_webhook_trg ON public.products;
--
-- Remove this migration entirely (destroys the request log):
--   BEGIN;
--   DROP TRIGGER IF EXISTS products_stock_webhook_trg ON public.products;
--   DROP FUNCTION IF EXISTS public.products_stock_webhook();
--   DROP FUNCTION IF EXISTS public.replay_webhook_deliveries(uuid, uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.purge_api_request_logs(integer);
--   DROP FUNCTION IF EXISTS public.api_key_usage(uuid, uuid, integer);
--   DROP TABLE IF EXISTS public.api_request_logs;
--   ALTER TABLE public.webhook_deliveries DROP COLUMN IF EXISTS replayed_at;
--   COMMIT;
-- ============================================================================
