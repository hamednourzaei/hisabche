-- ============================================================================
-- attendance-02 — night shifts, the phone as a terminal, and held readings
-- ============================================================================
-- Run AFTER, in this order:
--   work-shifts-01 · shift-assignments-01 (optional — see «night» below)
--   attendance-self-01 · attendance-devices-01
--
-- Additive and idempotent: safe to run twice. Nothing is deleted or rewritten.
--
-- 1. NIGHT. A working day belongs to the date it STARTED on. A record whose
--    exit is on the following calendar day says so in a column of its own
--    (`ends_next_day`) — an exit earlier than the arrival WITHOUT that mark is
--    still a typing error, exactly as before. Nothing infers a night from the
--    times alone.
--
--    A terminal's reading after midnight counts toward the previous day ONLY
--    when the employee was planned, on that previous day, for a shift that
--    crosses midnight (shift_assignments) and the reading is no later than
--    three hours after that shift's planned end. Without such a plan a
--    reading belongs to its own calendar day, as in attendance-devices-01.
--    If shift-assignments-01 was never run, that is every reading.
--
-- 2. THE PHONE. A link may require that each submission is confirmed by the
--    phone's own screen lock (fingerprint, face or the phone's PIN — whichever
--    the phone offers). What is stored is a PUBLIC KEY the phone made for this
--    employee. No fingerprint, no face, no image ever leaves the phone, and
--    nothing here could hold one. The signature is checked by the application;
--    the database refuses a submission that claims no proof on a link that
--    requires one.
--
-- 3. HELD. A reading kept back because a person had already recorded that day
--    can be accepted by a manager: the day then becomes what the terminal saw.
--    That is the only way out of «held», and it is a person's decision.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.attendance_submissions') IS NULL THEN
    RAISE EXCEPTION 'Run docs/attendance-self-01-migration.sql first.';
  END IF;
  IF to_regclass('public.attendance_terminal_events') IS NULL THEN
    RAISE EXCEPTION 'Run docs/attendance-devices-01-migration.sql first.';
  END IF;
END $$;

-- ═══ 1. night ═══════════════════════════════════════════════════════════════

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS ends_next_day boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_ends_next_day_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_ends_next_day_check CHECK (
    NOT ends_next_day
    OR (check_in IS NOT NULL AND check_out IS NOT NULL AND check_out < check_in)
  );

ALTER TABLE public.attendance_submissions
  ADD COLUMN IF NOT EXISTS ends_next_day boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance_submissions
  ADD COLUMN IF NOT EXISTS proof text;
ALTER TABLE public.attendance_submissions DROP CONSTRAINT IF EXISTS attendance_submissions_proof_check;
ALTER TABLE public.attendance_submissions
  ADD CONSTRAINT attendance_submissions_proof_check
  CHECK (proof IS NULL OR proof = 'device_unlock');
ALTER TABLE public.attendance_submissions DROP CONSTRAINT IF EXISTS attendance_submissions_times;
ALTER TABLE public.attendance_submissions
  ADD CONSTRAINT attendance_submissions_times CHECK (
    (status = 'present' OR (check_in IS NULL AND check_out IS NULL))
    AND (check_out IS NULL OR check_in IS NOT NULL)
    AND (NOT ends_next_day OR check_out IS NOT NULL)
    AND (
      check_out IS NULL
      OR (ends_next_day AND check_out < check_in)
      OR (NOT ends_next_day AND check_out > check_in)
    )
  );

-- What was sent never changes — now including the two new facts about it.
CREATE OR REPLACE FUNCTION public.attendance_submissions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
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
     OR NEW.ends_next_day IS DISTINCT FROM OLD.ends_next_day
     OR NEW.proof IS DISTINCT FROM OLD.proof
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.time_zone IS DISTINCT FROM OLD.time_zone
     OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id THEN
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.state <> 'pending' OR NEW.state NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_DECIDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ─── shifts may cross midnight ──────────────────────────────────────────────
-- `ends_at < starts_at` now means «ends the next day». Equal times stay refused:
-- a shift of zero hours and one of twenty-four cannot be told apart.
DO $$
BEGIN
  IF to_regclass('public.work_shifts') IS NOT NULL THEN
    ALTER TABLE public.work_shifts DROP CONSTRAINT IF EXISTS work_shifts_ends_after_start;
    ALTER TABLE public.work_shifts DROP CONSTRAINT IF EXISTS work_shifts_times_differ;
    ALTER TABLE public.work_shifts
      ADD CONSTRAINT work_shifts_times_differ CHECK (ends_at <> starts_at);
    ALTER TABLE public.work_shifts DROP CONSTRAINT IF EXISTS work_shifts_break_shorter_than_shift;
    ALTER TABLE public.work_shifts
      ADD CONSTRAINT work_shifts_break_shorter_than_shift CHECK (
        break_minutes < EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60
                        + CASE WHEN ends_at < starts_at THEN 1440 ELSE 0 END
      );
  END IF;
