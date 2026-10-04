-- ============================================================================
-- ENTITY NOTES — 01 (capability #103). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-entity-notes-01.sql.
--
-- A note is something a colleague wrote about a customer, a supplier, a product
-- or an employee, so the next person knows it. Notes are a LOG: a note is added
-- and stays as it was written. There is no edit and no delete — a note that
-- can be rewritten later is not a record of what was known at the time.
--
-- `entity_id` has no foreign key on purpose: it points at one of several
-- tables. The backend checks that the entity belongs to the workspace before
-- it writes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entity_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type  text NOT NULL CHECK (entity_type IN ('customer', 'supplier', 'product', 'employee')),
  entity_id    uuid NOT NULL,
  body         text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.entity_notes IS
  'Notes colleagues leave on a customer, supplier, product or employee. Append-only.';

CREATE INDEX IF NOT EXISTS entity_notes_entity_idx
  ON public.entity_notes (workspace_id, entity_type, entity_id, created_at DESC);

ALTER TABLE public.entity_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entity_notes FROM PUBLIC, anon, authenticated;
-- ⚠️ `service_role` is revoked FIRST. On Supabase a new table in `public`
-- arrives with ALL privileges already granted to it (default privileges), so
-- granting a narrower set on top changes nothing. The first version of this
-- script only granted, and its VERIFY reported the backend role could still
-- UPDATE and DELETE. Safe to run again.
REVOKE ALL ON public.entity_notes FROM service_role;
GRANT SELECT, INSERT ON public.entity_notes TO service_role;

-- Append-only, for every role including the backend's: a note is never
-- rewritten or removed.
CREATE OR REPLACE FUNCTION public.entity_notes_are_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ENTITY_NOTE_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS entity_notes_append_only_trg ON public.entity_notes;
CREATE TRIGGER entity_notes_append_only_trg
  BEFORE UPDATE OR DELETE ON public.entity_notes
  FOR EACH ROW EXECUTE FUNCTION public.entity_notes_are_append_only();

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes every note. Nothing else depends on them.
--
--   DROP TABLE IF EXISTS public.entity_notes;
--   DROP FUNCTION IF EXISTS public.entity_notes_are_append_only();
