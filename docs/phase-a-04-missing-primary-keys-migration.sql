-- ============================================================================
-- docs/phase-a-04-missing-primary-keys-migration.sql
--
-- PHASE A · 4/4 — a primary key on the five public tables that have none.
--
--     checkout_sessions, event_types, invoice_pdf_cache,
--     journal_lines_archive, webhook_events
--
-- A table without a primary key is not merely untidy:
--
--   * PostgREST refuses to PATCH or DELETE a single row — there is no identity
--     to address it by — so those tables are effectively read-and-insert-only
--     through the API, whatever the code believes.
--   * `webhook_events` and `checkout_sessions` are the idempotency ledgers for
--     Stripe. Without a unique key on the provider's event id, a redelivered
--     webhook is processed TWICE. That is a double charge or a double
--     subscription, and it fails silently.
--   * logical replication of the table is impossible without a replica identity.
--
-- HOW THIS FILE BEHAVES WITH DIRTY DATA
--
-- Adding a PRIMARY KEY to a column that already holds duplicates or NULLs
-- fails and rolls the file back. Deduplicating means DELETING financial rows,
-- which this file will not do — see `DATABASE_MIGRATION_POLICY.md`.
--
-- So each table is handled by a guarded block: it checks first, adds the key
-- when the data supports it, and raises a WARNING naming the exact query to run
-- when it does not. A partial success is a success — the report at the bottom
-- tells you what is left.
--
-- SAFE TO RE-RUN. No row is deleted or modified; the only write is a default
-- surrogate id on `journal_lines_archive` rows that have none.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. event_types — PRIMARY KEY (type)
--
-- `type` is the event name the whole system keys off ('invoice.created', ...).
-- It is the natural key; a second row for the same type is a bug, not data.
-- ---------------------------------------------------------------------------

DO $et$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'event_types'
  ) THEN
    RAISE NOTICE 'event_types: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad FROM (
      SELECT type FROM event_types WHERE type IS NULL
      UNION ALL
      SELECT type FROM event_types GROUP BY type HAVING COUNT(*) > 1
    ) x;

    IF bad = 0 THEN
      ALTER TABLE event_types ADD CONSTRAINT event_types_pkey PRIMARY KEY (type);
      RAISE NOTICE 'event_types: PRIMARY KEY (type) added.';
    ELSE
      RAISE WARNING 'event_types: % duplicate/NULL type value(s) - PK NOT added. Inspect: SELECT type, COUNT(*) FROM event_types GROUP BY type HAVING COUNT(*) > 1;', bad;
    END IF;
  END IF;
END
$et$;

-- ---------------------------------------------------------------------------
-- 2. checkout_sessions — PRIMARY KEY (id)
--
-- `id text NOT NULL` is the checkout session identifier. One row per session.
-- ---------------------------------------------------------------------------

DO $cs$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'checkout_sessions'
  ) THEN
    RAISE NOTICE 'checkout_sessions: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad
    FROM (SELECT id FROM checkout_sessions GROUP BY id HAVING COUNT(*) > 1) x;

    IF bad = 0 THEN
      ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_pkey PRIMARY KEY (id);
      RAISE NOTICE 'checkout_sessions: PRIMARY KEY (id) added.';
    ELSE
      RAISE WARNING 'checkout_sessions: % duplicate id(s) - PK NOT added. Inspect: SELECT id, COUNT(*) FROM checkout_sessions GROUP BY id HAVING COUNT(*) > 1;', bad;
    END IF;
  END IF;
END
$cs$;

-- Also index the tenancy boundary, which every read of this table filters on.
CREATE INDEX IF NOT EXISTS checkout_sessions_workspace_idx
  ON checkout_sessions (workspace_id);

-- ---------------------------------------------------------------------------
-- 3. webhook_events — PRIMARY KEY (id)
--
-- THE IDEMPOTENCY KEY. `id` is the provider's event id; the whole point of the
-- table is "have I already processed this?". Without a unique constraint the
-- answer is decided by a racing SELECT, and two concurrent redeliveries both
-- see "no".
-- ---------------------------------------------------------------------------

DO $we$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'webhook_events'
  ) THEN
    RAISE NOTICE 'webhook_events: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad
    FROM (SELECT id FROM webhook_events GROUP BY id HAVING COUNT(*) > 1) x;

    IF bad = 0 THEN
      ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);
      RAISE NOTICE 'webhook_events: PRIMARY KEY (id) added - redelivery is now rejected by the database.';
    ELSE
      RAISE WARNING 'webhook_events: % duplicate id(s) - PK NOT added, REDELIVERY IS STILL BEING DOUBLE-PROCESSED. Inspect: SELECT id, COUNT(*) FROM webhook_events GROUP BY id HAVING COUNT(*) > 1;', bad;
    END IF;
  END IF;
