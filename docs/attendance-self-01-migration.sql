-- ============================================================================
-- ATTENDANCE SELF-SERVICE — 01. Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-attendance-self-01.sql.
--
-- A manager gives ONE employee a personal link. Through it the employee sends
-- «I was present 08:00–16:30 on the 12th». What they send is a SUBMISSION, kept
-- for ever with the server's own clock beside it; it becomes an attendance
-- record only
--   · at once, when the link allows it AND nobody has recorded that day yet, or
--   · when a manager approves it.
-- An employee never overwrites a record somebody else made.
--
--   attendance_links          one live link per employee (token, expiry, rules)
--   attendance_submissions    append-only: what was sent, when, what became of it
--   attendance.source         NULL = recorded on the sheet (every existing row);
--                             'employee_link' = came from a submission
--
-- The token is stored exactly as customer_portal_links stores its token:
-- 256 random bits, hex, plain. The link is its maker narrowed to one employee;
-- the application re-checks the maker's membership on every visit.
--
-- Times are `time`, the day is `date`, as `attendance` itself. The shop's zone
-- is not stored anywhere in this schema, so each link carries the zone of the
-- device that made it — the same «the shop's own local time» the sheet uses.
--
-- Nothing here touches payroll.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── attendance.source ──────────────────────────────────────────────────────
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_source_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_source_check
  CHECK (source IS NULL OR source = 'employee_link');

-- ─── attendance_links ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$'),
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  -- How many days before today the employee may pick. 0 = today only.
  days_back     smallint NOT NULL DEFAULT 0 CHECK (days_back BETWEEN 0 AND 7),
  -- Apply a submission at once when the day has no record. Off unless asked.
  auto_apply    boolean NOT NULL DEFAULT false,
  -- IANA name; validated by the application before it is written.
  time_zone     text NOT NULL CHECK (char_length(time_zone) BETWEEN 1 AND 64)
);

-- One live link per employee. «Make a new link» revokes the old one first.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_links_one_live
  ON public.attendance_links (workspace_id, employee_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.attendance_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_links FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.attendance_links TO service_role;

-- ─── attendance_submissions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_submissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id        uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  link_id            uuid NOT NULL REFERENCES public.attendance_links(id) ON DELETE CASCADE,
  date               date NOT NULL,
  status             text NOT NULL CHECK (status IN ('present', 'absent', 'leave')),
  check_in           time,
  check_out          time,
  note               text CHECK (note IS NULL OR char_length(note) <= 500),
  -- The server's clock, whatever time the employee typed.
  received_at        timestamptz NOT NULL DEFAULT now(),
  state              text NOT NULL DEFAULT 'pending'
                     CHECK (state IN ('pending', 'applied', 'approved', 'rejected')),
  decided_by         uuid,
  decided_at         timestamptz,
  decision_note      text CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
  -- Made once by the page per form fill; the same form sent twice is one row.
  client_request_id  uuid NOT NULL,
  CONSTRAINT attendance_submissions_once UNIQUE (link_id, client_request_id),
  CONSTRAINT attendance_submissions_times CHECK (
    (status = 'present' OR (check_in IS NULL AND check_out IS NULL))
    AND (check_out IS NULL OR check_in IS NOT NULL)
    AND (check_out IS NULL OR check_out > check_in)
  ),
  CONSTRAINT attendance_submissions_rejection_has_reason CHECK (
    state <> 'rejected' OR (decision_note IS NOT NULL AND btrim(decision_note) <> '')
  )
);

CREATE INDEX IF NOT EXISTS attendance_submissions_day_idx
  ON public.attendance_submissions (workspace_id, date, state);
CREATE INDEX IF NOT EXISTS attendance_submissions_employee_idx
  ON public.attendance_submissions (workspace_id, employee_id, date DESC);

ALTER TABLE public.attendance_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_submissions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.attendance_submissions TO service_role;

