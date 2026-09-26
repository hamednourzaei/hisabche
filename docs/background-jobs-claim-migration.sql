-- ============================================================================
-- MULTI-INSTANCE SAFE BACKGROUND WORK — additive, idempotent, re-runnable.
--
-- ✅ RUN on the live database. Post-migration Audit: PASS — its rows in
-- docs/VERIFY-background-jobs-and-realtime-2026-09-26.sql all ok = true
-- (19/19 in total, reported by the user 26 Sep 2026).
--
-- ⚠️ RUN THIS BEFORE THE BACKEND RUNS ON MORE THAN ONE INSTANCE.
--
-- WHY
--
-- Two things in the backend process were only correct with ONE instance:
--
--   1. background_jobs was claimed in two steps — read the pending rows, then
--      mark each one 'processing'. Two instances reading at the same moment
--      both got the same row and both ran it.
--   2. node-cron tasks (trial expiration daily, event-log recovery every 3
--      minutes) and the job poller run inside EVERY instance, so N instances
--      run each tick N times.
--
-- WHAT THIS ADDS
--
--   background_jobs.claimed_by / claim_expires_at   (nullable, additive)
--   claim_background_jobs(worker, limit, lease)      one statement, row locks
--                                                    with FOR UPDATE SKIP LOCKED
--   complete_background_job(id, worker)              only the current holder
--   fail_background_job(id, worker, error, delay)    retry or fail, holder only
--   scheduled_task_runs + claim_scheduled_run /      one run per task per slot,
--     finish_scheduled_run                           never two at once
--
-- Everything is called by the backend with the service role through
-- `supabase.rpc()`. Clients (anon / authenticated) cannot execute any of it.
-- No accounting, sync or invoice table is touched.
-- ============================================================================

BEGIN;

-- ─── 1. Job claims ───────────────────────────────────────────────────────────

ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS claimed_by text;
ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS background_jobs_claimable_idx
  ON public.background_jobs (status, scheduled_at);

-- Claim up to p_limit jobs for p_worker, atomically.
--
-- Eligible: pending and due, OR processing with an expired lease (the worker
-- that held it died — the claim is recovered, counted as a retry). A stale job
-- that has used its retries is marked failed instead of being run again.
--
-- FOR UPDATE SKIP LOCKED: a row another transaction is claiming right now is
-- skipped, never waited on and never returned twice. The select and the update
-- are one statement, so there is no window between "saw it" and "took it".
CREATE OR REPLACE FUNCTION public.claim_background_jobs(
  p_worker        text,
  p_limit         integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 900
)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Stale claims that are out of retries end here, visibly, as failed.
  UPDATE public.background_jobs j
     SET status = 'failed',
         last_error = COALESCE(j.last_error, 'CLAIM_EXPIRED: worker stopped before finishing'),
         completed_at = now(),
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE j.status = 'processing'
     AND COALESCE(j.claim_expires_at, j.started_at + make_interval(secs => p_lease_seconds)) < now()
     AND COALESCE(j.retry_count, 0) >= COALESCE(j.max_retries, 0);

  RETURN QUERY
  WITH picked AS (
    SELECT j.id
      FROM public.background_jobs j
     WHERE (j.status = 'pending' AND j.scheduled_at <= now())
        OR (j.status = 'processing'
            AND COALESCE(j.claim_expires_at, j.started_at + make_interval(secs => p_lease_seconds)) < now()
            AND COALESCE(j.retry_count, 0) < COALESCE(j.max_retries, 0))
     ORDER BY j.scheduled_at
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(1, LEAST(p_limit, 20))
  )
  UPDATE public.background_jobs j
     SET retry_count = CASE WHEN j.status = 'processing'
                            THEN COALESCE(j.retry_count, 0) + 1
                            ELSE COALESCE(j.retry_count, 0) END,
         status = 'processing',
         started_at = now(),
         completed_at = NULL,
         claimed_by = p_worker,
         claim_expires_at = now() + make_interval(secs => p_lease_seconds)
    FROM picked
   WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

