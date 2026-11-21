-- ============================================================================
-- SUBSCRIPTION RENEWAL FIX — replace approve_subscription_upgrade().
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor after
--    docs/subscription-upgrade-requests-migration.sql, then run
--    docs/VERIFY-subscription-renewal-fix.sql.
--    Status: PENDING HUMAN CONFIRMATION.
--
-- WHY (owner's report, 30 Aug 1405)
--
--   «اشتراک لولوخان الان کامل تموم شده اما در ادمین پنل نوشته فعال»
--   «هیچ گزینه‌ای برای تمدید یا ارتقا پلن نیست»
--
-- Two defects in the old approval function:
--
-- 1. It found a subscription ONLY by `workspace_id`. Rows written before
--    DECISION A (docs/subscription-workspace-migration.sql) may have a NULL
--    workspace_id; the write lock already resolves those through the
--    workspace OWNER (BillingService.findWorkspaceSubscriptionRow), so the
--    lock and the admin panel disagreed about the same business. Approving a
--    renewal for such a workspace raised SUBSCRIPTION_NOT_FOUND and the
--    admin could not activate it.
--
-- 2. It always started the new period at now(). A renewal requested before
--    the current period ended therefore threw away the paid-for remainder.
--    The rule is the same one BillingService.extendSubscriptionRow already
--    applies: renewing early continues from period_end; renewing after expiry
--    continues from now().
--
-- WHAT THIS DOES
--
--   * Resolves the row exactly like the write lock: this workspace's earliest
--     row first, then the owner's earliest LEGACY row (workspace_id IS NULL).
--     A row belonging to another workspace of the same owner is never used.
--   * Stamps workspace_id on a legacy row it adopts, so future reads need no
--     fallback.
--   * Starts the new period at GREATEST(now(), period_end).
--   * Keeps every other rule of the old function: one transaction, the request
--     must still be pending, cancel_at_period_end is cleared, the approved
--     amount and the period end are logged in subscription_events.
--
-- Existing rows are NOT rewritten here. The stamp happens only when an admin
-- approves a renewal for a legacy row (a deliberate, single-row adoption).
--
-- ROLLBACK
--
--   Re-run the `approve_subscription_upgrade` definition in
--   docs/subscription-upgrade-requests-migration.sql. That restores the old
--   behaviour (workspace_id only, period from now()).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.approve_subscription_upgrade(
  p_request_id   uuid,
  p_admin_id     uuid,
  p_amount_minor bigint DEFAULT NULL,
  p_note         text   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req        public.subscription_upgrade_requests%ROWTYPE;
  v_sub        uuid;
  v_owner      uuid;
  v_period_end timestamptz;
  v_base       timestamptz;
  v_end        timestamptz;
BEGIN
  SELECT * INTO v_req FROM public.subscription_upgrade_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_FOUND'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'UPGRADE_REQUEST_NOT_PENDING'; END IF;

  -- 1. THIS workspace's subscription — earliest row, exactly as the write
  --    lock reads it. Never «every subscription of the user».
  SELECT s.id, s.period_end INTO v_sub, v_period_end
    FROM public.subscriptions s
   WHERE s.workspace_id = v_req.workspace_id
   ORDER BY s.created_at ASC
   LIMIT 1
   FOR UPDATE;

  -- 2. A legacy row written before subscriptions carried a workspace_id.
  --    Resolve it through the workspace OWNER, and ONLY when it is still
  --    unassigned (workspace_id IS NULL). An owner's row that belongs to
  --    another business says nothing about this one.
  IF v_sub IS NULL THEN
    SELECT w.owner_id INTO v_owner FROM public.workspaces w
     WHERE w.id = v_req.workspace_id;
    IF v_owner IS NOT NULL THEN
      SELECT s.id, s.period_end INTO v_sub, v_period_end
        FROM public.subscriptions s
       WHERE s.user_id = v_owner AND s.workspace_id IS NULL
       ORDER BY s.created_at ASC
       LIMIT 1
       FOR UPDATE;
      IF v_sub IS NOT NULL THEN
        UPDATE public.subscriptions
           SET workspace_id = v_req.workspace_id
         WHERE id = v_sub;
      END IF;
    END IF;
  END IF;

  IF v_sub IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;

  -- 3. Renewing early continues from the period already paid for; renewing
  --    after expiry continues from today. Never lose paid days.
  v_base := GREATEST(now(), COALESCE(v_period_end, now()));
  v_end := v_base + CASE WHEN v_req.billing_interval = 'year'
                         THEN interval '1 year'
                         ELSE interval '1 month' END;

  UPDATE public.subscriptions
     SET plan = v_req.requested_plan,
         status = 'active',
         is_trial = false,
         trial_used = true,
         period_start = v_base,
         period_end = v_end,
         cancel_at_period_end = false,
         updated_at = now()
   WHERE id = v_sub;

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

-- CREATE OR REPLACE keeps the old privileges, but state them again so this
-- file is correct even when run alone on a fresh database.
REVOKE ALL ON FUNCTION public.approve_subscription_upgrade(uuid, uuid, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_subscription_upgrade(uuid, uuid, bigint, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
