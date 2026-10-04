-- ============================================================================
-- SHIFT ASSIGNMENTS — 01 (capability #101, the plan). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
-- ⚠️ RUN docs/work-shifts-01-migration.sql FIRST: an assignment points at a
--    shift, and this script stops with a clear message if that table is absent.
--    After running, run docs/VERIFY-shift-assignments-01.sql.
--
-- A shift assignment says: this employee is PLANNED to work this shift on this
-- day. It is a plan, not a record of what happened — what happened stays in
-- the attendance sheet, and the two are shown side by side.
--
-- It changes no pay and records no attendance.
--
-- Rules the database holds:
--   · the shift belongs to the same business and is active when assigned;
--   · the shift's hours are COPIED onto the assignment, so the plan for a past
--     day still reads as it did after the shift is retired;
--   · one person is never planned for two overlapping shifts on one day;
--   · an assignment is CANCELLED, never deleted or edited.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.work_shifts') IS NULL THEN
    RAISE EXCEPTION 'Run docs/work-shifts-01-migration.sql first: public.work_shifts does not exist.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  employee_id   uuid NOT NULL,
  shift_id      uuid NOT NULL REFERENCES public.work_shifts(id),
  work_date     date NOT NULL,
  -- Copied from the shift when the row is written (see the trigger).
  shift_name    text NOT NULL,
  starts_at     time without time zone NOT NULL,
  ends_at       time without time zone NOT NULL,
  is_cancelled  boolean NOT NULL DEFAULT false,
  assigned_by   uuid NOT NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  cancelled_by  uuid,
  cancelled_at  timestamptz,

  CONSTRAINT shift_assignments_cancel_is_whole CHECK (
    (is_cancelled AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
    OR (NOT is_cancelled AND cancelled_by IS NULL AND cancelled_at IS NULL)
  )
);

COMMENT ON TABLE public.shift_assignments IS
  'An employee planned for a shift on a day. A plan, not attendance; cancelled, never deleted.';

CREATE INDEX IF NOT EXISTS shift_assignments_day_idx
  ON public.shift_assignments (workspace_id, work_date)
  WHERE NOT is_cancelled;

CREATE INDEX IF NOT EXISTS shift_assignments_employee_day_idx
  ON public.shift_assignments (workspace_id, employee_id, work_date)
  WHERE NOT is_cancelled;

-- ─── Writing an assignment ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shift_assignments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_shift public.work_shifts%ROWTYPE;
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

  -- The hours are the shift's, whatever the caller sent.
  NEW.shift_name   := v_shift.name;
  NEW.starts_at    := v_shift.starts_at;
  NEW.ends_at      := v_shift.ends_at;
  NEW.is_cancelled := false;
  NEW.cancelled_by := NULL;
  NEW.cancelled_at := NULL;

  -- Two people planning the same person at the same moment wait for each other.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.workspace_id::text || ':' || NEW.employee_id::text || ':' || NEW.work_date::text, 0)
  );

  IF EXISTS (
    SELECT 1 FROM public.shift_assignments other
     WHERE other.workspace_id = NEW.workspace_id
       AND other.employee_id  = NEW.employee_id
       AND other.work_date    = NEW.work_date
       AND NOT other.is_cancelled
       AND other.starts_at < NEW.ends_at
       AND NEW.starts_at < other.ends_at
  ) THEN
    RAISE EXCEPTION 'SHIFT_ASSIGNMENT_OVERLAP';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shift_assignments_before_insert_trg ON public.shift_assignments;
CREATE TRIGGER shift_assignments_before_insert_trg
  BEFORE INSERT ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.shift_assignments_before_insert();

-- ─── History is forward-only: the one change is a cancellation ──────────────

CREATE OR REPLACE FUNCTION public.shift_assignments_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'SHIFT_ASSIGNMENT_IMMUTABLE';
  END IF;

  IF OLD.is_cancelled
     OR NOT NEW.is_cancelled
     OR (to_jsonb(NEW) - 'is_cancelled' - 'cancelled_by' - 'cancelled_at')
        IS DISTINCT FROM
        (to_jsonb(OLD) - 'is_cancelled' - 'cancelled_by' - 'cancelled_at')
  THEN
    RAISE EXCEPTION 'SHIFT_ASSIGNMENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shift_assignments_guard_trg ON public.shift_assignments;
CREATE TRIGGER shift_assignments_guard_trg
  BEFORE UPDATE OR DELETE ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.shift_assignments_guard();

-- ─── Access ─────────────────────────────────────────────────────────────────

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

-- On Supabase a new table arrives with ALL privileges already granted to the
-- three API roles; every one is revoked before the backend is granted back.
REVOKE ALL ON public.shift_assignments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.shift_assignments TO service_role;

REVOKE ALL ON FUNCTION public.shift_assignments_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shift_assignments_guard() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the plan. Attendance records and shift definitions are untouched.
--
--   DROP TRIGGER IF EXISTS shift_assignments_guard_trg ON public.shift_assignments;
--   DROP TRIGGER IF EXISTS shift_assignments_before_insert_trg ON public.shift_assignments;
--   DROP FUNCTION IF EXISTS public.shift_assignments_guard();
--   DROP FUNCTION IF EXISTS public.shift_assignments_before_insert();
--   DROP TABLE IF EXISTS public.shift_assignments;
