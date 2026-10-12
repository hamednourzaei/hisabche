-- ============================================================================
-- ATTENDANCE DEVICES — 01. Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    Run AFTER docs/attendance-self-01-migration.sql (it adds attendance.source
--    and the workplace time zones). Then run docs/VERIFY-attendance-devices-01.sql.
--
-- The brand-independent core for fingerprint / face / card terminals.
--
--   a device (or a small program beside it) ──► POST /api/public/attendance-devices/events
--        «user 182 was seen at 08:03 on the 12th»
--
-- What this script holds is everything that is the SAME for every brand:
--
--   attendance_terminals             the registry: a name, where it is, a key, its health
--   attendance_terminal_identities   «user 182 on this device» = this employee
--   attendance_terminal_events       append-only: every event as it arrived, and what became of it
--
-- What is NOT here, on purpose:
--   · no fingerprint or face template is ever stored or sent — only «who, when»
--   · no enrolling people ONTO a device (a separate, more sensitive capability)
--   · no brand-specific protocol; a brand is a label on the device row
--
-- THE RULES (in the functions below, so they hold for every caller)
--   1. The same event delivered twice is one event  (device_id + raw_event_id).
--   2. A user the business has not mapped to an employee is kept as «unmatched»,
--      never guessed; mapping them later settles what was waiting.
--   3. Two readings of one person within a minute (a fingerprint and then a
--      face, or a double tap) are one arrival: the second is «duplicate».
--   4. The day's record is the earliest reading (in) and the latest (out).
--      A lone reading is a check-in with no check-out — an open day, no hours.
--   5. ⚠️ A device never overwrites a day a PERSON recorded (on the sheet or
--      through their link). Those events are kept as «held» for a manager.
--   6. Nothing here touches payroll.
-- ============================================================================

-- ⚠️ NAMES. docs/attendance-workforce-migration.sql (older, already run on the
-- live database) owns tables called attendance_devices and
-- attendance_device_events, in another shape. This file does not use, alter
-- or drop them: its tables are attendance_terminals,
-- attendance_terminal_identities and attendance_terminal_events.

BEGIN;

-- attendance-02 replaces functions and constraints of this file. Running this
-- file again after it would put the older ones back, so it refuses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'ends_next_day'
  ) THEN
    RAISE EXCEPTION 'attendance-02 has been applied: this file must not be run again. Run docs/attendance-02-migration.sql instead (it is safe to repeat).';
  END IF;
END $$;

SET LOCAL lock_timeout = '5s';

-- attendance.source gains 'device'.
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_source_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_source_check
  CHECK (source IS NULL OR source IN ('employee_link', 'device'));

-- ─── the registry ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_terminals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- Labels a person typed. They select nothing: no code branches on a brand.
  vendor          text CHECK (vendor IS NULL OR char_length(vendor) <= 60),
  model           text CHECK (model IS NULL OR char_length(model) <= 60),
  -- What the terminal can read. A closed vocabulary; UNKNOWN is allowed.
  capabilities    text[] NOT NULL DEFAULT '{}'
                  CHECK (capabilities <@ ARRAY['FINGERPRINT','FACE','CARD','PIN','QR','PALM','IRIS','PASSWORD','UNKNOWN']::text[]),
  -- The device's own zone, if it differs from its branch / business. NULL =
  -- inherit. Validated by the application before it is written.
  time_zone       text CHECK (time_zone IS NULL OR char_length(time_zone) BETWEEN 1 AND 64),
  -- sha-256 of the key, hex. The key itself is shown once and never stored.
  key_hash        text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  -- The first characters of the key, so a person can tell two keys apart.
  key_prefix      text NOT NULL CHECK (char_length(key_prefix) BETWEEN 4 AND 16),
  -- Opaque to us: wherever the sender says it has read up to.
  sync_cursor     text CHECK (sync_cursor IS NULL OR char_length(sync_cursor) <= 500),
  last_seen_at    timestamptz,
  last_event_at   timestamptz,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz
);

