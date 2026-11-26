-- ============================================
-- docs/project-change-orders-04-idempotent-lock-migration.sql
--
-- Fixes idempotency race in change-order creation:
--   - Locks `projects` FOR UPDATE BEFORE checking `idempotency_key`
--   - Catches concurrent `unique_violation` on `(workspace_id, idempotency_key)`
--   - Returns explicit `{ order, replay }` jsonb so callers never guess via timestamps.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_project_change_order_v2(
  p_workspace_id uuid,
  p_project_id uuid,
  p_actor_id uuid,
  p_title text,
  p_delta_minor bigint,
  p_estimated_cost_delta_minor bigint,
  p_approved boolean,
  p_scale numeric,
  p_idempotency_key text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proj public.projects;
  v_existing public.project_change_orders;
  v_original_minor bigint;
  v_revised_minor bigint;
  v_margin_minor bigint;
  v_status text;
  v_now timestamptz := now();
  v_new_version integer;
  v_created public.project_change_orders;
  v_clean_key text := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF p_scale IS NULL OR p_scale NOT IN (1, 10, 100, 1000) THEN
    RAISE EXCEPTION 'INVALID_CURRENCY_SCALE';
  END IF;

  -- Lock the parent project FIRST so concurrent identical idempotency keys serialize cleanly.
  SELECT * INTO v_proj
  FROM public.projects
  WHERE id = p_project_id
    AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND';
  END IF;

  IF v_clean_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.project_change_orders
    WHERE workspace_id = p_workspace_id
      AND idempotency_key = v_clean_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('order', to_jsonb(v_existing), 'replay', true);
    END IF;
  END IF;

  IF p_expected_version IS NOT NULL AND COALESCE(v_proj.budget_version, 1) <> p_expected_version THEN
    RAISE EXCEPTION 'STALE_PROJECT_VERSION_CONFLICT';
  END IF;

  v_original_minor := round(COALESCE(v_proj.budget, 0) * p_scale)::bigint;
  v_revised_minor := v_original_minor + p_delta_minor;
  IF v_revised_minor < 0 THEN
    RAISE EXCEPTION 'REVISED_BUDGET_CANNOT_BE_NEGATIVE';
  END IF;

  v_margin_minor := p_delta_minor - COALESCE(p_estimated_cost_delta_minor, 0);
  v_status := CASE WHEN p_approved THEN 'approved' ELSE 'pending_approval' END;
  v_new_version := COALESCE(v_proj.budget_version, 1);

  IF p_approved THEN
    v_new_version := v_new_version + 1;
    UPDATE public.projects
    SET budget = v_revised_minor / p_scale,
        budget_version = v_new_version,
        updated_at = v_now
    WHERE id = p_project_id
      AND workspace_id = p_workspace_id;
  END IF;

  BEGIN
    INSERT INTO public.project_change_orders (
      workspace_id, project_id, title, original_budget_minor, delta_minor,
      revised_budget_minor, estimated_cost_delta_minor, net_margin_delta_minor,
      status, idempotency_key, created_by, decided_by, decided_at,
      decision_reason, project_version_at_decision, created_at, updated_at
    ) VALUES (
      p_workspace_id, p_project_id, p_title, v_original_minor, p_delta_minor,
      v_revised_minor, COALESCE(p_estimated_cost_delta_minor, 0), v_margin_minor,
      v_status, v_clean_key, p_actor_id,
      CASE WHEN p_approved THEN p_actor_id ELSE NULL END,
      CASE WHEN p_approved THEN v_now ELSE NULL END,
      CASE WHEN p_approved THEN p_reason ELSE NULL END,
      v_new_version,
      v_now, v_now
    )
    RETURNING * INTO v_created;
  EXCEPTION
    WHEN unique_violation THEN
      IF v_clean_key IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.project_change_orders
        WHERE workspace_id = p_workspace_id
          AND idempotency_key = v_clean_key
        LIMIT 1;
        IF FOUND THEN
          RETURN jsonb_build_object('order', to_jsonb(v_existing), 'replay', true);
        END IF;
      END IF;
      RAISE;
  END;

  INSERT INTO public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, old_data, new_data, reason
  ) VALUES (
    p_workspace_id,
    p_actor_id,
    CASE WHEN p_approved THEN 'project.change_order.create_approved' ELSE 'project.change_order.created' END,
    'project_change_order',
    v_created.id,
    jsonb_build_object('budgetMinor', v_original_minor, 'version', COALESCE(v_proj.budget_version, 1)),
    jsonb_build_object('budgetMinor', v_revised_minor, 'version', v_new_version, 'status', v_status),
    COALESCE(p_reason, p_title)
  );

  RETURN jsonb_build_object('order', to_jsonb(v_created), 'replay', false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_change_order_v2(
  uuid, uuid, uuid, text, bigint, bigint, boolean, numeric, text, integer, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_project_change_order_v2(
  uuid, uuid, uuid, text, bigint, bigint, boolean, numeric, text, integer, text
) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.create_project_change_order_v2(uuid, uuid, uuid, text, bigint, bigint, boolean, numeric, text, integer, text);
