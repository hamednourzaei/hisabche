-- ============================================
-- docs/project-change-orders-02-rpc-migration.sql
--
-- Atomic SQL function for deciding a project change order and updating
-- `projects.budget` in a single serializable transaction.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.decide_project_change_order(
  p_workspace_id uuid,
  p_project_id uuid,
  p_order_id uuid,
  p_decision text,
  p_actor_id uuid,
  p_scale numeric
)
RETURNS public.project_change_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.project_change_orders;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;
  IF p_scale IS NULL OR p_scale <= 0 THEN
    RAISE EXCEPTION 'INVALID_CURRENCY_SCALE';
  END IF;

  UPDATE public.project_change_orders
  SET status = p_decision,
      decided_by = p_actor_id,
      decided_at = now(),
      updated_at = now()
  WHERE id = p_order_id
    AND project_id = p_project_id
    AND workspace_id = p_workspace_id
    AND status = 'pending_approval'
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHANGE_ORDER_NOT_PENDING';
  END IF;

  IF p_decision = 'approved' THEN
    UPDATE public.projects
    SET budget = v_order.revised_budget_minor / p_scale,
        updated_at = now()
    WHERE id = p_project_id
      AND workspace_id = p_workspace_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROJECT_NOT_FOUND';
    END IF;
  END IF;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_project_change_order(uuid, uuid, uuid, text, uuid, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_project_change_order(uuid, uuid, uuid, text, uuid, numeric)
  TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.decide_project_change_order(uuid, uuid, uuid, text, uuid, numeric);