-- Append-only. What was sent never changes; only the decision is written, once.
CREATE OR REPLACE FUNCTION public.attendance_submissions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- A row goes only with its workspace, employee or link (a cascade runs
    -- inside the referential trigger, one level down). Never on its own.
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.link_id IS DISTINCT FROM OLD.link_id
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.check_in IS DISTINCT FROM OLD.check_in
     OR NEW.check_out IS DISTINCT FROM OLD.check_out
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id THEN
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  -- Forward only: pending → approved | rejected. Everything else is final.
  IF OLD.state <> 'pending' OR NEW.state NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_DECIDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_submissions_guard_trg ON public.attendance_submissions;
CREATE TRIGGER attendance_submissions_guard_trg
  BEFORE UPDATE OR DELETE ON public.attendance_submissions
  FOR EACH ROW EXECUTE FUNCTION public.attendance_submissions_guard();

-- ─── make a link (revoking the live one) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attendance_link_create(
  p_workspace   uuid,
  p_employee    uuid,
  p_user        uuid,
  p_token       text,
  p_expires_at  timestamptz,
  p_days_back   integer,
  p_auto_apply  boolean,
  p_time_zone   text
)
RETURNS SETOF public.attendance_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- An id is not proof of membership.
  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
     WHERE e.id = p_employee AND e.workspace_id = p_workspace
  ) THEN
    RAISE EXCEPTION 'ATTENDANCE_EMPLOYEE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Two managers pressing «new link» for the same person: one after the other,
  -- and the later link is the live one.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text || ':' || p_employee::text, 0));

  UPDATE public.attendance_links
     SET revoked_at = now()
   WHERE workspace_id = p_workspace
     AND employee_id = p_employee
     AND revoked_at IS NULL;

  RETURN QUERY
  INSERT INTO public.attendance_links
    (workspace_id, employee_id, token, created_by, expires_at, days_back, auto_apply, time_zone)
  VALUES
    (p_workspace, p_employee, p_token, p_user, p_expires_at,
     COALESCE(p_days_back, 0), COALESCE(p_auto_apply, false), p_time_zone)
  RETURNING *;
END;
$$;