-- Finish a job — only if p_worker still holds it. A worker whose lease expired
-- and whose job was re-claimed by another cannot overwrite that other run.
CREATE OR REPLACE FUNCTION public.complete_background_job(p_id uuid, p_worker text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.background_jobs
     SET status = 'completed', completed_at = now(),
         claimed_by = NULL, claim_expires_at = NULL
   WHERE id = p_id AND status = 'processing' AND claimed_by = p_worker;
  RETURN FOUND;
END;
$$;

-- A failed attempt: back to pending after p_retry_delay_seconds while retries
-- remain, otherwise failed. Same holder check as completion.
-- Returns the new status, or NULL when p_worker no longer held the job.
CREATE OR REPLACE FUNCTION public.fail_background_job(
  p_id                  uuid,
  p_worker              text,
  p_error               text,
  p_retry_delay_seconds integer DEFAULT 60
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  UPDATE public.background_jobs
     SET status = CASE WHEN COALESCE(retry_count, 0) < COALESCE(max_retries, 0)
                       THEN 'pending' ELSE 'failed' END,
         retry_count = CASE WHEN COALESCE(retry_count, 0) < COALESCE(max_retries, 0)
                            THEN COALESCE(retry_count, 0) + 1 ELSE COALESCE(retry_count, 0) END,
         scheduled_at = CASE WHEN COALESCE(retry_count, 0) < COALESCE(max_retries, 0)
                             THEN now() + make_interval(secs => p_retry_delay_seconds)
                             ELSE scheduled_at END,
         completed_at = CASE WHEN COALESCE(retry_count, 0) < COALESCE(max_retries, 0)
                             THEN NULL ELSE now() END,
         last_error = p_error,
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE id = p_id AND status = 'processing' AND claimed_by = p_worker
  RETURNING status INTO v_status;
  RETURN v_status;
END;
$$;

-- ─── 2. Scheduled tasks: one run per slot, never two at once ────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_task_runs (
  task        text        NOT NULL,
  slot        text        NOT NULL,
  holder      text        NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error       text,
  PRIMARY KEY (task, slot)
);

CREATE INDEX IF NOT EXISTS scheduled_task_runs_open_idx
  ON public.scheduled_task_runs (task, started_at) WHERE finished_at IS NULL;

ALTER TABLE public.scheduled_task_runs ENABLE ROW LEVEL SECURITY;

-- True for exactly one caller per (task, slot) across every instance — and
-- false while another run of the same task is still open inside its lease, so
-- a long run cannot overlap the next tick on a different instance.
--
-- pg_advisory_xact_lock serialises the check-then-insert for ONE task inside
-- this function's own transaction; it is released when the call returns, so it
-- never outlives an HTTP request or leaks across pooled connections. The
-- durable guarantee is the primary key.
CREATE OR REPLACE FUNCTION public.claim_scheduled_run(
  p_task          text,
  p_slot          text,
  p_holder        text,
  p_lease_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('scheduled_task_runs:' || p_task));

  IF EXISTS (
    SELECT 1 FROM public.scheduled_task_runs
     WHERE task = p_task
       AND finished_at IS NULL
       AND started_at > now() - make_interval(secs => p_lease_seconds)
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.scheduled_task_runs (task, slot, holder)
  VALUES (p_task, p_slot, p_holder)
  ON CONFLICT (task, slot) DO NOTHING;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_scheduled_run(
  p_task   text,
  p_slot   text,
  p_holder text,
  p_error  text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.scheduled_task_runs
     SET finished_at = now(), error = p_error
   WHERE task = p_task AND slot = p_slot AND holder = p_holder AND finished_at IS NULL;
  RETURN FOUND;
END;
$$;

-- ─── 3. Only the server may call these ──────────────────────────────────────

REVOKE ALL ON FUNCTION public.claim_background_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_background_job(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_background_job(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_scheduled_run(text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_scheduled_run(text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_background_jobs(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_background_job(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_background_job(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_run(text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_scheduled_run(text, text, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- The backend treats a missing function as "not configured" and keeps its
-- single-instance behaviour, so removing these is safe while ONE instance runs.
-- Do not remove them while more than one instance is running.
--
--   DROP FUNCTION IF EXISTS public.claim_background_jobs(text, integer, integer);
--   DROP FUNCTION IF EXISTS public.complete_background_job(uuid, text);
--   DROP FUNCTION IF EXISTS public.fail_background_job(uuid, text, text, integer);
--   DROP FUNCTION IF EXISTS public.claim_scheduled_run(text, text, text, integer);
--   DROP FUNCTION IF EXISTS public.finish_scheduled_run(text, text, text, text);
--   -- The columns and scheduled_task_runs hold no business data; keeping them is harmless.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration. Every row: ok = true.
-- ============================================================================
-- SELECT 'claim columns' AS check,
--        (SELECT count(*) FROM information_schema.columns
--          WHERE table_schema = 'public' AND table_name = 'background_jobs'
--            AND column_name IN ('claimed_by', 'claim_expires_at')) = 2 AS ok
-- UNION ALL
-- SELECT 'functions present',
--        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname = 'public' AND p.proname IN
--            ('claim_background_jobs', 'complete_background_job', 'fail_background_job',
--             'claim_scheduled_run', 'finish_scheduled_run')) = 5
-- UNION ALL
-- SELECT 'claim uses SKIP LOCKED',
--        pg_get_functiondef('public.claim_background_jobs(text, integer, integer)'::regprocedure)
--          ILIKE '%FOR UPDATE SKIP LOCKED%'
-- UNION ALL
-- SELECT 'clients cannot claim',
--        NOT has_function_privilege('anon', 'public.claim_background_jobs(text, integer, integer)', 'EXECUTE')
--        AND NOT has_function_privilege('authenticated', 'public.claim_background_jobs(text, integer, integer)', 'EXECUTE')
-- UNION ALL
-- SELECT 'scheduled_task_runs rls',
--        (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.scheduled_task_runs'::regclass);