END
$we$;

CREATE INDEX IF NOT EXISTS webhook_events_type_processed_idx
  ON webhook_events (type, processed_at DESC);

-- ---------------------------------------------------------------------------
-- 4. invoice_pdf_cache — PRIMARY KEY (invoice_id, version_key)
--
-- The composite is the real identity: one cached artefact per invoice per
-- rendered version. `invoice_id` alone would be wrong — a re-rendered invoice
-- legitimately has a second row under a new version_key while the old URL is
-- still being served.
--
-- ASSUMPTION: the writer upserts on (invoice_id, version_key). If duplicates
-- exist, the block below declines and says so rather than choosing a winner.
-- ---------------------------------------------------------------------------

DO $pdf$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'invoice_pdf_cache'
  ) THEN
    RAISE NOTICE 'invoice_pdf_cache: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad FROM (
      SELECT invoice_id, version_key
      FROM   invoice_pdf_cache
      GROUP  BY invoice_id, version_key
      HAVING COUNT(*) > 1
    ) x;

    IF bad = 0 THEN
      ALTER TABLE invoice_pdf_cache
        ADD CONSTRAINT invoice_pdf_cache_pkey PRIMARY KEY (invoice_id, version_key);
      RAISE NOTICE 'invoice_pdf_cache: PRIMARY KEY (invoice_id, version_key) added.';
    ELSE
      RAISE WARNING 'invoice_pdf_cache: % duplicate (invoice_id, version_key) pair(s) - PK NOT added. This is a regenerable cache, so deduplicating it is safe; do it deliberately, then re-run this file.', bad;
    END IF;
  END IF;
END
$pdf$;

ALTER TABLE invoice_pdf_cache DROP CONSTRAINT IF EXISTS invoice_pdf_cache_invoice_id_fkey;
ALTER TABLE invoice_pdf_cache ADD CONSTRAINT invoice_pdf_cache_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 5. journal_lines_archive — SURROGATE PRIMARY KEY (archive_id)
--
-- This one gets a surrogate, not a natural key, and the reason matters.
--
-- The archive is append-only evidence: rows removed from `journal_lines` with a
-- reason (see SETUP-COMPLETE.sql). Its `id` column is the id the line HAD, and
-- the same line could legitimately be archived twice — removed, restored after
-- investigation, removed again — each archival a separate fact. Making `id`
-- the primary key would forbid the second archival, which means the database
-- would refuse to record something that happened.
--
-- So: a new surrogate column, defaulted, backfilled for existing rows, and made
-- the key.
-- ---------------------------------------------------------------------------

ALTER TABLE journal_lines_archive
  ADD COLUMN IF NOT EXISTS archive_id uuid DEFAULT gen_random_uuid();

COMMENT ON COLUMN journal_lines_archive.archive_id IS
  'Surrogate key for one archival event. Distinct from `id`, which is the journal line''s own id and may repeat if a line is archived more than once.';

UPDATE journal_lines_archive SET archive_id = gen_random_uuid() WHERE archive_id IS NULL;

DO $jla$
DECLARE
  bad bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'p' AND t.relname = 'journal_lines_archive'
  ) THEN
    RAISE NOTICE 'journal_lines_archive: already has a primary key.';
  ELSE
    SELECT COUNT(*) INTO bad FROM journal_lines_archive WHERE archive_id IS NULL;

    IF bad = 0 THEN
      ALTER TABLE journal_lines_archive ALTER COLUMN archive_id SET NOT NULL;
      ALTER TABLE journal_lines_archive
        ADD CONSTRAINT journal_lines_archive_pkey PRIMARY KEY (archive_id);
      RAISE NOTICE 'journal_lines_archive: PRIMARY KEY (archive_id) added.';
    ELSE
      RAISE WARNING 'journal_lines_archive: % row(s) with NULL archive_id - PK NOT added.', bad;
    END IF;
  END IF;
END
$jla$;

CREATE INDEX IF NOT EXISTS journal_lines_archive_journal_idx
  ON journal_lines_archive (journal_id);

CREATE INDEX IF NOT EXISTS journal_lines_archive_archived_at_idx
  ON journal_lines_archive (archived_at DESC);

COMMIT;

-- ============================================================================
-- VERIFY — every public table that still has no primary key.
-- Expect an empty result, or exactly the tables whose WARNING you saw above.
-- ============================================================================
--
-- SELECT n.nspname, t.relname
-- FROM   pg_class t
-- JOIN   pg_namespace n ON n.oid = t.relnamespace
-- WHERE  t.relkind = 'r' AND n.nspname = 'public'
--   AND  NOT EXISTS (
--     SELECT 1 FROM pg_constraint c
--     WHERE c.conrelid = t.oid AND c.contype = 'p'
--   )
-- ORDER  BY t.relname;
