-- ============================================================================
-- VERIFY subscription renewal fix — read-only. Run after
-- docs/subscription-renewal-fix-migration.sql.
-- Expect one row with ok = true.
-- ============================================================================

SELECT
  -- The function carries the renewal base rule, not «period from now()».
  position('GREATEST(now(), COALESCE(v_period_end, now()))'
    in pg_get_functiondef('public.approve_subscription_upgrade(uuid, uuid, bigint, text)'::regprocedure)) > 0
    AS renews_from_period_end,
  -- The legacy fallback is the workspace owner's still-unassigned row.
  position('s.user_id = v_owner AND s.workspace_id IS NULL'
    in pg_get_functiondef('public.approve_subscription_upgrade(uuid, uuid, bigint, text)'::regprocedure)) > 0
    AS owner_fallback_only_for_legacy,
  -- …and the adopted row is stamped so the fallback stops being needed.
  position('SET workspace_id = v_req.workspace_id'
    in pg_get_functiondef('public.approve_subscription_upgrade(uuid, uuid, bigint, text)'::regprocedure)) > 0
    AS legacy_row_is_stamped,
  NOT has_function_privilege('anon', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
    AS clients_cannot_call,
  has_function_privilege('service_role', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
    AS backend_can_call,
  -- For the record, not pass/fail: how many subscriptions still have no
  -- workspace and would use the owner fallback.
  (SELECT count(*) FROM public.subscriptions WHERE workspace_id IS NULL) AS legacy_rows_remaining,
  (
    position('GREATEST(now(), COALESCE(v_period_end, now()))'
      in pg_get_functiondef('public.approve_subscription_upgrade(uuid, uuid, bigint, text)'::regprocedure)) > 0
    AND position('s.user_id = v_owner AND s.workspace_id IS NULL'
      in pg_get_functiondef('public.approve_subscription_upgrade(uuid, uuid, bigint, text)'::regprocedure)) > 0
    AND position('SET workspace_id = v_req.workspace_id'
      in pg_get_functiondef('public.approve_subscription_upgrade(uuid, uuid, bigint, text)'::regprocedure)) > 0
    AND NOT has_function_privilege('anon', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE')
  ) AS ok;
