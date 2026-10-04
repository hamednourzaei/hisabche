-- ============================================================================
-- DATA SNAPSHOTS — 01 (capabilities #42–#46). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-data-snapshots-01.sql.
--
-- A snapshot is a MARKER: at this moment, the business had this many invoices,
-- payments, journal entries, customers, products. It copies no rows.
--
-- ⚠️ IT IS NOT A BACKUP AND CANNOT BE RESTORED FROM. `restorable` is a column
-- whose only allowed value is false, so no later code can quietly claim
-- otherwise. Taking the data out is the export in «داده و پشتیبان».
--
-- What it is for: answering «what has been added since the end of the year /
-- since the accountant looked?» by comparing a marker with now.
--
-- Markers are append-only: one that could be edited would not be a record of
-- what was true at that moment.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL,
  label                 text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  kind                  text NOT NULL CHECK (kind IN ('full', 'documents', 'catalog')),
  taken_at              timestamptz NOT NULL DEFAULT now(),
  source_schema_version text NOT NULL CHECK (source_schema_version ~ '^[0-9]+(\.[0-9]+){0,2}$'),
  -- { "<table>": row count } for the tables that could be counted.
  counts                jsonb NOT NULL CHECK (jsonb_typeof(counts) = 'object'),
  restorable            boolean NOT NULL DEFAULT false CHECK (restorable = false),
  taken_by              uuid NOT NULL
);

COMMENT ON TABLE public.data_snapshots IS
  'A marker of how many records a business held at a moment. Copies no rows; never restorable.';

CREATE INDEX IF NOT EXISTS data_snapshots_workspace_idx
  ON public.data_snapshots (workspace_id, taken_at DESC);

ALTER TABLE public.data_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_snapshots FROM PUBLIC, anon, authenticated;
-- ⚠️ `service_role` is revoked FIRST. On Supabase a new table in `public`
-- arrives with ALL privileges already granted to it (default privileges), so
-- granting a narrower set on top changes nothing. The first version of this
-- script only granted, and its VERIFY reported the backend role could still
-- UPDATE and DELETE. Safe to run again.
REVOKE ALL ON public.data_snapshots FROM service_role;
GRANT SELECT, INSERT ON public.data_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.data_snapshots_are_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DATA_SNAPSHOT_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS data_snapshots_append_only_trg ON public.data_snapshots;
CREATE TRIGGER data_snapshots_append_only_trg
  BEFORE UPDATE OR DELETE ON public.data_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.data_snapshots_are_append_only();

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the markers. They hold no business data.
--
--   DROP TABLE IF EXISTS public.data_snapshots;
--   DROP FUNCTION IF EXISTS public.data_snapshots_are_append_only();