END $$;

-- A plan that crosses midnight can collide with the day before and the day
-- after, so the overlap is judged on real moments, not on times of one day.
DO $$
BEGIN
  IF to_regclass('public.shift_assignments') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.shift_assignments_before_insert()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public
      AS $body$
      DECLARE
        v_shift public.work_shifts%ROWTYPE;
        v_from  timestamp;
        v_to    timestamp;
        v_day   date;
      BEGIN
        SELECT * INTO v_shift
          FROM public.work_shifts
         WHERE id = NEW.shift_id AND workspace_id = NEW.workspace_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'SHIFT_ASSIGNMENT_SHIFT_NOT_FOUND';
        END IF;
        IF NOT v_shift.is_active THEN
          RAISE EXCEPTION 'SHIFT_ASSIGNMENT_SHIFT_RETIRED';
        END IF;

        NEW.shift_name   := v_shift.name;
        NEW.starts_at    := v_shift.starts_at;
        NEW.ends_at      := v_shift.ends_at;
        NEW.is_cancelled := false;
        NEW.cancelled_by := NULL;
        NEW.cancelled_at := NULL;

        -- The three days this plan can touch, always in the same order.
        FOR v_day IN SELECT generate_series(NEW.work_date - 1, NEW.work_date + 1, interval '1 day')::date LOOP
          PERFORM pg_advisory_xact_lock(
            hashtextextended(NEW.workspace_id::text || ':' || NEW.employee_id::text || ':' || v_day::text, 0)
          );
        END LOOP;

        v_from := NEW.work_date + NEW.starts_at;
        v_to   := NEW.work_date + NEW.ends_at
                  + CASE WHEN NEW.ends_at < NEW.starts_at THEN interval '1 day' ELSE interval '0' END;

        IF EXISTS (
          SELECT 1 FROM public.shift_assignments other
           WHERE other.workspace_id = NEW.workspace_id
             AND other.employee_id  = NEW.employee_id
             AND other.work_date BETWEEN NEW.work_date - 1 AND NEW.work_date + 1
             AND NOT other.is_cancelled
             AND (other.work_date + other.starts_at) < v_to
             AND v_from < (other.work_date + other.ends_at
                           + CASE WHEN other.ends_at < other.starts_at
                                  THEN interval '1 day' ELSE interval '0' END)
        ) THEN
          RAISE EXCEPTION 'SHIFT_ASSIGNMENT_OVERLAP';
        END IF;

        RETURN NEW;
      END;
      $body$
    $fn$;
  END IF;
END $$;

-- ─── which working day a reading counts toward ──────────────────────────────
ALTER TABLE public.attendance_terminal_events ADD COLUMN IF NOT EXISTS work_day date;
-- Until now a reading always counted toward its own calendar day; this writes
-- down exactly that. (The guard is replaced below, before any later change.)
ALTER TABLE public.attendance_terminal_events DISABLE TRIGGER attendance_terminal_events_guard_trg;
UPDATE public.attendance_terminal_events SET work_day = occurred_on WHERE work_day IS NULL;
ALTER TABLE public.attendance_terminal_events ENABLE TRIGGER attendance_terminal_events_guard_trg;
ALTER TABLE public.attendance_terminal_events ALTER COLUMN work_day SET NOT NULL;

CREATE INDEX IF NOT EXISTS attendance_terminal_events_work_day_idx
  ON public.attendance_terminal_events (workspace_id, employee_id, work_day);
CREATE INDEX IF NOT EXISTS attendance_terminal_events_held_idx
  ON public.attendance_terminal_events (workspace_id, work_day)
  WHERE state = 'held';

