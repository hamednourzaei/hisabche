-- ============================================
-- docs/support-tickets-04-atomic-create-assign-migration.sql
--
-- Adds atomic support-ticket creation (with idempotent replay) and atomic
-- ticket assignment + event trail in single Postgres transactions.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_support_ticket_atomic(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_ticket_code text,
  p_subject text,
  p_priority text,
  p_category text,
  p_description text,
  p_sla_hours integer,
  p_response_due_at timestamptz,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.support_tickets;
  v_created public.support_tickets;
  v_clean_key text := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF v_clean_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.support_tickets
    WHERE workspace_id = p_workspace_id
      AND idempotency_key = v_clean_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ticket', to_jsonb(v_existing), 'replay', true);
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.support_tickets (
      workspace_id, ticket_code, subject, priority, category, description,
      sla_hours, response_due_at, status, escalation_level, idempotency_key, created_by
    ) VALUES (
      p_workspace_id, p_ticket_code, p_subject, p_priority, p_category, p_description,
      p_sla_hours, p_response_due_at, 'open', 0, v_clean_key, p_actor_id
    )
    RETURNING * INTO v_created;
  EXCEPTION
    WHEN unique_violation THEN
      IF v_clean_key IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.support_tickets
        WHERE workspace_id = p_workspace_id
          AND idempotency_key = v_clean_key
        LIMIT 1;
        IF FOUND THEN
          RETURN jsonb_build_object('ticket', to_jsonb(v_existing), 'replay', true);
        END IF;
      END IF;
      RAISE;
  END;

  INSERT INTO public.support_ticket_events (
    workspace_id, ticket_id, actor_id, action, from_status, to_status, note, notification_status
  ) VALUES (
    p_workspace_id, v_created.id, p_actor_id, 'created', NULL, 'open', p_priority, 'not_applicable'
  );

  RETURN jsonb_build_object('ticket', to_jsonb(v_created), 'replay', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_support_ticket_atomic(
  p_workspace_id uuid,
  p_ticket_id uuid,
  p_actor_id uuid,
  p_assignee_id uuid DEFAULT NULL
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.support_tickets;
  v_updated public.support_tickets;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id
    AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  UPDATE public.support_tickets
  SET assigned_to = p_assignee_id,
      updated_at = v_now
  WHERE id = p_ticket_id
    AND workspace_id = p_workspace_id
  RETURNING * INTO v_updated;

  INSERT INTO public.support_ticket_events (
    workspace_id, ticket_id, actor_id, action, from_status, to_status, note, notification_status
  ) VALUES (
    p_workspace_id, p_ticket_id, p_actor_id, 'assigned', v_ticket.status, v_ticket.status,
    COALESCE(p_assignee_id::text, 'unassigned'), 'not_applicable'
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket_atomic(uuid, uuid, text, text, text, text, text, integer, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket_atomic(uuid, uuid, text, text, text, text, text, integer, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.assign_support_ticket_atomic(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_support_ticket_atomic(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.assign_support_ticket_atomic(uuid, uuid, uuid, uuid);
-- DROP FUNCTION IF EXISTS public.create_support_ticket_atomic(uuid, uuid, text, text, text, text, text, integer, timestamptz, text);
