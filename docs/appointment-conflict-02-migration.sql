-- ============================================================================
-- docs/appointment-conflict-02-migration.sql
--
-- BUG-NEW-011 — a staff member cannot be double-booked, enforced by the DATABASE.
--
-- The service checks for an overlap and then inserts. Two requests that both pass
-- the check both insert. The invariant is:
--
--   no two non-cancelled appointments of the same staff member in the same
--   workspace overlap in time (half-open: one may start when the other ends).
--
-- That is an EXCLUSION constraint. It cannot be added as NOT VALID, so it is added
-- ONLY when no existing rows already overlap; otherwise this file stops with a
-- notice and changes nothing — the overlapping bookings are for the owner to
-- resolve (the VERIFY file lists them), not for a migration to delete.
--
-- SAFE TO RE-RUN. Additive, idempotent. Requires the btree_gist extension.
-- ⚠️ Run docs/VERIFY-appointment-conflict-02.sql afterwards. NOT run by the assistant.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  clashes bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_staff_overlap') THEN
    RAISE NOTICE 'appointments_no_staff_overlap already exists — nothing to do';
    RETURN;
  END IF;

  SELECT count(*) INTO clashes
    FROM public.appointments a
    JOIN public.appointments b
      ON a.workspace_id = b.workspace_id
     AND a.staff_employee_id = b.staff_employee_id
     AND a.id < b.id
     AND a.status <> 'cancelled' AND b.status <> 'cancelled'
     AND tstzrange(a.start_time, a.end_time) && tstzrange(b.start_time, b.end_time);

  IF clashes > 0 THEN
    RAISE NOTICE 'Not added: % existing pair(s) of overlapping appointments. Resolve them (see VERIFY block 3), then run this file again.', clashes;
    RETURN;
  END IF;

  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_no_staff_overlap
    EXCLUDE USING gist (
      workspace_id WITH =,
      staff_employee_id WITH =,
      tstzrange(start_time, end_time) WITH &&
    )
    WHERE (status <> 'cancelled' AND staff_employee_id IS NOT NULL);
END $$;

-- ─── ROLLBACK BLOCK ────────────────────────────────────────────────────────
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_staff_overlap;
