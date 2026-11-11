-- ============================================
-- docs/salon-02-migration.sql
--
-- V59.1 Salon completion:
--   1. Extend chk_service_delivery_status to support 'checked_in' alongside 'in_progress'.
--   2. Add append-only service_delivery_status_audit + trigger logging every status transition.
--   3. Add atomic practitioner double-booking guard (advisory lock per practitioner × date)
--      complementing salon-01 resource guard for true concurrent safety.
--   4. Add idempotent service_delivery_move_status RPC.
--
-- Depends on: service-delivery-01-migration.sql, salon-01-migration.sql.
-- Additive and idempotent. Status: PENDING HUMAN CONFIRMATION.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS
--     public.service_delivery_move_status(uuid, uuid, text, uuid),
--     public.service_sessions_practitioner_guard(),
--     public.service_sessions_status_audit();
--   DROP TRIGGER IF EXISTS service_sessions_practitioner_guard_trg ON public.service_delivery_sessions;
--   DROP TRIGGER IF EXISTS service_sessions_status_audit_trg ON public.service_delivery_sessions;
--   DROP TABLE IF EXISTS public.service_delivery_status_audit;
-- ============================================

BEGIN;

-- ─── 1. Include checked_in in service_delivery_sessions.status ────────────────
ALTER TABLE public.service_delivery_sessions
  DROP CONSTRAINT IF EXISTS chk_service_delivery_status;
ALTER TABLE public.service_delivery_sessions
  ADD CONSTRAINT chk_service_delivery_status CHECK (
    status IN ('scheduled', 'checked_in', 'in_progress', 'delivered', 'cancelled', 'no_show')
  ) NOT VALID;
ALTER TABLE public.service_delivery_sessions
  VALIDATE CONSTRAINT chk_service_delivery_status;

-- ─── 2. Append-only status transition audit log ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_delivery_status_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES public.service_delivery_sessions (id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  actor_id     uuid,
  changed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_delivery_status_audit_idx
  ON public.service_delivery_status_audit (workspace_id, session_id, changed_at);

ALTER TABLE service_delivery_status_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_delivery_status_audit_tenant ON service_delivery_status_audit;
CREATE POLICY service_delivery_status_audit_tenant ON service_delivery_status_audit
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = service_delivery_status_audit.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = service_delivery_status_audit.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  );

REVOKE ALL ON public.service_delivery_status_audit
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.service_delivery_status_audit TO service_role;

CREATE OR REPLACE FUNCTION public.service_sessions_status_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.service_delivery_status_audit (
      workspace_id, session_id, from_status, to_status, actor_id
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      NULLIF(current_setting('app.user_id', true), '')::uuid
    );
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS service_sessions_status_audit_trg ON public.service_delivery_sessions;
CREATE TRIGGER service_sessions_status_audit_trg
  AFTER INSERT OR UPDATE OF status ON public.service_delivery_sessions
  FOR EACH ROW EXECUTE FUNCTION public.service_sessions_status_audit();

-- ─── 3. Concurrent staff double-booking guard ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_sessions_practitioner_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_clash uuid;
BEGIN
  IF NEW.practitioner_id IS NULL
     OR NEW.status IN ('cancelled', 'no_show')
     OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('practitioner:' || NEW.practitioner_id::text || ':' || NEW.session_date::text, 0)
  );
  SELECT s.id INTO v_clash
    FROM public.service_delivery_sessions s
   WHERE s.workspace_id = NEW.workspace_id
     AND s.practitioner_id = NEW.practitioner_id
     AND s.session_date = NEW.session_date
     AND s.id <> NEW.id
     AND s.status NOT IN ('cancelled', 'no_show')
     AND s.deleted_at IS NULL
     AND left(s.start_time, 5)::time < left(NEW.end_time, 5)::time
     AND left(NEW.start_time, 5)::time < left(s.end_time, 5)::time
   LIMIT 1;
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'PRACTITIONER_DOUBLE_BOOKED' USING ERRCODE = 'P0001', DETAIL = v_clash::text;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS service_sessions_practitioner_guard_trg ON public.service_delivery_sessions;
CREATE TRIGGER service_sessions_practitioner_guard_trg
  BEFORE INSERT OR UPDATE OF practitioner_id, session_date, start_time, end_time, status, deleted_at
  ON public.service_delivery_sessions
  FOR EACH ROW EXECUTE FUNCTION public.service_sessions_practitioner_guard();

-- ─── 4. Idempotent audited status transition RPC ──────────────────────────────
CREATE OR REPLACE FUNCTION public.service_delivery_move_status(
  p_workspace_id uuid,
  p_session_id uuid,
  p_to text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row public.service_delivery_sessions%ROWTYPE;
BEGIN
  IF p_to NOT IN ('checked_in', 'in_progress', 'no_show') THEN
    RAISE EXCEPTION 'SESSION_STATUS_MOVE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
    FROM public.service_delivery_sessions
   WHERE id = p_session_id
     AND workspace_id = p_workspace_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF v_row.status = p_to THEN
    RETURN jsonb_build_object('outcome', 'ok', 'replayed', true, 'status', v_row.status);
  END IF;

  IF NOT (
    (v_row.status = 'scheduled' AND p_to IN ('checked_in', 'in_progress', 'no_show'))
    OR (v_row.status = 'checked_in' AND p_to IN ('in_progress', 'no_show'))
    OR (v_row.status = 'in_progress' AND p_to = 'no_show')
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION:%->%', v_row.status, p_to USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.user_id', coalesce(p_user_id::text, ''), true);

  UPDATE public.service_delivery_sessions
     SET status = p_to,
         updated_at = now()
   WHERE id = p_session_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('outcome', 'ok', 'replayed', false, 'status', p_to);
END
$fn$;

REVOKE ALL ON FUNCTION public.service_sessions_status_audit() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.service_sessions_practitioner_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.service_delivery_move_status(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_delivery_move_status(uuid, uuid, text, uuid) TO service_role;

COMMIT;
