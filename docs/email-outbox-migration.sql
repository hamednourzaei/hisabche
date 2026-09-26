-- ============================================================================
-- DURABLE EMAIL OUTBOX — additive, idempotent, re-runnable.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then the verification query at the
-- bottom. Status: PENDING HUMAN CONFIRMATION.
--
-- WHY
--
-- emailService.send() put each email in an array inside the process and sent
-- it from there. An instance that crashed or was redeployed with emails in
-- that array lost them — an invite or a password-reset link that never
-- arrives, with nothing anywhere saying so. And the array is per instance.
--
-- WHAT THIS ADDS — the same claim model as docs/background-jobs-claim-migration.sql
--
--   email_outbox                                 one row per email, written BEFORE sending
--   claim_email_outbox(worker, limit, lease, id)  one statement, FOR UPDATE SKIP LOCKED;
--                                                 `id` claims ONE email (the fast path)
--   complete_email_outbox(id, worker, provider)  holder only; clears the body
--   fail_email_outbox(id, worker, error, delay)  holder only; backoff, then failed
--
-- SEMANTICS, precisely: at most one instance sends an email at a time; an
-- instance that dies mid-send loses the claim when its lease expires and
-- another sends it again. At-least-once — the backend passes the row id to
-- the provider as its Idempotency-Key, so a retry within the provider's
-- window is not delivered twice.
--
-- ⚠️ THE BODY IS A CREDENTIAL. A reset or invite email carries a live token.
-- The table is service-role only (RLS on, no policies, no grants to anon /
-- authenticated), and the body is set to NULL as soon as the email is sent
-- or has used its attempts.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email         text NOT NULL,
  subject          text NOT NULL,
  html             text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL DEFAULT 5,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  claimed_by       text,
  claim_expires_at timestamptz,
  last_error       text,
  provider_id      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);

CREATE INDEX IF NOT EXISTS email_outbox_due_idx
  ON public.email_outbox (next_attempt_at) WHERE status IN ('pending', 'sending');

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_outbox TO service_role;

-- Claim due emails. A 'sending' row whose lease expired is an attempt that
-- never finished: it is claimed again while attempts remain, otherwise it
-- ends as failed (visibly, with its body cleared).
CREATE OR REPLACE FUNCTION public.claim_email_outbox(
  p_worker        text,
  p_limit         integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 120,
  p_id            uuid    DEFAULT NULL
)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_outbox o
     SET status = 'failed',
         html = NULL,
         last_error = COALESCE(o.last_error, 'CLAIM_EXPIRED: worker stopped before finishing'),
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE o.status = 'sending'
     AND o.claim_expires_at < now()
     AND o.attempts >= o.max_attempts;

  RETURN QUERY
  WITH picked AS (
    SELECT o.id
      FROM public.email_outbox o
     WHERE (p_id IS NULL OR o.id = p_id)
       AND o.attempts < o.max_attempts
       AND ((o.status = 'pending' AND o.next_attempt_at <= now())
            OR (o.status = 'sending' AND o.claim_expires_at < now()))
     ORDER BY o.next_attempt_at
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(1, LEAST(p_limit, 50))
  )
  UPDATE public.email_outbox o
     SET status = 'sending',
         attempts = o.attempts + 1,
         claimed_by = p_worker,
         claim_expires_at = now() + make_interval(secs => p_lease_seconds)
    FROM picked
   WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

-- Sent — only if p_worker still holds it. The body is no longer needed.
CREATE OR REPLACE FUNCTION public.complete_email_outbox(
  p_id          uuid,
  p_worker      text,
  p_provider_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_outbox
     SET status = 'sent', sent_at = now(), html = NULL, provider_id = p_provider_id,
         last_error = NULL, claimed_by = NULL, claim_expires_at = NULL
   WHERE id = p_id AND status = 'sending' AND claimed_by = p_worker;
  RETURN FOUND;
END;
$$;

-- A failed attempt: back to pending after p_retry_delay_seconds while attempts
-- remain, otherwise failed with the body cleared. Same holder check.
-- Returns the new status, or NULL when p_worker no longer held it.
CREATE OR REPLACE FUNCTION public.fail_email_outbox(
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
  UPDATE public.email_outbox
     SET status = CASE WHEN attempts < max_attempts THEN 'pending' ELSE 'failed' END,
         html = CASE WHEN attempts < max_attempts THEN html ELSE NULL END,
         next_attempt_at = now() + make_interval(secs => p_retry_delay_seconds),
         last_error = left(p_error, 1000),
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE id = p_id AND status = 'sending' AND claimed_by = p_worker
  RETURNING status INTO v_status;
  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_outbox(text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_email_outbox(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_email_outbox(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(text, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_email_outbox(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_email_outbox(uuid, text, text, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- The backend treats a missing table as "not configured" and sends from its
-- in-process queue as before — correct for ONE instance only.
--
-- ⚠️ Before dropping, check nothing is still waiting:
--   SELECT status, count(*) FROM public.email_outbox GROUP BY status;
-- Rows in 'pending' or 'sending' are emails nobody has received yet.
--
--   DROP FUNCTION IF EXISTS public.claim_email_outbox(text, integer, integer, uuid);
--   DROP FUNCTION IF EXISTS public.complete_email_outbox(uuid, text, text);
--   DROP FUNCTION IF EXISTS public.fail_email_outbox(uuid, text, text, integer);
--   DROP TABLE IF EXISTS public.email_outbox;
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration. Every row: ok = true.
-- ============================================================================
-- SELECT 'table' AS check, to_regclass('public.email_outbox') IS NOT NULL AS ok
-- UNION ALL
-- SELECT 'rls on', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_outbox'::regclass)
-- UNION ALL
-- SELECT 'no client policies',
--        NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_outbox')
-- UNION ALL
-- SELECT 'clients cannot read',
--        NOT has_table_privilege('anon', 'public.email_outbox', 'SELECT')
--        AND NOT has_table_privilege('authenticated', 'public.email_outbox', 'SELECT')
-- UNION ALL
-- SELECT 'functions present',
--        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname = 'public'
--            AND p.proname IN ('claim_email_outbox', 'complete_email_outbox', 'fail_email_outbox')) = 3
-- UNION ALL
-- SELECT 'claim uses SKIP LOCKED',
--        pg_get_functiondef('public.claim_email_outbox(text, integer, integer, uuid)'::regprocedure)
--          ILIKE '%FOR UPDATE SKIP LOCKED%'
-- UNION ALL
-- SELECT 'clients cannot claim',
--        NOT has_function_privilege('anon', 'public.claim_email_outbox(text, integer, integer, uuid)', 'EXECUTE')
--        AND NOT has_function_privilege('authenticated', 'public.claim_email_outbox(text, integer, integer, uuid)', 'EXECUTE');
