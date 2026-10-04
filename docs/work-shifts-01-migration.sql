-- ============================================================================
-- WORK SHIFTS — 01 (capability #101). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-work-shifts-01.sql.
--
-- A shift is a named pair of times in the shop's own local day («صبح» 08:00 to
-- 16:00, with 30 minutes of unpaid break). It is a DEFINITION: the attendance
-- sheet uses it to record a day in one click. It assigns nobody to anything and
-- changes nobody's pay.
--
-- A shift does not cross midnight (ends_at > starts_at), and its break is
-- shorter than the shift. A shift is retired with is_active = false, never
-- deleted, so a day recorded «by the morning shift» stays explainable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.work_shifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  name          text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  starts_at     time without time zone NOT NULL,
  ends_at       time without time zone NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT work_shifts_ends_after_start CHECK (ends_at > starts_at),
  CONSTRAINT work_shifts_break_shorter_than_shift
    CHECK (break_minutes < EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60)
);

COMMENT ON TABLE public.work_shifts IS
  'Named working hours of a business. A definition only; retired with is_active = false.';

-- One ACTIVE shift per name: two «صبح» in the picker cannot be told apart.
CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_active_name
  ON public.work_shifts (workspace_id, lower(btrim(name)))
  WHERE is_active;

ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_shifts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.work_shifts TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the definitions. Attendance records keep the times they were given.
--
--   DROP TABLE IF EXISTS public.work_shifts;
