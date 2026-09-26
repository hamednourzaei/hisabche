-- ============================================================================
-- SUBSCRIPTION UPGRADE REQUESTS + SUBSCRIPTION LOG — additive, idempotent.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then the verification query at the
-- bottom. Status: PENDING HUMAN CONFIRMATION.
--
-- WHY
--
-- 1. `POST /api/billing/upgrade` needed only a login, and it made the caller's
--    subscription pro/enterprise with NO payment — anyone could give themselves
--    the top plan. It also updated by `user_id`, so every workspace that user
--    owned was upgraded at once.
-- 2. `subscriptions.cancel_at_period_end` defaults to TRUE and activation never
--    cleared it, so every paid subscription read «لغو در پایان دوره برنامه‌ریزی
--    شده است» whether or not anyone asked to cancel.
-- 3. There was no record of who bought what, when, until when.
--
-- WHAT THIS ADDS
--
--   subscription_upgrade_requests   a member asks; the platform admin approves
--                                   after the money arrived. At most ONE pending
--                                   request per workspace.
--                                   payment_method / payment_reference: ready
--                                   for card-to-card and a future gateway.
--   subscription_events             the log: requested / approved / rejected /
--                                   cancelled / activated, with plan, interval,
--                                   amount and the period end.
--   approve_subscription_upgrade()  ONE transaction: lock the request, activate
--                                   THIS workspace's subscription (period from
--                                   now, cancel_at_period_end = false), mark the
--                                   request approved, write the log.
--   reject_subscription_upgrade()   same holder rules, no plan change.
--
-- Existing rows are NOT rewritten: a TRUE cancel_at_period_end on an old row
-- may be a real cancellation or the default; nothing here can tell which
-- (راهنمای سشن §۱۲). It is cleared only when a new activation happens.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_upgrade_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  requested_by       uuid NOT NULL,
  current_plan       text NOT NULL,
  requested_plan     text NOT NULL CHECK (requested_plan IN ('pro', 'enterprise')),
  billing_interval   text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  -- Minor units (cents). NULL = not priced by the product (enterprise is
  -- negotiated) — the admin writes the agreed amount on approval.
  amount_minor       bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency           text,
  -- 'card_to_card' | 'gateway' | 'manual'. NULL until the member says how.
  payment_method     text CHECK (payment_method IS NULL OR payment_method IN ('card_to_card', 'gateway', 'manual')),
  -- Card-to-card tracking number, gateway transaction id, …
  payment_reference  text,
  member_note        text,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by         uuid,
  decided_at         timestamptz,
  admin_note         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_upgrade_requests_one_pending
  ON public.subscription_upgrade_requests (workspace_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS subscription_upgrade_requests_status_idx
  ON public.subscription_upgrade_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  subscription_id  uuid,
  request_id       uuid,
  event            text NOT NULL CHECK (event IN
                     ('upgrade_requested', 'upgrade_approved', 'upgrade_rejected',
                      'upgrade_cancelled', 'cancel_scheduled', 'cancelled', 'expired')),
  plan             text,
  billing_interval text,
  amount_minor     bigint,
  currency         text,
  period_end       timestamptz,
  actor_id         uuid,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_events_workspace_idx
  ON public.subscription_events (workspace_id, created_at DESC);

-- Members may READ their own workspace's requests and log. Every write goes
-- through the backend (service role) — no client policy writes anything.
ALTER TABLE public.subscription_upgrade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_upgrade_requests'
                 AND policyname = 'subscription_upgrade_requests_members_read') THEN
    CREATE POLICY subscription_upgrade_requests_members_read ON public.subscription_upgrade_requests
      FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_events'
                 AND policyname = 'subscription_events_members_read') THEN
    CREATE POLICY subscription_events_members_read ON public.subscription_events
      FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
  END IF;
END $$;