CREATE INDEX IF NOT EXISTS attendance_terminals_workspace_idx
  ON public.attendance_terminals (workspace_id, created_at DESC);

ALTER TABLE public.attendance_terminals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_terminals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.attendance_terminals TO service_role;

-- ─── who is who on a device ─────────────────────────────────────────────────
-- device_id NULL = «this number means this person on every device of the
-- business». A mapping for one device wins over it.
CREATE TABLE IF NOT EXISTS public.attendance_terminal_identities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  device_id         uuid REFERENCES public.attendance_terminals(id) ON DELETE CASCADE,
  external_user_id  text NOT NULL CHECK (char_length(external_user_id) BETWEEN 1 AND 64),
  employee_id       uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_by        uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_terminal_identities_one
  ON public.attendance_terminal_identities (
    workspace_id,
    COALESCE(device_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_user_id
  );

ALTER TABLE public.attendance_terminal_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_terminal_identities FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.attendance_terminal_identities TO service_role;

-- ─── every event, as it arrived ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_terminal_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  device_id         uuid NOT NULL REFERENCES public.attendance_terminals(id) ON DELETE CASCADE,
  -- The device's own id for the event, or a hash of its content.
  raw_event_id      text NOT NULL CHECK (char_length(raw_event_id) BETWEEN 1 AND 128),
  external_user_id  text NOT NULL CHECK (char_length(external_user_id) BETWEEN 1 AND 64),
  -- The wall clock where the device is, and the zone that clock was read in.
  occurred_on       date NOT NULL,
  occurred_time     time NOT NULL,
  time_zone         text NOT NULL CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  direction         text NOT NULL DEFAULT 'unknown' CHECK (direction IN ('in', 'out', 'unknown')),
  method            text NOT NULL DEFAULT 'UNKNOWN'
                    CHECK (method IN ('FINGERPRINT','FACE','CARD','PIN','QR','PALM','IRIS','PASSWORD','UNKNOWN')),
  -- What the sender sent for this event, untouched. Never a biometric template:
  -- the application refuses a payload that carries one.
  payload           jsonb,
  received_at       timestamptz NOT NULL DEFAULT now(),
  employee_id       uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  state             text NOT NULL
                    CHECK (state IN ('unmatched', 'new', 'duplicate', 'applied', 'held')),
  settled_at        timestamptz,
  CONSTRAINT attendance_terminal_events_once UNIQUE (device_id, raw_event_id)
);

CREATE INDEX IF NOT EXISTS attendance_terminal_events_day_idx
  ON public.attendance_terminal_events (workspace_id, employee_id, occurred_on);
CREATE INDEX IF NOT EXISTS attendance_terminal_events_unmatched_idx
  ON public.attendance_terminal_events (device_id, external_user_id)
  WHERE state = 'unmatched';

ALTER TABLE public.attendance_terminal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_terminal_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.attendance_terminal_events TO service_role;

-- Append-only. What arrived never changes; only who it was and what became of it.
CREATE OR REPLACE FUNCTION public.attendance_terminal_events_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- A row goes only with its workspace or device (a cascade, one level down).
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

  -- An employee, once known, is not swapped for another (an employee row that
  -- is deleted sets it to NULL through the foreign key, which is allowed).
  IF OLD.employee_id IS NOT NULL AND NEW.employee_id IS NOT NULL
     AND NEW.employee_id <> OLD.employee_id THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_APPEND_ONLY' USING ERRCODE = 'P0001';
  END IF;

  -- Settled is final. Only what is still waiting may move.
  IF OLD.state IN ('applied', 'held', 'duplicate') AND NEW.state <> OLD.state THEN
    RAISE EXCEPTION 'ATTENDANCE_DEVICE_EVENT_SETTLED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_terminal_events_guard_trg ON public.attendance_terminal_events;