CREATE OR REPLACE FUNCTION public.attendance_terminal_events_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.device_id IS DISTINCT FROM OLD.device_id
     OR NEW.raw_event_id IS DISTINCT FROM OLD.raw_event_id
     OR NEW.external_user_id IS DISTINCT FROM OLD.external_user_id
     OR NEW.occurred_on IS DISTINCT FROM OLD.occurred_on
     OR NEW.occurred_time IS DISTINCT FROM OLD.occurred_time
     OR NEW.time_zone IS DISTINCT FROM OLD.time_zone
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.method IS DISTINCT FROM OLD.method
     OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.received_at IS DISTINCT FROM OLD.received_at THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.employee_id IS NOT NULL AND NEW.employee_id IS NOT NULL
     AND NEW.employee_id <> OLD.employee_id THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  -- The working day is decided when the reading gets its person, and then stays.
  IF NEW.work_day IS DISTINCT FROM OLD.work_day AND OLD.state <> 'unmatched' THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  -- Settled is final — except a held reading, which a manager may accept.
  IF OLD.state IN ('applied', 'duplicate') AND NEW.state <> OLD.state THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_SETTLED' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.state = 'held' AND NEW.state NOT IN ('held', 'applied') THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_SETTLED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_device_work_day(
  p_workspace  uuid,
  p_employee   uuid,
  p_day        date,
  p_at         time
)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_end  time;
  v_gap  numeric;
BEGIN
  IF to_regclass('public.shift_assignments') IS NULL THEN
    RETURN p_day;
  END IF;

  -- Was this person planned, yesterday, for a shift that crosses midnight?
  SELECT s.ends_at INTO v_end
    FROM public.shift_assignments s
   WHERE s.workspace_id = p_workspace
     AND s.employee_id = p_employee
     AND s.work_date = p_day - 1
     AND NOT s.is_cancelled
     AND s.ends_at < s.starts_at
   ORDER BY s.ends_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN p_day;
  END IF;

  -- Seconds after that shift's planned end (negative = before it).
  v_gap := EXTRACT(EPOCH FROM (p_at - v_end));
  IF v_gap > 3 * 3600 THEN
    RETURN p_day;
  END IF;

  -- A shift planned for today that starts nearer to this reading than last
  -- night's ended has the better claim to it.
  IF EXISTS (
    SELECT 1 FROM public.shift_assignments n
     WHERE n.workspace_id = p_workspace
       AND n.employee_id = p_employee
       AND n.work_date = p_day
       AND NOT n.is_cancelled
       AND abs(EXTRACT(EPOCH FROM (n.starts_at - p_at))) < abs(v_gap)
  ) THEN
    RETURN p_day;
  END IF;

  RETURN p_day - 1;
END;
$$;

-- ─── settle one working day of one person ───────────────────────────────────
DROP FUNCTION IF EXISTS public.attendance_device_settle(uuid, uuid, date, uuid);
CREATE OR REPLACE FUNCTION public.attendance_device_settle(
  p_workspace  uuid,
  p_employee   uuid,
  p_day        date,
  p_actor      uuid,
  p_accept     boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id      uuid;
  v_source  text;
  v_found   boolean;
  v_in_at   timestamp;
  v_out_at  timestamp;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_workspace::text || ':' || p_employee::text || ':' || p_day::text, 0)
  );

  SELECT a.id, a.source INTO v_id, v_source
    FROM public.attendance a
   WHERE a.workspace_id = p_workspace AND a.employee_id = p_employee AND a.date = p_day
   ORDER BY a.id
   LIMIT 1;
  v_found := FOUND;

  -- A person recorded this day. The device does not get to change it —
  -- unless a manager has just said it should.
  IF v_found AND v_source IS DISTINCT FROM 'device' AND NOT COALESCE(p_accept, false) THEN
    UPDATE public.attendance_terminal_events
       SET state = 'held', settled_at = now()
     WHERE workspace_id = p_workspace AND employee_id = p_employee
       AND work_day = p_day AND state = 'new';
    RETURN 'held';
  END IF;

  UPDATE public.attendance_terminal_events
     SET state = 'applied', settled_at = now()
   WHERE workspace_id = p_workspace AND employee_id = p_employee
     AND work_day = p_day
     AND (state = 'new' OR (COALESCE(p_accept, false) AND state = 'held'));

  -- Earliest reading that is not an exit; latest reading that is not an entry
  -- — as moments, because the working day may run past midnight.
  SELECT MIN(e.occurred_on + e.occurred_time) FILTER (WHERE e.direction <> 'out'),
         MAX(e.occurred_on + e.occurred_time) FILTER (WHERE e.direction <> 'in')
    INTO v_in_at, v_out_at
    FROM public.attendance_terminal_events e
   WHERE e.workspace_id = p_workspace AND e.employee_id = p_employee
     AND e.work_day = p_day AND e.state = 'applied';

  -- A lone reading is an arrival, not an arrival and a departure a second apart.
  IF v_in_at IS NOT NULL AND v_out_at IS NOT NULL
     AND v_out_at <= v_in_at + interval '60 seconds' THEN
    v_out_at := NULL;
  END IF;
  -- A departure a whole day after the arrival cannot be written as a time of
  -- day. The day stays open rather than claiming an hour it was not.
  IF v_in_at IS NOT NULL AND v_out_at IS NOT NULL AND v_out_at >= v_in_at + interval '24 hours' THEN
    v_out_at := NULL;
  END IF;

  IF v_found THEN
    UPDATE public.attendance
       SET status = 'present',
           check_in = v_in_at::time,
           check_out = v_out_at::time,
           ends_next_day = COALESCE(v_out_at::date > v_in_at::date, false),
           source = 'device',
           updated_at = now()
     WHERE id = v_id;
  ELSE
    INSERT INTO public.attendance
      (employee_id, date, check_in, check_out, ends_next_day, status, user_id, workspace_id, source)
    VALUES
      (p_employee, p_day, v_in_at::time, v_out_at::time,
       COALESCE(v_out_at::date > v_in_at::date, false), 'present', p_actor, p_workspace, 'device');
  END IF;

  RETURN 'applied';
