-- ============================================
-- docs/project-change-orders-03-atomic-migration.sql
--
-- V100 P0 (4.2): Strictly Atomic Project Change Orders with Optimistic Version + Row Lock
--   - Adds `projects.budget_version` (optimistic concurrency token)
--   - Adds `project_change_orders.decision_reason` and `project_version_at_decision`
--   - `create_project_change_order(...)`: atomic creation (and optional manager instant-approval)
--   - `decide_project_change_order_v2(...)`: locks project + order `FOR UPDATE`, validates
--     live baseline, expected budget, expected version, currency scale (`1, 10, 100, 1000`),
--     computes cumulative delta inside the lock, updates both rows + increments version +
--     writes immutable `audit_logs` entry atomically.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.projects
  ADD COLUMN IF NOT EXISTS budget_version integer NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS public.project_change_orders
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS project_version_at_decision integer;

CREATE OR REPLACE FUNCTION public.create_project_change_order(
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
RETURNS public.project_change_orders
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
BEGIN
  IF p_scale IS NULL OR p_scale NOT IN (1, 10, 100, 1000) THEN
    RAISE EXCEPTION 'INVALID_CURRENCY_SCALE';
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing
    FROM public.project_change_orders
    WHERE workspace_id = p_workspace_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT * INTO v_proj
  FROM public.projects
  WHERE id = p_project_id
    AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND';
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

  INSERT INTO public.project_change_orders (
    workspace_id, project_id, title, original_budget_minor, delta_minor,
    revised_budget_minor, estimated_cost_delta_minor, net_margin_delta_minor,
    status, idempotency_key, created_by, decided_by, decided_at,
    decision_reason, project_version_at_decision, created_at, updated_at
  ) VALUES (
    p_workspace_id, p_project_id, p_title, v_original_minor, p_delta_minor,
    v_revised_minor, COALESCE(p_estimated_cost_delta_minor, 0), v_margin_minor,
    v_status, NULLIF(trim(COALESCE(p_idempotency_key, '')), ''), p_actor_id,
    CASE WHEN p_approved THEN p_actor_id ELSE NULL END,
    CASE WHEN p_approved THEN v_now ELSE NULL END,
    CASE WHEN p_approved THEN p_reason ELSE NULL END,
    v_new_version,
    v_now, v_now
  )
  RETURNING * INTO v_created;

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

  RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_project_change_order_v2(
  p_workspace_id uuid,
  p_project_id uuid,
  p_order_id uuid,
  p_decision text,
  p_actor_id uuid,
  p_scale numeric,
  p_expected_original_budget_minor bigint DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS public.project_change_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proj public.projects;
  v_order public.project_change_orders;
  v_live_minor bigint;
  v_revised_minor bigint;
  v_new_version integer;
  v_now timestamptz := now();
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;
  IF p_scale IS NULL OR p_scale NOT IN (1, 10, 100, 1000) THEN
    RAISE EXCEPTION 'INVALID_CURRENCY_SCALE';
  END IF;

  SELECT * INTO v_proj
  FROM public.projects
  WHERE id = p_project_id
    AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND';
  END IF;

  IF p_expected_version IS NOT NULL AND COALESCE(v_proj.budget_version, 1) <> p_expected_version THEN
    RAISE EXCEPTION 'STALE_PROJECT_VERSION_CONFLICT';
  END IF;

  v_live_minor := round(COALESCE(v_proj.budget, 0) * p_scale)::bigint;
  IF p_expected_original_budget_minor IS NOT NULL AND v_live_minor <> p_expected_original_budget_minor THEN
    RAISE EXCEPTION 'STALE_PROJECT_BUDGET_CONFLICT';
  END IF;

  SELECT * INTO v_order
  FROM public.project_change_orders
  WHERE id = p_order_id
    AND project_id = p_project_id
    AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHANGE_ORDER_NOT_FOUND';
  END IF;

  IF v_order.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'CHANGE_ORDER_NOT_PENDING';
  END IF;

  v_new_version := COALESCE(v_proj.budget_version, 1);
  v_revised_minor := v_live_minor + v_order.delta_minor;

  IF p_decision = 'approved' THEN
    IF v_revised_minor < 0 THEN
      RAISE EXCEPTION 'REVISED_BUDGET_CANNOT_BE_NEGATIVE';
    END IF;
    v_new_version := v_new_version + 1;
    UPDATE public.projects
    SET budget = v_revised_minor / p_scale,
        budget_version = v_new_version,
        updated_at = v_now
    WHERE id = p_project_id
      AND workspace_id = p_workspace_id;
  ELSE
    v_revised_minor := v_live_minor;
  END IF;

  UPDATE public.project_change_orders
  SET status = p_decision,
      original_budget_minor = v_live_minor,
      revised_budget_minor = v_revised_minor,
      decided_by = p_actor_id,
      decided_at = v_now,
      decision_reason = p_reason,
      project_version_at_decision = v_new_version,
      updated_at = v_now
  WHERE id = p_order_id
    AND project_id = p_project_id
    AND workspace_id = p_workspace_id
    AND status = 'pending_approval'
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, old_data, new_data, reason
  ) VALUES (
    p_workspace_id,
    p_actor_id,
    'project.change_order.' || p_decision,
    'project_change_order',
    p_order_id,
    jsonb_build_object('budgetMinor', v_live_minor, 'version', COALESCE(v_proj.budget_version, 1), 'status', 'pending_approval'),
    jsonb_build_object('budgetMinor', v_revised_minor, 'version', v_new_version, 'status', p_decision),
    p_reason
  );

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_change_order(
  uuid, uuid, uuid, text, bigint, bigint, boolean, numeric, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_change_order(
  uuid, uuid, uuid, text, bigint, bigint, boolean, numeric, text, integer, text
) TO service_role;

REVOKE ALL ON FUNCTION public.decide_project_change_order_v2(
  uuid, uuid, uuid, text, uuid, numeric, bigint, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_project_change_order_v2(
  uuid, uuid, uuid, text, uuid, numeric, bigint, integer, text
) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.decide_project_change_order_v2(uuid, uuid, uuid, text, uuid, numeric, bigint, integer, text);
-- DROP FUNCTION IF EXISTS public.create_project_change_order(uuid, uuid, uuid, text, bigint, bigint, boolean, numeric, text, integer, text);
-- ALTER TABLE IF EXISTS public.project_change_orders DROP COLUMN IF EXISTS project_version_at_decision, DROP COLUMN IF EXISTS decision_reason;
-- ALTER TABLE IF EXISTS public.projects DROP COLUMN IF EXISTS budget_version;
