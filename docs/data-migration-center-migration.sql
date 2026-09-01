-- ============================================================================
-- docs/data-migration-center-migration.sql
--
-- Bringing an existing business into Hisabche: the job, and the ledger that
-- makes it repeatable.
--
-- ---------------------------------------------------------------------------
-- WHY THE JOB IS A ROW AND NOT A VARIABLE
--
-- An import is long enough that the user will close the tab in the middle of
-- it. If the wizard's position lives in browser memory, a refresh loses the
-- mapping they spent ten minutes on, and — worse — a half-finished commit has
-- no record that it happened. The row IS the state; the UI reads it.
--
-- ---------------------------------------------------------------------------
-- WHY THE IDENTITY LEDGER EXISTS
--
-- A source id is not a Hisabche primary key and must never be used as one.
-- `migration_records` is the translation table between them, and it is what
-- makes a re-run of the same file idempotent: the second run finds the source
-- id already mapped and updates instead of inserting a twin. It is also the
-- only safe basis for recovery — "everything created by migration X" is a
-- query here, never a blanket delete of recently-created rows.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT STORED
--
-- The uploaded file itself. It is parsed within the request that carries it
-- and only the derived headers, counts and findings are kept. Storing the raw
-- export would mean holding a customer list, with its phone numbers, in a
-- second place with its own retention question — for no capability the user
-- asked for. What IS kept is the filename, the byte count and a digest, which
-- is enough to answer "did I already import this file?".
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. The job ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  -- The actor. Recorded, never a tenancy filter.
  created_by         uuid NOT NULL,

  entity             text NOT NULL,
  source_type        text NOT NULL,
  -- What the uploader called the file. Displayed, never used to open anything.
  original_filename  text NOT NULL,
  byte_size          integer NOT NULL DEFAULT 0,
  -- SHA-256 of the decoded text, so "you already imported this" is answerable
  -- without keeping the file.
  content_digest     text,

  status             text NOT NULL DEFAULT 'uploaded',

  -- Everything the wizard needs to redraw itself after a refresh: detected
  -- headers, the source guess, the mapping, the findings, the dry run and the
  -- reconciliation. jsonb because the shape differs per step and none of it is
  -- ever queried by key.
  discovery          jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping            jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings           jsonb NOT NULL DEFAULT '[]'::jsonb,
  dry_run            jsonb,
  reconciliation     jsonb,

  rows_scanned       integer NOT NULL DEFAULT 0,
  rows_created       integer NOT NULL DEFAULT 0,
  rows_updated       integer NOT NULL DEFAULT 0,
  rows_skipped       integer NOT NULL DEFAULT 0,

  -- Set the moment a commit begins, so a second commit of the same job is
  -- refused rather than racing it.
  committed_at       timestamptz,
  completed_at       timestamptz,
  error_code         text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE migration_jobs DROP CONSTRAINT IF EXISTS migration_jobs_status_check;
ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_status_check CHECK (
  status IN (
    'uploaded', 'scanning', 'scanned', 'mapping', 'validating', 'ready',
    'importing', 'reconciling', 'completed', 'completed_with_warnings',
    'failed', 'cancelled'
  )
);

ALTER TABLE migration_jobs DROP CONSTRAINT IF EXISTS migration_jobs_entity_check;
ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_entity_check
  CHECK (entity IN ('customer', 'product'));

-- Only the formats whose parser actually exists. A row claiming 'xlsx' would
-- be a promise the code cannot keep, so the database refuses it too.
ALTER TABLE migration_jobs DROP CONSTRAINT IF EXISTS migration_jobs_source_type_check;
ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_source_type_check
  CHECK (source_type IN ('csv', 'tsv'));

-- The history list: this workspace, newest first.
CREATE INDEX IF NOT EXISTS migration_jobs_workspace_idx
  ON migration_jobs (workspace_id, created_at DESC);

-- ─── 2. The identity ledger ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  migration_id        uuid NOT NULL REFERENCES migration_jobs (id) ON DELETE CASCADE,

  source_entity_type  text NOT NULL,
  -- The business key that identified this row IN THE SOURCE: an external id,
  -- a phone, an SKU. Already normalised by the importer.
  source_identity     text NOT NULL,
  source_row          integer NOT NULL,

  target_entity_type  text NOT NULL,
  target_id           uuid NOT NULL,

  outcome             text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE migration_records DROP CONSTRAINT IF EXISTS migration_records_outcome_check;
ALTER TABLE migration_records ADD CONSTRAINT migration_records_outcome_check
  CHECK (outcome IN ('created', 'updated', 'skipped'));

-- IDEMPOTENCY, enforced by the database rather than by hoping the application
-- checked first. A retried commit that re-inserts the same source identity in
-- the same workspace hits this and updates instead of making a twin.
CREATE UNIQUE INDEX IF NOT EXISTS migration_records_identity_key
  ON migration_records (workspace_id, source_entity_type, source_identity);

-- "What did migration X create?" — the only safe basis for recovery.
CREATE INDEX IF NOT EXISTS migration_records_job_idx
  ON migration_records (workspace_id, migration_id);

-- ─── 3. Row level security ──────────────────────────────────────────────────
--
-- The membership subquery is written out rather than calling
-- `auth_workspace_ids()`, so this file stands on its own if it is ever run
-- before the recursion-fix migration. `rls-recursion-fix-migration.sql` runs
-- last and rewrites the shape everywhere; this matches what every other
-- capability's migration already writes.

ALTER TABLE migration_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_records ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['migration_jobs', 'migration_records'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- §40 — import profiles.
--
-- A profile stores column NAMES, never indexes. An index is a fact about one
-- file: the next export from the same system has the same columns in a
-- different order the moment somebody adds one, and a saved index would then
-- map `phone` onto `openingBalance` — silently, into a financial field.
--
-- `signature` keeps the headers the profile was built against, so drift can be
-- reported rather than applied quietly (§40 forbids the quiet version).
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS migration_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  created_by      uuid NOT NULL,

  name            text NOT NULL,
  entity          text NOT NULL,
  -- target field -> source column NAME
  columns_by_name jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- the headers this profile was built against, in order
  signature       jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE migration_profiles DROP CONSTRAINT IF EXISTS migration_profiles_entity_check;
ALTER TABLE migration_profiles ADD CONSTRAINT migration_profiles_entity_check
  CHECK (entity IN ('customer', 'product'));

-- One profile per name per entity per workspace: saving twice under the same
-- name updates rather than accumulating near-identical profiles nobody can
-- tell apart.
CREATE UNIQUE INDEX IF NOT EXISTS migration_profiles_name_key
  ON migration_profiles (workspace_id, entity, name);

ALTER TABLE migration_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS migration_profiles_workspace_members ON migration_profiles;
CREATE POLICY migration_profiles_workspace_members ON migration_profiles
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;