END;
$$;

-- ─── a batch arrives ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attendance_device_ingest(
  p_device     uuid,
  p_time_zone  text,
  p_events     jsonb,
  p_cursor     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dev        public.attendance_terminals%ROWTYPE;
  r            record;
  v_emp        uuid;
  v_state      text;
  v_work       date;
  v_rows       integer;
  v_received   integer := 0;
  v_redelivered integer := 0;
  v_unmatched  integer := 0;
  v_duplicate  integer := 0;
  v_applied    integer := 0;
  v_held       integer := 0;
  v_days       jsonb := '[]'::jsonb;
  v_day        record;
  v_outcome    text;
  v_n          integer;
BEGIN
  SELECT * INTO v_dev
    FROM public.attendance_terminals
   WHERE id = p_device AND revoked_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  FOR r IN
    SELECT *
      FROM jsonb_to_recordset(COALESCE(p_events, '[]'::jsonb))
           AS e(raw_id text, user_id text, day date, at time, direction text, method text, payload jsonb)
     ORDER BY e.day, e.at, e.raw_id
  LOOP
    v_received := v_received + 1;

    v_emp := NULL;
    SELECT i.employee_id INTO v_emp
      FROM public.attendance_terminal_identities i
     WHERE i.workspace_id = v_dev.workspace_id
       AND i.external_user_id = r.user_id
       AND (i.device_id = v_dev.id OR i.device_id IS NULL)
     ORDER BY (i.device_id IS NULL)
     LIMIT 1;

    v_work := r.day;
    IF v_emp IS NULL THEN
      v_state := 'unmatched';
    ELSE
      v_work := public.attendance_device_work_day(v_dev.workspace_id, v_emp, r.day, r.at);
      IF EXISTS (
        SELECT 1 FROM public.attendance_terminal_events x
         WHERE x.workspace_id = v_dev.workspace_id
           AND x.employee_id = v_emp
           AND x.occurred_on = r.day
           AND x.state IN ('new', 'applied', 'held')
           AND abs(extract(epoch FROM (x.occurred_time - r.at))) < 60
      ) THEN
        v_state := 'duplicate';
      ELSE
        v_state := 'new';
      END IF;
    END IF;

    INSERT INTO public.attendance_terminal_events
      (workspace_id, device_id, raw_event_id, external_user_id, occurred_on, occurred_time,
       work_day, time_zone, direction, method, payload, employee_id, state, settled_at)
    VALUES
      (v_dev.workspace_id, v_dev.id, r.raw_id, r.user_id, r.day, r.at, v_work, p_time_zone,
       COALESCE(r.direction, 'unknown'), COALESCE(r.method, 'UNKNOWN'), r.payload, v_emp, v_state,
       CASE WHEN v_state = 'duplicate' THEN now() END)
    ON CONFLICT (device_id, raw_event_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      v_redelivered := v_redelivered + 1;
    ELSIF v_state = 'unmatched' THEN
      v_unmatched := v_unmatched + 1;
    ELSIF v_state = 'duplicate' THEN
      v_duplicate := v_duplicate + 1;
    ELSE
      v_days := v_days || jsonb_build_object('e', v_emp, 'd', v_work);
    END IF;
  END LOOP;

  FOR v_day IN
    SELECT DISTINCT (x->>'e')::uuid AS employee_id, (x->>'d')::date AS day
      FROM jsonb_array_elements(v_days) AS x
     ORDER BY 2, 1
  LOOP
    SELECT COUNT(*) INTO v_n
      FROM public.attendance_terminal_events
     WHERE workspace_id = v_dev.workspace_id AND employee_id = v_day.employee_id
       AND work_day = v_day.day AND state = 'new';
    v_outcome := public.attendance_device_settle(
      v_dev.workspace_id, v_day.employee_id, v_day.day, v_dev.created_by, false
    );
    IF v_outcome = 'applied' THEN v_applied := v_applied + v_n; ELSE v_held := v_held + v_n; END IF;
  END LOOP;

  UPDATE public.attendance_terminals
     SET last_seen_at = now(),
         last_event_at = CASE WHEN v_received > v_redelivered THEN now() ELSE last_event_at END,
         sync_cursor = COALESCE(p_cursor, sync_cursor)
   WHERE id = v_dev.id;

  RETURN jsonb_build_object(
    'received', v_received,
    'redelivered', v_redelivered,
    'unmatched', v_unmatched,
    'duplicate', v_duplicate,
    'applied', v_applied,
    'held', v_held
  );
END;
$$;

-- ─── a number on a device is given a person ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.attendance_device_reprocess(
  p_workspace  uuid,
  p_device     uuid,
  p_user_id    text,
  p_actor      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp      uuid;
  r          record;
  v_state    text;
  v_work     date;
  v_matched  integer := 0;
  v_applied  integer := 0;
  v_held     integer := 0;
  v_duplicate integer := 0;
  v_days     date[] := '{}';
  v_one      date;
  v_n        integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance_terminals d WHERE d.id = p_device AND d.workspace_id = p_workspace
  ) THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT i.employee_id INTO v_emp
    FROM public.attendance_terminal_identities i
   WHERE i.workspace_id = p_workspace
     AND i.external_user_id = p_user_id
     AND (i.device_id = p_device OR i.device_id IS NULL)
   ORDER BY (i.device_id IS NULL)
   LIMIT 1;
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('matched', 0, 'applied', 0, 'held', 0, 'duplicate', 0);
  END IF;

  FOR r IN
    SELECT e.id, e.occurred_on, e.occurred_time
      FROM public.attendance_terminal_events e
     WHERE e.workspace_id = p_workspace AND e.device_id = p_device
       AND e.external_user_id = p_user_id AND e.state = 'unmatched'
     ORDER BY e.occurred_on, e.occurred_time, e.id
     FOR UPDATE
  LOOP
    v_matched := v_matched + 1;
    v_work := public.attendance_device_work_day(p_workspace, v_emp, r.occurred_on, r.occurred_time);
    IF EXISTS (
      SELECT 1 FROM public.attendance_terminal_events x
       WHERE x.workspace_id = p_workspace AND x.employee_id = v_emp
         AND x.occurred_on = r.occurred_on AND x.id <> r.id
         AND x.state IN ('new', 'applied', 'held')
         AND abs(extract(epoch FROM (x.occurred_time - r.occurred_time))) < 60
    ) THEN
      v_state := 'duplicate';
      v_duplicate := v_duplicate + 1;
    ELSE
      v_state := 'new';
      IF NOT (v_work = ANY (v_days)) THEN
        v_days := array_append(v_days, v_work);
      END IF;
    END IF;
    UPDATE public.attendance_terminal_events
       SET employee_id = v_emp, state = v_state, work_day = v_work,
           settled_at = CASE WHEN v_state = 'duplicate' THEN now() END
     WHERE id = r.id;
  END LOOP;

  FOREACH v_one IN ARRAY v_days LOOP
    SELECT COUNT(*) INTO v_n
      FROM public.attendance_terminal_events
     WHERE workspace_id = p_workspace AND employee_id = v_emp
       AND work_day = v_one AND state = 'new';
    IF public.attendance_device_settle(p_workspace, v_emp, v_one, p_actor, false) = 'applied' THEN
      v_applied := v_applied + v_n;
    ELSE
      v_held := v_held + v_n;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'matched', v_matched, 'applied', v_applied, 'held', v_held, 'duplicate', v_duplicate
  );
END;
$$;

-- ═══ 3. a manager accepts what a terminal saw ═══════════════════════════════
CREATE OR REPLACE FUNCTION public.attendance_device_accept_held(
  p_workspace  uuid,
  p_employee   uuid,
  p_day        date,
  p_actor      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n integer;
BEGIN
  -- Taken here too, so the count and the settle see one state.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_workspace::text || ':' || p_employee::text || ':' || p_day::text, 0)
  );
  SELECT COUNT(*) INTO v_n
    FROM public.attendance_terminal_events
   WHERE workspace_id = p_workspace AND employee_id = p_employee
     AND work_day = p_day AND state = 'held';
  IF v_n = 0 THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_NOTHING_HELD' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.attendance_device_settle(p_workspace, p_employee, p_day, p_actor, true);
  RETURN jsonb_build_object('accepted', v_n);