-- ─── the employee sends a day ───────────────────────────────────────────────
-- The application has already checked the token, its expiry, the maker's
-- membership and the allowed dates. This is the atomic part: one submission
-- row, and — only when the link allows it and the day is empty — the record.
CREATE OR REPLACE FUNCTION public.attendance_submit(
  p_link               uuid,
  p_date               date,
  p_status             text,
  p_check_in           time,
  p_check_out          time,
  p_note               text,
  p_client_request_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link     public.attendance_links%ROWTYPE;
  v_existing public.attendance_submissions%ROWTYPE;
  v_in       time := CASE WHEN p_status = 'present' THEN p_check_in END;
  v_out      time := CASE WHEN p_status = 'present' THEN p_check_out END;
  v_state    text := 'pending';
  v_id       uuid;
BEGIN
  SELECT * INTO v_link
    FROM public.attendance_links
   WHERE id = p_link AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_LINK_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- The same form again: answer with what happened the first time.
  SELECT * INTO v_existing
    FROM public.attendance_submissions
   WHERE link_id = v_link.id AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('id', v_existing.id, 'state', v_existing.state, 'replayed', true);
  END IF;

  -- One at a time per employee and day, so «is the day empty» stays true
  -- until the record is written (the unique index of attendance-01 may not
  -- exist on a database with old duplicates).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_link.workspace_id::text || ':' || v_link.employee_id::text || ':' || p_date::text, 0)
  );

  IF v_link.auto_apply AND NOT EXISTS (
    SELECT 1 FROM public.attendance a
     WHERE a.workspace_id = v_link.workspace_id
       AND a.employee_id = v_link.employee_id
       AND a.date = p_date
  ) THEN
    INSERT INTO public.attendance
      (employee_id, date, check_in, check_out, status, notes, user_id, workspace_id, source)
    VALUES
      (v_link.employee_id, p_date, v_in, v_out, p_status, p_note,
       v_link.created_by, v_link.workspace_id, 'employee_link');
    v_state := 'applied';
  END IF;

  BEGIN
    INSERT INTO public.attendance_submissions
      (workspace_id, employee_id, link_id, date, status, check_in, check_out, note,
       state, client_request_id)
    VALUES
      (v_link.workspace_id, v_link.employee_id, v_link.id, p_date, p_status, v_in, v_out,
       p_note, v_state, p_client_request_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- The same form, sent twice at the same instant. Undo this attempt's
    -- record (the whole call rolls back) and let the caller read the winner.
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_REPLAY' USING ERRCODE = 'P0001';
  END;

  UPDATE public.attendance_links SET last_used_at = now() WHERE id = v_link.id;

  RETURN jsonb_build_object('id', v_id, 'state', v_state, 'replayed', false);
END;
$$;

-- ─── a manager decides ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attendance_submission_decide(
  p_workspace  uuid,
  p_id         uuid,
  p_user       uuid,
  p_decision   text,
  p_note       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row  public.attendance_submissions%ROWTYPE;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'ATTENDANCE_DECISION_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- The row lock is what makes two managers one decision.
  SELECT * INTO v_row
    FROM public.attendance_submissions
   WHERE id = p_id AND workspace_id = p_workspace
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.state <> 'pending' THEN
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_DECIDED' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision = 'reject' AND v_note IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_REJECTION_REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_decision = 'approve' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_row.workspace_id::text || ':' || v_row.employee_id::text || ':' || v_row.date::text, 0)
    );
    -- The day's record becomes what the employee sent. Update-then-insert,
    -- not ON CONFLICT: the unique index is not guaranteed to exist.
    UPDATE public.attendance
       SET status = v_row.status,
           check_in = v_row.check_in,
           check_out = v_row.check_out,
           notes = COALESCE(v_row.note, notes),
           source = 'employee_link',
           updated_at = now()
     WHERE id = (
       SELECT a.id FROM public.attendance a
        WHERE a.workspace_id = v_row.workspace_id
          AND a.employee_id = v_row.employee_id
          AND a.date = v_row.date
        ORDER BY a.id
        LIMIT 1
     );
    IF NOT FOUND THEN
      INSERT INTO public.attendance
        (employee_id, date, check_in, check_out, status, notes, user_id, workspace_id, source)
      VALUES
        (v_row.employee_id, v_row.date, v_row.check_in, v_row.check_out, v_row.status,
         v_row.note, p_user, v_row.workspace_id, 'employee_link');
    END IF;
  END IF;

  UPDATE public.attendance_submissions
     SET state = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
         decided_by = p_user,
         decided_at = now(),
         decision_note = v_note
   WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'state', CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
    'employeeId', v_row.employee_id,
    'date', v_row.date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_submissions_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_link_create(uuid, uuid, uuid, text, timestamptz, integer, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_submit(uuid, date, text, time, time, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_submission_decide(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_link_create(uuid, uuid, uuid, text, timestamptz, integer, boolean, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_submit(uuid, date, text, time, time, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_submission_decide(uuid, uuid, uuid, text, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the links and what employees sent through them. Attendance records
-- that came from a submission stay; only the mark that says so goes.
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.attendance_submission_decide(uuid, uuid, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.attendance_submit(uuid, date, text, time, time, text, uuid);
--   DROP FUNCTION IF EXISTS public.attendance_link_create(uuid, uuid, uuid, text, timestamptz, integer, boolean, text);
--   DROP TABLE IF EXISTS public.attendance_submissions;
--   DROP FUNCTION IF EXISTS public.attendance_submissions_guard();
--   DROP TABLE IF EXISTS public.attendance_links;
--   ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_source_check;
--   ALTER TABLE public.attendance DROP COLUMN IF EXISTS source;
--   COMMIT;
--
-- VERIFY: docs/VERIFY-attendance-self-01.sql
-- ============================================================================