-- ─── Request: the row and its log line, together ────────────────────────────
-- Raises UPGRADE_REQUEST_PENDING when the workspace already has one waiting.
CREATE OR REPLACE FUNCTION public.create_subscription_upgrade_request(
  p_workspace_id  uuid,
  p_user_id       uuid,
  p_current_plan  text,
  p_plan          text,
  p_interval      text,
  p_amount_minor  bigint,
  p_currency      text,
  p_method        text,
  p_reference     text,
  p_note          text
)
RETURNS public.subscription_upgrade_requests
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.subscription_upgrade_requests%ROWTYPE;
BEGIN
  BEGIN
    INSERT INTO public.subscription_upgrade_requests
      (workspace_id, requested_by, current_plan, requested_plan, billing_interval,
       amount_minor, currency, payment_method, payment_reference, member_note)
    VALUES
      (p_workspace_id, p_user_id, p_current_plan, p_plan, p_interval,
       p_amount_minor, p_currency, p_method, p_reference, p_note)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'UPGRADE_REQUEST_PENDING';
  END;

  INSERT INTO public.subscription_events
    (workspace_id, request_id, event, plan, billing_interval, amount_minor, currency, actor_id, note)
  VALUES
    (p_workspace_id, v_row.id, 'upgrade_requested', p_plan, p_interval, p_amount_minor, p_currency, p_user_id, p_note);

  RETURN v_row;
END;
$$;

