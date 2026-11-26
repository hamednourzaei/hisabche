-- ============================================
-- docs/support-tickets-03-atomic-sla-migration.sql
--
-- V100 P0 (4.4): Atomic Support Ticket Lifecycle & Automated SLA Sweep
--   - Adds `correlation_id` and `notification_status` to `support_ticket_events`.
--   - Adds atomic SQL functions (`FOR UPDATE` row locking):
--       1) `public.transition_support_ticket(...)`
--       2) `public.add_support_ticket_comment(...)`
--       3) `public.sweep_support_ticket_slas(...)`
--   - Ensures status mutation + immutable event history commit together cleanly.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.support_ticket_events
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS notification_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_ticket_events_notif_status_check'
      AND conrelid = 'public.support_ticket_events'::regclass
  ) THEN
    ALTER TABLE public.support_ticket_events
      ADD CONSTRAINT support_ticket_events_notif_status_check
      CHECK (notification_status IN ('pending', 'sent', 'failed', 'not_applicable'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.transition_support_ticket(
  p_workspace_id uuid,
  p_ticket_id uuid,
  p_actor_id uuid,
  p_next_status text,
  p_rca_summary text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.support_tickets;
  v_now timestamptz := now();
  v_is_reopen boolean;
  v_action text;
  v_updated public.support_tickets;
BEGIN
  IF p_next_status NOT IN ('acknowledged', 'escalated', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'INVALID_TICKET_STATUS';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id
    AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  v_is_reopen := v_ticket.status IN ('resolved', 'closed') AND p_next_status = 'acknowledged';
  IF v_is_reopen AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'REOPEN_REASON_REQUIRED';
  END IF;

  IF v_ticket.status = p_next_status THEN
    RETURN v_ticket;
  END IF;

  IF NOT (
    (v_ticket.status = 'open' AND p_next_status IN ('acknowledged', 'escalated', 'resolved')) OR
    (v_ticket.status = 'acknowledged' AND p_next_status IN ('escalated', 'resolved')) OR
    (v_ticket.status = 'escalated' AND p_next_status IN ('acknowledged', 'resolved')) OR
    (v_ticket.status = 'resolved' AND p_next_status IN ('closed', 'acknowledged')) OR
    (v_ticket.status = 'closed' AND p_next_status = 'acknowledged')
  ) THEN
    RAISE EXCEPTION 'INVALID_TICKET_TRANSITION';
  END IF;

  UPDATE public.support_tickets
  SET status = p_next_status,
      updated_at = v_now,
      rca_summary = COALESCE(p_rca_summary, rca_summary),
      escalated_at = CASE WHEN p_next_status = 'escalated' THEN v_now ELSE escalated_at END,
      escalation_level = CASE WHEN p_next_status = 'escalated' THEN COALESCE(escalation_level, 0) + 1 ELSE COALESCE(escalation_level, 0) END,
      resolved_at = CASE WHEN p_next_status = 'resolved' THEN v_now ELSE resolved_at END,
      closed_at = CASE WHEN p_next_status = 'closed' THEN v_now ELSE closed_at END,
      reopened_at = CASE WHEN v_is_reopen THEN v_now ELSE reopened_at END
  WHERE id = p_ticket_id
    AND workspace_id = p_workspace_id
  RETURNING * INTO v_updated;

  v_action := CASE
    WHEN v_is_reopen THEN 'reopened'
    WHEN p_next_status = 'closed' THEN 'closed'
    ELSE 'status_changed'
  END;

  INSERT INTO public.support_ticket_events (
    workspace_id, ticket_id, actor_id, action, from_status, to_status, note, correlation_id, notification_status
  ) VALUES (
    p_workspace_id, p_ticket_id, p_actor_id, v_action, v_ticket.status, p_next_status,
    COALESCE(p_reason, p_rca_summary), p_correlation_id, 'not_applicable'
  );

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_support_ticket_comment(
  p_workspace_id uuid,
  p_ticket_id uuid,
  p_author_id uuid,
  p_is_internal boolean,
  p_body text,
  p_correlation_id text DEFAULT NULL
)
RETURNS public.support_ticket_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.support_tickets;
  v_comment public.support_ticket_comments;
BEGIN
  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id
    AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  INSERT INTO public.support_ticket_comments (
    workspace_id, ticket_id, author_id, is_internal, body
  ) VALUES (
    p_workspace_id, p_ticket_id, p_author_id, COALESCE(p_is_internal, false), p_body
  )
  RETURNING * INTO v_comment;

  INSERT INTO public.support_ticket_events (
    workspace_id, ticket_id, actor_id, action, from_status, to_status, note, correlation_id, notification_status
  ) VALUES (
    p_workspace_id, p_ticket_id, p_author_id, 'comment_added', v_ticket.status, v_ticket.status,
    CASE WHEN COALESCE(p_is_internal, false) THEN 'internal_note' ELSE 'external_reply' END,
    p_correlation_id, 'not_applicable'
  );

  RETURN v_comment;
END;
$$;

CREATE OR REPLACE FUNCTION public.sweep_support_ticket_slas(
  p_workspace_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_rec record;
  v_escalated_ids uuid[] := ARRAY[]::uuid[];
  v_evaluated integer := 0;
  v_notif_failures integer := 0;
  v_event_id uuid;
BEGIN
  SELECT count(*) INTO v_evaluated
  FROM public.support_tickets
  WHERE (p_workspace_id IS NULL OR workspace_id = p_workspace_id);

  FOR v_rec IN
    SELECT * FROM public.support_tickets
    WHERE (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      AND status IN ('open', 'acknowledged')
      AND response_due_at < v_now
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.support_tickets
    SET status = 'escalated',
        escalation_level = COALESCE(escalation_level, 0) + 1,
        escalated_at = v_now,
        updated_at = v_now
    WHERE id = v_rec.id
      AND workspace_id = v_rec.workspace_id
      AND status IN ('open', 'acknowledged');

    IF FOUND THEN
      v_escalated_ids := array_append(v_escalated_ids, v_rec.id);

      INSERT INTO public.support_ticket_events (
        workspace_id, ticket_id, actor_id, action, from_status, to_status, note, correlation_id, notification_status
      ) VALUES (
        v_rec.workspace_id, v_rec.id, p_actor_id, 'sla_breached',
        v_rec.status, 'escalated',
        'SLA due passed before ' || v_now::text, p_correlation_id, 'pending'
      )
      RETURNING id INTO v_event_id;

      BEGIN
        INSERT INTO public.activities (
          workspace_id, entity_type, entity_id, action, title
        ) VALUES (
          v_rec.workspace_id, 'support_ticket', v_rec.id, 'sla_breached',
          COALESCE('SLA breach: ' || v_rec.subject, 'Support ticket SLA breached')
        );
        UPDATE public.support_ticket_events
        SET notification_status = 'sent'
        WHERE id = v_event_id;
      EXCEPTION WHEN OTHERS THEN
        v_notif_failures := v_notif_failures + 1;
        UPDATE public.support_ticket_events
        SET notification_status = 'failed',
            note = COALESCE(note, '') || ' | notif_error: ' || left(SQLERRM, 160)
        WHERE id = v_event_id;
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'evaluatedCount', v_evaluated,
    'escalatedTicketIds', to_jsonb(v_escalated_ids),
    'notificationFailures', v_notif_failures,
    'checkedAt', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_support_ticket(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_support_ticket(uuid, uuid, uuid, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.add_support_ticket_comment(uuid, uuid, uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_comment(uuid, uuid, uuid, boolean, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.sweep_support_ticket_slas(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_support_ticket_slas(uuid, uuid, text) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.sweep_support_ticket_slas(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.add_support_ticket_comment(uuid, uuid, uuid, boolean, text, text);
-- DROP FUNCTION IF EXISTS public.transition_support_ticket(uuid, uuid, uuid, text, text, text, text);
-- ALTER TABLE IF EXISTS public.support_ticket_events DROP CONSTRAINT IF EXISTS support_ticket_events_notif_status_check;
-- ALTER TABLE IF EXISTS public.support_ticket_events DROP COLUMN IF EXISTS notification_status, DROP COLUMN IF EXISTS correlation_id;