CREATE TRIGGER attendance_terminal_events_guard_trg
  BEFORE UPDATE OR DELETE ON public.attendance_terminal_events
  FOR EACH ROW EXECUTE FUNCTION public.attendance_terminal_events_guard();

-- ─── one person's day, from everything every device saw of them ─────────────
CREATE OR REPLACE FUNCTION public.attendance_device_settle(
  p_workspace  uuid,
  p_employee   uuid,
  p_day        date,
  p_actor      uuid
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
  v_in      time;
  v_out     time;
BEGIN
  -- The same key the employee link uses for a day, so a device and a link
  -- never both decide «the day is empty».
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_workspace::text || ':' || p_employee::text || ':' || p_day::text, 0)
  );

  SELECT a.id, a.source INTO v_id, v_source
    FROM public.attendance a
   WHERE a.workspace_id = p_workspace AND a.employee_id = p_employee AND a.date = p_day
   ORDER BY a.id
   LIMIT 1;
  v_found := FOUND;

  -- A person recorded this day. The device does not get to change it.
  IF v_found AND v_source IS DISTINCT FROM 'device' THEN
    UPDATE public.attendance_terminal_events
       SET state = 'held', settled_at = now()
     WHERE workspace_id = p_workspace AND employee_id = p_employee
       AND occurred_on = p_day AND state = 'new';
    RETURN 'held';
  END IF;

  UPDATE public.attendance_terminal_events
     SET state = 'applied', settled_at = now()
   WHERE workspace_id = p_workspace AND employee_id = p_employee
     AND occurred_on = p_day AND state = 'new';

  -- Earliest reading that is not an exit; latest reading that is not an entry.
  SELECT MIN(e.occurred_time) FILTER (WHERE e.direction <> 'out'),
         MAX(e.occurred_time) FILTER (WHERE e.direction <> 'in')
    INTO v_in, v_out
    FROM public.attendance_terminal_events e
   WHERE e.workspace_id = p_workspace AND e.employee_id = p_employee
     AND e.occurred_on = p_day AND e.state = 'applied';

  -- A lone reading is an arrival, not an arrival and a departure a second
  -- apart. Nothing is invented for the missing side.
  IF v_in IS NOT NULL AND v_out IS NOT NULL AND v_out <= v_in + interval '60 seconds' THEN
    v_out := NULL;
  END IF;

  IF v_found THEN
    UPDATE public.attendance
       SET status = 'present', check_in = v_in, check_out = v_out, updated_at = now()
     WHERE id = v_id;
  ELSE
    INSERT INTO public.attendance
      (employee_id, date, check_in, check_out, status, user_id, workspace_id, source)
    VALUES
      (p_employee, p_day, v_in, v_out, 'present', p_actor, p_workspace, 'device');
  END IF;

  RETURN 'applied';
END;
$$;