END;
$$;

-- ═══ 2. the phone ═══════════════════════════════════════════════════════════
ALTER TABLE public.attendance_links
  ADD COLUMN IF NOT EXISTS require_unlock boolean NOT NULL DEFAULT false;

-- One live key per employee: the phone that was registered first. It outlives
-- a replaced link, and only a manager can clear it.
CREATE TABLE IF NOT EXISTS public.attendance_phone_keys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  credential_id  text NOT NULL CHECK (
                   credential_id ~ '^[A-Za-z0-9_-]+$' AND char_length(credential_id) BETWEEN 16 AND 1400
                 ),
  -- A public key (SubjectPublicKeyInfo, base64url). Not a secret, not a body.
  public_key     text NOT NULL CHECK (
                   public_key ~ '^[A-Za-z0-9_-]+$' AND char_length(public_key) BETWEEN 40 AND 2000
                 ),
  algorithm      integer NOT NULL CHECK (algorithm IN (-7, -257)),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz,
  revoked_by     uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_phone_keys_one_live
  ON public.attendance_phone_keys (workspace_id, employee_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.attendance_phone_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_phone_keys FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.attendance_phone_keys TO service_role;

DROP FUNCTION IF EXISTS public.attendance_link_create(uuid, uuid, uuid, text, timestamptz, integer, boolean);
CREATE OR REPLACE FUNCTION public.attendance_link_create(
  p_workspace       uuid,
  p_employee        uuid,
  p_user            uuid,
  p_token           text,
  p_expires_at      timestamptz,
  p_days_back       integer,
  p_auto_apply      boolean,
  p_require_unlock  boolean
)
RETURNS SETOF public.attendance_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
     WHERE e.id = p_employee AND e.workspace_id = p_workspace
  ) THEN
    RAISE EXCEPTION 'ATTENDANCE_EMPLOYEE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text || ':' || p_employee::text, 0));

  UPDATE public.attendance_links
     SET revoked_at = now()
   WHERE workspace_id = p_workspace
     AND employee_id = p_employee
     AND revoked_at IS NULL;

  RETURN QUERY
  INSERT INTO public.attendance_links
    (workspace_id, employee_id, token, created_by, expires_at, days_back, auto_apply, require_unlock)
  VALUES
    (p_workspace, p_employee, p_token, p_user, p_expires_at,
     COALESCE(p_days_back, 0), COALESCE(p_auto_apply, false), COALESCE(p_require_unlock, false))
  RETURNING *;