-- ─── Withdraw: only a pending request, only from its own workspace ──────────
CREATE OR REPLACE FUNCTION public.cancel_subscription_upgrade_request(
  p_request_id   uuid,
  p_workspace_id uuid,
  p_user_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req public.subscription_upgrade_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.subscription_upgrade_requests
   WHERE id = p_request_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_PENDING'; END IF;

  UPDATE public.subscription_upgrade_requests
     SET status = 'cancelled', decided_by = p_user_id, decided_at = now()
   WHERE id = p_request_id;

  INSERT INTO public.subscription_events
    (workspace_id, request_id, event, plan, billing_interval, actor_id)
  VALUES
    (v_req.workspace_id, v_req.id, 'upgrade_cancelled', v_req.requested_plan, v_req.billing_interval, p_user_id);
END;
$$;

-- ─── Approve: one transaction ───────────────────────────────────────────────
-- Returns the activated subscription row id. Raises:
--   UPGRADE_REQUEST_NOT_FOUND / UPGRADE_REQUEST_NOT_PENDING / SUBSCRIPTION_NOT_FOUND
CREATE OR REPLACE FUNCTION public.approve_subscription_upgrade(
  p_request_id   uuid,
  p_admin_id     uuid,
  p_amount_minor bigint DEFAULT NULL,
  p_note         text   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req  public.subscription_upgrade_requests%ROWTYPE;
  v_sub  uuid;
  v_end  timestamptz;
BEGIN
  SELECT * INTO v_req FROM public.subscription_upgrade_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_PENDING'; END IF;

  v_end := now() + CASE WHEN v_req.billing_interval = 'year' THEN interval '1 year' ELSE interval '1 month' END;

  -- THIS workspace's subscription — never «every subscription of the user».
  UPDATE public.subscriptions
     SET plan = v_req.requested_plan,
         status = 'active',
         is_trial = false,
         trial_used = true,
         period_start = now(),
         period_end = v_end,
         cancel_at_period_end = false,
         updated_at = now()
   WHERE id = (SELECT s.id FROM public.subscriptions s
                WHERE s.workspace_id = v_req.workspace_id
                ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE)
  RETURNING id INTO v_sub;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;

  UPDATE public.subscription_upgrade_requests
     SET status = 'approved',
         decided_by = p_admin_id,
         decided_at = now(),
         admin_note = p_note,
         amount_minor = COALESCE(p_amount_minor, amount_minor)
   WHERE id = p_request_id;

  INSERT INTO public.subscription_events
    (workspace_id, subscription_id, request_id, event, plan, billing_interval,
     amount_minor, currency, period_end, actor_id, note)
  VALUES
    (v_req.workspace_id, v_sub, v_req.id, 'upgrade_approved', v_req.requested_plan,
     v_req.billing_interval, COALESCE(p_amount_minor, v_req.amount_minor), v_req.currency,
     v_end, p_admin_id, p_note);

  RETURN v_sub;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_subscription_upgrade(
  p_request_id uuid,
  p_admin_id   uuid,
  p_note       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req public.subscription_upgrade_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.subscription_upgrade_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_PENDING'; END IF;

  UPDATE public.subscription_upgrade_requests
     SET status = 'rejected', decided_by = p_admin_id, decided_at = now(), admin_note = p_note
   WHERE id = p_request_id;

  INSERT INTO public.subscription_events
    (workspace_id, request_id, event, plan, billing_interval, amount_minor, currency, actor_id, note)
  VALUES
    (v_req.workspace_id, v_req.id, 'upgrade_rejected', v_req.requested_plan,
     v_req.billing_interval, v_req.amount_minor, v_req.currency, p_admin_id, p_note);
END;
$$;

REVOKE ALL ON public.subscription_upgrade_requests FROM anon;
REVOKE ALL ON public.subscription_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_upgrade_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_events FROM authenticated;
GRANT SELECT ON public.subscription_upgrade_requests TO authenticated;
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_upgrade_requests TO service_role;
GRANT ALL ON public.subscription_events TO service_role;

REVOKE ALL ON FUNCTION public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_subscription_upgrade_request(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_upgrade_request(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.approve_subscription_upgrade(uuid, uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_subscription_upgrade(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_subscription_upgrade(uuid, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_subscription_upgrade(uuid, uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- The backend answers «not configured» (503) without these — it never falls
-- back to activating a plan without payment.
--
--   DROP FUNCTION IF EXISTS public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text);
--   DROP FUNCTION IF EXISTS public.cancel_subscription_upgrade_request(uuid, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.approve_subscription_upgrade(uuid, uuid, bigint, text);
--   DROP FUNCTION IF EXISTS public.reject_subscription_upgrade(uuid, uuid, text);
--   -- The tables hold the purchase history; check before dropping:
--   --   SELECT status, count(*) FROM public.subscription_upgrade_requests GROUP BY 1;
--   DROP TABLE IF EXISTS public.subscription_events;
--   DROP TABLE IF EXISTS public.subscription_upgrade_requests;
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately. Every row: ok = true.
-- ============================================================================
-- SELECT 'tables' AS check,
--        to_regclass('public.subscription_upgrade_requests') IS NOT NULL
--        AND to_regclass('public.subscription_events') IS NOT NULL AS ok
-- UNION ALL
-- SELECT 'one pending per workspace',
--        EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'subscription_upgrade_requests_one_pending')
-- UNION ALL
-- SELECT 'rls on',
--        (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.subscription_upgrade_requests'::regclass)
--        AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.subscription_events'::regclass)
-- UNION ALL
-- SELECT 'functions present',
--        to_regprocedure('public.approve_subscription_upgrade(uuid, uuid, bigint, text)') IS NOT NULL
--        AND to_regprocedure('public.reject_subscription_upgrade(uuid, uuid, text)') IS NOT NULL
--        AND to_regprocedure('public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text)') IS NOT NULL
--        AND to_regprocedure('public.cancel_subscription_upgrade_request(uuid, uuid, uuid)') IS NOT NULL
-- UNION ALL
-- SELECT 'members cannot approve',
--        NOT has_function_privilege('authenticated', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
-- UNION ALL
-- SELECT 'members cannot write requests',
--        NOT has_table_privilege('authenticated', 'public.subscription_upgrade_requests', 'INSERT')
--        AND NOT has_table_privilege('authenticated', 'public.subscription_upgrade_requests', 'UPDATE');