-- ─── a batch arrives ────────────────────────────────────────────────────────
-- The application has already checked the key and turned each event into a day
-- and a wall-clock time in p_time_zone. This is the atomic part.
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
  -- One batch at a time per device: a sender that retries while its first
  -- request is still running must not interleave with it.
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

    -- Who is this? The mapping for THIS device first, then the business-wide one.
    v_emp := NULL;
    SELECT i.employee_id INTO v_emp
      FROM public.attendance_terminal_identities i
     WHERE i.workspace_id = v_dev.workspace_id
       AND i.external_user_id = r.user_id
       AND (i.device_id = v_dev.id OR i.device_id IS NULL)
     ORDER BY (i.device_id IS NULL)
     LIMIT 1;

    IF v_emp IS NULL THEN
      v_state := 'unmatched';
    ELSIF EXISTS (
      SELECT 1 FROM public.attendance_terminal_events x
       WHERE x.workspace_id = v_dev.workspace_id
         AND x.employee_id = v_emp
         AND x.occurred_on = r.day
         AND x.state IN ('new', 'applied', 'held')
         AND abs(extract(epoch FROM (x.occurred_time - r.at))) < 60
    ) THEN
      -- Seen within the same minute, on this device or another.
      v_state := 'duplicate';
    ELSE
      v_state := 'new';
    END IF;

    INSERT INTO public.attendance_terminal_events
      (workspace_id, device_id, raw_event_id, external_user_id, occurred_on, occurred_time,
       time_zone, direction, method, payload, employee_id, state, settled_at)
    VALUES
      (v_dev.workspace_id, v_dev.id, r.raw_id, r.user_id, r.day, r.at, p_time_zone,
       COALESCE(r.direction, 'unknown'), COALESCE(r.method, 'UNKNOWN'), r.payload, v_emp, v_state,
       CASE WHEN v_state = 'duplicate' THEN now() END)
    ON CONFLICT (device_id, raw_event_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      -- Delivered before. Nothing is written and nothing is counted twice.
      v_redelivered := v_redelivered + 1;
    ELSIF v_state = 'unmatched' THEN
      v_unmatched := v_unmatched + 1;
    ELSIF v_state = 'duplicate' THEN
      v_duplicate := v_duplicate + 1;
    ELSE
      v_days := v_days || jsonb_build_object('e', v_emp, 'd', r.day);
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
       AND occurred_on = v_day.day AND state = 'new';
    v_outcome := public.attendance_device_settle(
      v_dev.workspace_id, v_day.employee_id, v_day.day, v_dev.created_by
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

-- ─── a number on a device is given a person: settle what was waiting ────────
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
      IF NOT (r.occurred_on = ANY (v_days)) THEN
        v_days := array_append(v_days, r.occurred_on);
      END IF;
    END IF;
    UPDATE public.attendance_terminal_events
       SET employee_id = v_emp, state = v_state,
           settled_at = CASE WHEN v_state = 'duplicate' THEN now() END
     WHERE id = r.id;
  END LOOP;

  FOREACH v_one IN ARRAY v_days LOOP
    SELECT COUNT(*) INTO v_n
      FROM public.attendance_terminal_events
     WHERE workspace_id = p_workspace AND employee_id = v_emp
       AND occurred_on = v_one AND state = 'new';
    IF public.attendance_device_settle(p_workspace, v_emp, v_one, p_actor) = 'applied' THEN
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

-- ⚠️ On Supabase a new function is born executable by service_role too. The
-- trigger function and the inner «settle a day» step are not entry points:
-- nobody calls them except the functions above.
REVOKE ALL ON FUNCTION public.attendance_terminal_events_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.attendance_device_settle(uuid, uuid, date, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.attendance_device_ingest(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_device_reprocess(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_device_ingest(uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attendance_device_reprocess(uuid, uuid, text, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the devices, their mappings and every event they sent. Attendance
-- records a device wrote stay as they are; only the mark that says so cannot
-- (the constraint goes back to the links-only form, so first decide what
-- those rows should say):
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.attendance_device_reprocess(uuid, uuid, text, uuid);
--   DROP FUNCTION IF EXISTS public.attendance_device_ingest(uuid, text, jsonb, text);
--   DROP FUNCTION IF EXISTS public.attendance_device_settle(uuid, uuid, date, uuid);
--   DROP TABLE IF EXISTS public.attendance_terminal_events;
--   DROP FUNCTION IF EXISTS public.attendance_terminal_events_guard();
--   DROP TABLE IF EXISTS public.attendance_terminal_identities;
--   DROP TABLE IF EXISTS public.attendance_terminals;
--   UPDATE public.attendance SET source = NULL WHERE source = 'device';   -- a decision, not a default
--   ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_source_check;
--   ALTER TABLE public.attendance ADD CONSTRAINT attendance_source_check
--     CHECK (source IS NULL OR source = 'employee_link');
--   COMMIT;
--
-- VERIFY: docs/VERIFY-attendance-devices-01.sql
-- ============================================================================
