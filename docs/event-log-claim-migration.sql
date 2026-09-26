-- ============================================================================
-- MULTI-INSTANCE SAFE EVENT PROCESSING — additive, idempotent, re-runnable.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then the verification query at the
-- bottom. Status: PENDING HUMAN CONFIRMATION.
--
-- ⚠️ RUN THIS BEFORE THE BACKEND RUNS ON MORE THAN ONE INSTANCE.
--
-- WHY
--
-- eventService processes an event twice over: immediately on the instance
-- that emitted it, and again from the recovery cron. Both read the row, run
-- the handlers, then mark it processed — with only a per-process
-- `isProcessing` flag in between. Two instances (or the emitter and the
-- recovery pass on one instance) could run the same event's handlers at once.
--
-- WHAT THIS ADDS — the same model as docs/background-jobs-claim-migration.sql
--
--   event_log.claimed_by / claim_expires_at   (nullable, additive)
--   claim_event_log(worker, limit, lease, id)  one statement, FOR UPDATE SKIP
--                                              LOCKED; `id` claims ONE event
--   complete_event_log(id, worker)            holder only
--   fail_event_log(id, worker, error)         holder only; backoff or dead
--
-- SEMANTICS, precisely: at most one holder of an event at a time; a holder
-- that dies loses the event when its lease expires and another instance may
-- run it again. That is at-least-once EXECUTION with no concurrent execution —
-- effectively-once only for idempotent handlers. (Today no handler is
-- registered at all: processing only marks the row processed.)
--
-- An event that has used its retries (retry_count >= max_retries, or 3 when
-- max_retries is 0 — the backend's existing rule) is no longer claimed. The
-- old path left such rows unprocessed and re-ran them on every recovery pass.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_log ADD COLUMN IF NOT EXISTS claimed_by text;
ALTER TABLE public.event_log ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS event_log_claimable_idx
  ON public.event_log (next_retry_at) WHERE processed = false;

CREATE OR REPLACE FUNCTION public.claim_event_log(
  p_worker        text,
  p_limit         integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 300,
  p_event_id      uuid    DEFAULT NULL
)
RETURNS SETOF public.event_log
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT e.id
      FROM public.event_log e
     WHERE e.processed = false
       AND (p_event_id IS NULL OR e.id = p_event_id)
       AND (e.next_retry_at IS NULL OR e.next_retry_at <= now())
       AND COALESCE(e.retry_count, 0)
           < CASE WHEN COALESCE(e.max_retries, 0) > 0 THEN e.max_retries ELSE 3 END
       AND (e.claimed_by IS NULL OR e.claim_expires_at < now())
     ORDER BY e.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(1, LEAST(p_limit, 50))
  )
  UPDATE public.event_log e
     -- Reclaiming an expired claim is an attempt that did not finish.
     SET retry_count = CASE WHEN e.claimed_by IS NOT NULL
                            THEN COALESCE(e.retry_count, 0) + 1
                            ELSE COALESCE(e.retry_count, 0) END,
         claimed_by = p_worker,
         claim_expires_at = now() + make_interval(secs => p_lease_seconds)
    FROM picked
   WHERE e.id = picked.id
  RETURNING e.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_event_log(p_id uuid, p_worker text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_log
     SET processed = true, completed_at = now(), error_message = NULL,
         claimed_by = NULL, claim_expires_at = NULL
   WHERE id = p_id AND processed = false AND claimed_by = p_worker;
  RETURN FOUND;
END;
$$;

-- 'retry' (next_retry_at set with the backend's 2^n-minute backoff),
-- 'dead' (out of retries; stays unprocessed and is no longer claimed),
-- or NULL when p_worker no longer held it.
CREATE OR REPLACE FUNCTION public.fail_event_log(p_id uuid, p_worker text, p_error text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_retry integer;
  v_max   integer;
BEGIN
  UPDATE public.event_log
     SET retry_count = COALESCE(retry_count, 0) + 1,
         next_retry_at = now() + make_interval(mins => power(2, COALESCE(retry_count, 0) + 1)::integer),
         error_message = p_error,
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE id = p_id AND processed = false AND claimed_by = p_worker
  RETURNING retry_count,
            CASE WHEN COALESCE(max_retries, 0) > 0 THEN max_retries ELSE 3 END
       INTO v_retry, v_max;

  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN CASE WHEN v_retry >= v_max THEN 'dead' ELSE 'retry' END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_event_log(text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_event_log(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_event_log(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_log(text, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_event_log(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_event_log(uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION — the backend falls back to its old single-instance
-- path when these functions are missing; safe only while ONE instance runs.
--
--   DROP FUNCTION IF EXISTS public.claim_event_log(text, integer, integer, uuid);
--   DROP FUNCTION IF EXISTS public.complete_event_log(uuid, text);
--   DROP FUNCTION IF EXISTS public.fail_event_log(uuid, text, text);
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately. Every row: ok = true.
-- ============================================================================
-- SELECT 'claim columns' AS check,
--        (SELECT count(*) FROM information_schema.columns
--          WHERE table_schema = 'public' AND table_name = 'event_log'
--            AND column_name IN ('claimed_by', 'claim_expires_at')) = 2 AS ok
-- UNION ALL
-- SELECT 'functions present',
--        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname = 'public'
--            AND p.proname IN ('claim_event_log', 'complete_event_log', 'fail_event_log')) = 3
-- UNION ALL
-- SELECT 'claim uses SKIP LOCKED',
--        pg_get_functiondef('public.claim_event_log(text, integer, integer, uuid)'::regprocedure)
--          ILIKE '%FOR UPDATE SKIP LOCKED%'
-- UNION ALL
-- SELECT 'clients cannot claim',
--        NOT has_function_privilege('anon', 'public.claim_event_log(text, integer, integer, uuid)', 'EXECUTE')
--        AND NOT has_function_privilege('authenticated', 'public.claim_event_log(text, integer, integer, uuid)', 'EXECUTE');