END;
$$;

DROP FUNCTION IF EXISTS public.attendance_submit(uuid, date, text, time, time, text, uuid, text);
CREATE OR REPLACE FUNCTION public.attendance_submit(
  p_link               uuid,
  p_date               date,
  p_status             text,
  p_check_in           time,
  p_check_out          time,
  p_ends_next_day      boolean,
  p_note               text,
  p_client_request_id  uuid,
  p_time_zone          text,
  p_proof              text
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
  v_next     boolean := p_status = 'present' AND p_check_out IS NOT NULL
                        AND COALESCE(p_ends_next_day, false);
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

  SELECT * INTO v_existing
    FROM public.attendance_submissions
   WHERE link_id = v_link.id AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('id', v_existing.id, 'state', v_existing.state, 'replayed', true);
  END IF;

  -- The application checks the signature. This is the backstop: a caller that
  -- forgot to cannot write an unproven day on a link that asks for proof.
  IF v_link.require_unlock AND p_proof IS DISTINCT FROM 'device_unlock' THEN
    RAISE EXCEPTION 'ATTENDANCE_UNLOCK_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

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
      (employee_id, date, check_in, check_out, ends_next_day, status, notes, user_id,
       workspace_id, source)
    VALUES
      (v_link.employee_id, p_date, v_in, v_out, v_next, p_status, p_note,
       v_link.created_by, v_link.workspace_id, 'employee_link');
    v_state := 'applied';
  END IF;

  BEGIN
    INSERT INTO public.attendance_submissions
      (workspace_id, employee_id, link_id, date, status, check_in, check_out, ends_next_day,
       note, state, client_request_id, time_zone, proof)
    VALUES
      (v_link.workspace_id, v_link.employee_id, v_link.id, p_date, p_status, v_in, v_out, v_next,
       p_note, v_state, p_client_request_id, p_time_zone, p_proof)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ATTENDANCE_SUBMISSION_REPLAY' USING ERRCODE = 'P0001';
  END;

  UPDATE public.attendance_links SET last_used_at = now() WHERE id = v_link.id;

  RETURN jsonb_build_object('id', v_id, 'state', v_state, 'replayed', false);
END;
$$;

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
    UPDATE public.attendance
       SET status = v_row.status,
           check_in = v_row.check_in,
           check_out = v_row.check_out,
           ends_next_day = v_row.ends_next_day,
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
        (employee_id, date, check_in, check_out, ends_next_day, status, notes, user_id,
         workspace_id, source)
      VALUES
        (v_row.employee_id, v_row.date, v_row.check_in, v_row.check_out, v_row.ends_next_day,
         v_row.status, v_row.note, p_user, v_row.workspace_id, 'employee_link');
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

-- ─── who may run what ───────────────────────────────────────────────────────
-- Inner steps and trigger functions are nobody's entry point — service_role
-- included (on Supabase a new function is born executable by it).
REVOKE ALL ON FUNCTION public.attendance_submissions_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.attendance_terminal_events_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.attendance_device_work_day(uuid, uuid, date, time)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.attendance_device_settle(uuid, uuid, date, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.attendance_device_ingest(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_device_reprocess(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_device_accept_held(uuid, uuid, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_link_create(uuid, uuid, uuid, text, timestamptz, integer, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_submit(uuid, date, text, time, time, boolean, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_submission_decide(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.attendance_device_ingest(uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_device_reprocess(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_device_accept_held(uuid, uuid, date, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_link_create(uuid, uuid, uuid, text, timestamptz, integer, boolean, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_submit(uuid, date, text, time, time, boolean, text, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_submission_decide(uuid, uuid, uuid, text, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Nothing here removes or rewrites a row, so the mitigation for a problem is
-- to leave the schema and fix forward. To remove the additions entirely (the
-- two earlier files refuse to run while attendance.ends_next_day exists, so
-- that column goes first — after deciding what the night records should say):
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.attendance_device_accept_held(uuid, uuid, date, uuid);
--   DROP FUNCTION IF EXISTS public.attendance_submit(uuid, date, text, time, time, boolean, text, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.attendance_link_create(uuid, uuid, uuid, text, timestamptz, integer, boolean, boolean);
--   DROP FUNCTION IF EXISTS public.attendance_device_settle(uuid, uuid, date, uuid, boolean);
--   DROP FUNCTION IF EXISTS public.attendance_device_work_day(uuid, uuid, date, time);
--   DROP TABLE IF EXISTS public.attendance_phone_keys;
--   ALTER TABLE public.attendance_links DROP COLUMN IF EXISTS require_unlock;
--   ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_ends_next_day_check;
--   ALTER TABLE public.attendance DROP COLUMN IF EXISTS ends_next_day;
--   COMMIT;
--   -- then run attendance-self-01 and attendance-devices-01 again: they put
--   -- back the earlier functions, guards and the submissions' time constraint
--   -- (which fails while a night submission exists — decide about those first).
--   -- Left in place, harmlessly: attendance_submissions.ends_next_day / proof,
--   -- attendance_terminal_events.work_day, work_shifts_times_differ.
--
-- VERIFY: docs/VERIFY-attendance-02.sql
-- ============================================================================
