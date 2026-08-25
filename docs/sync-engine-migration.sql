-- ============================================================================
-- Sync engine — change log, monotonic cursor, idempotency, optimistic version.
--
-- This is the server half of the local-first migration. It adds four things
-- the previous /sync/pull and /sync/push had no equivalent of:
--
--   1. sync_change_log   an append-only, sequence-ordered record of every
--                        authoritative mutation, written in the SAME
--                        transaction as the business row it describes.
--   2. a monotonic cursor BIGSERIAL, not a timestamp. Timestamps tie, go
--                        backwards under clock skew, and cannot express
--                        "everything strictly after what I already have".
--   3. sync_mutations    the idempotency ledger. A client retry carrying a
--                        mutation_id that already committed gets the stored
--                        result back instead of executing the money twice.
--   4. version / lease   optimistic concurrency and a draft editing lease on
--                        invoices, so two users cannot silently overwrite one
--                        another.
--
-- SAFE TO RE-RUN. Every statement is guarded.
--
-- WHY TRIGGERS RATHER THAN APPLICATION WRITES
--
-- The change log must never disagree with the data. If the service wrote both,
-- any code path that forgets — a raw update, an admin fix, a future endpoint —
-- silently produces a row no client will ever learn about. A trigger fires
-- inside the same transaction as the write that caused it, so the two commit
-- or roll back together, by construction rather than by discipline.
-- ============================================================================

-- ─── 0. PREFLIGHT — fail closed ────────────────────────────────────────────
--
-- This migration installs a trigger that reads NEW.workspace_id on invoices,
-- customers, products and transactions. If that column does not exist, the
-- trigger raises `record "new" has no field "workspace_id"` on EVERY INSERT —
-- which would take invoice creation down completely on a live financial
-- system.
--
-- Those columns genuinely were absent: tenancy for those four tables was
-- `user_id`, and documents/DATABASE_SCHEMA.md was wrong about it. So this
-- refuses to proceed rather than half-applying and leaving the database in a
-- state where writes fail.
--
-- Run docs/tenancy-workspace-migration.sql first.

DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_table   TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['invoices', 'customers', 'products', 'transactions'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = v_table
         AND column_name = 'workspace_id'
    ) THEN
      v_missing := array_append(v_missing, v_table);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION
      E'PREFLIGHT FAILED — workspace_id is missing from: %\n'
      '\n'
      'This migration would install triggers that break every INSERT into '
      'those tables.\n'
      '\n'
      'Run docs/tenancy-workspace-migration.sql first, confirm its PART 3 '
      'reports READY for every entity, then re-run this file.',
      array_to_string(v_missing, ', ')
      USING ERRCODE = 'feature_not_supported';
  END IF;

  -- A workspace_id that is still nullable means the backfill has not finished.
  -- The trigger tolerates NULL (it skips logging), but a row that never
  -- reaches the change log is a change no client will ever receive — silent
  -- data divergence, which is worse than a loud failure.
  FOREACH v_table IN ARRAY ARRAY['invoices', 'customers', 'products', 'transactions'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = v_table
         AND column_name = 'workspace_id' AND is_nullable = 'YES'
    ) THEN
      RAISE WARNING
        'workspace_id on % is still NULLABLE. Rows with a NULL workspace will '
        'never appear in any client''s delta. Enforce NOT NULL before relying '
        'on sync.', v_table;
    END IF;
  END LOOP;

  RAISE NOTICE 'preflight ok — workspace_id present on all four synced tables';
END $$;


-- ─── 1. The change log and its cursor ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_change_log (
  -- The cursor. BIGSERIAL gives a gapless-enough, strictly increasing value
  -- that a client can order by and resume from.
  sync_version   BIGSERIAL     PRIMARY KEY,
  workspace_id   UUID          NOT NULL,
  entity_type    TEXT          NOT NULL,
  entity_id      UUID          NOT NULL,
  operation      TEXT          NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  -- The entity's own version at the time of the change, so a client can tell
  -- a replayed change from a newer one without refetching the row.
  entity_version BIGINT        NOT NULL DEFAULT 1,
  -- Which device caused this. Lets a client skip echoes of its own writes.
  origin_device  TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- The pull query is always "this workspace, after this cursor, in order".
CREATE INDEX IF NOT EXISTS sync_change_log_workspace_version_idx
  ON sync_change_log (workspace_id, sync_version);

CREATE INDEX IF NOT EXISTS sync_change_log_entity_idx
  ON sync_change_log (entity_type, entity_id);

-- Retention: the log grows forever otherwise. A client further behind than
-- the horizon must re-hydrate from a snapshot rather than replay.
CREATE INDEX IF NOT EXISTS sync_change_log_created_at_idx
  ON sync_change_log (created_at);

COMMENT ON TABLE sync_change_log IS
  'Append-only. Written by trigger inside the business transaction. Never UPDATE or DELETE a row here except by the retention job.';

-- ─── 2. Idempotency ledger ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_mutations (
  -- Client-generated, stable across every retry of the same logical mutation.
  mutation_id    UUID          PRIMARY KEY,
  workspace_id   UUID          NOT NULL,
  user_id        UUID          NOT NULL,
  device_id      TEXT,
  entity_type    TEXT          NOT NULL,
  entity_id      UUID,
  operation      TEXT          NOT NULL,
  status         TEXT          NOT NULL CHECK (status IN ('applied', 'rejected')),
  -- What the client was told the first time. A retry replays this verbatim,
  -- so a lost response can never turn into a second invoice.
  result         JSONB,
  error_code     TEXT,
  sync_version   BIGINT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_mutations_workspace_idx
  ON sync_mutations (workspace_id, created_at);

COMMENT ON COLUMN sync_mutations.mutation_id IS
  'PRIMARY KEY is the enforcement: a concurrent duplicate loses the insert race and reads the winner''s result.';

-- ─── 3. Optimistic concurrency + draft lease on invoices ───────────────────

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- The lease is a COLLABORATION signal, not a database lock. A crashed client
-- must not hold an invoice hostage, so it expires on its own.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS locked_by_user_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;

-- Set once when a draft becomes a finalized financial document. From then on
-- the row is immutable — see the guard trigger below.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS invoices_lock_idx
  ON invoices (locked_by_user_id, lock_expires_at)
  WHERE locked_by_user_id IS NOT NULL;

-- Other synced entities need a version too, for the same reason.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE products  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- ─── 4. The trigger that keeps data and log together ───────────────────────

CREATE OR REPLACE FUNCTION sync_record_change() RETURNS TRIGGER AS $$
DECLARE
  v_workspace UUID;
  v_entity    UUID;
  v_op        TEXT;
  v_version   BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_workspace := OLD.workspace_id;
    v_entity    := OLD.id;
    v_op        := 'delete';
    v_version   := COALESCE(OLD.version, 1);
  ELSE
    v_workspace := NEW.workspace_id;
    v_entity    := NEW.id;
    v_op        := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
    v_version   := COALESCE(NEW.version, 1);
  END IF;

  -- A row with no workspace cannot be routed to any client's pull, so logging
  -- it would create a change nobody can ever receive.
  IF v_workspace IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version, origin_device)
  VALUES (
    v_workspace,
    TG_ARGV[0],
    v_entity,
    v_op,
    v_version,
    -- Set by the request handler via `SET LOCAL`; NULL for writes that did not
    -- come through the sync endpoint.
    current_setting('hisabche.device_id', true)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Version bump on every update ───────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_bump_version() RETURNS TRIGGER AS $$
BEGIN
  -- Monotonic per row, and never trusted from the client: the client SENDS the
  -- version it expects, the server DECIDES the next one.
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 6. Finalized invoices are immutable ───────────────────────────────────

CREATE OR REPLACE FUNCTION invoices_guard_finalized() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL THEN
    -- A finalized invoice is a financial record. Money is corrected with a new
    -- correction document, never by editing history. The only fields that may
    -- still move are the ones that describe SYNC, not money.
    IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)
       AND (NEW.total, NEW.subtotal, NEW.discount_total, NEW.tax_total,
            NEW.currency, NEW.customer_id, NEW.type, NEW.date, NEW.invoice_number)
           IS DISTINCT FROM
           (OLD.total, OLD.subtotal, OLD.discount_total, OLD.tax_total,
            OLD.currency, OLD.customer_id, OLD.type, OLD.date, OLD.invoice_number)
    THEN
      RAISE EXCEPTION 'invoice % is finalized and cannot be modified', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 7. Wire the triggers ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS invoices_guard_finalized_trg ON invoices;
CREATE TRIGGER invoices_guard_finalized_trg
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_guard_finalized();

DROP TRIGGER IF EXISTS invoices_bump_version_trg ON invoices;
CREATE TRIGGER invoices_bump_version_trg
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS customers_bump_version_trg ON customers;
CREATE TRIGGER customers_bump_version_trg
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS products_bump_version_trg ON products;
CREATE TRIGGER products_bump_version_trg
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS invoices_change_log_trg ON invoices;
CREATE TRIGGER invoices_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('invoice');

DROP TRIGGER IF EXISTS customers_change_log_trg ON customers;
CREATE TRIGGER customers_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('customer');

DROP TRIGGER IF EXISTS products_change_log_trg ON products;
CREATE TRIGGER products_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('product');

DROP TRIGGER IF EXISTS transactions_change_log_trg ON transactions;
CREATE TRIGGER transactions_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('transaction');

-- ─── 8. Cursor horizon ─────────────────────────────────────────────────────
--
-- A client whose cursor predates the oldest surviving log row cannot replay
-- safely: the changes it missed are gone. The pull endpoint compares against
-- this and tells such a client to re-hydrate instead of silently skipping.

CREATE OR REPLACE VIEW sync_horizon AS
  SELECT
    COALESCE(MIN(sync_version), 0) AS oldest_version,
    COALESCE(MAX(sync_version), 0) AS newest_version
  FROM sync_change_log;

-- ─── 9. RLS ────────────────────────────────────────────────────────────────
-- Both tables are reached only through the service role in the sync endpoints,
-- which derive workspace and user from the verified JWT. Enabling RLS with no
-- permissive policy means a leaked anon key cannot read another workspace's
-- change stream even if the endpoint were bypassed.

ALTER TABLE sync_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_mutations  ENABLE ROW LEVEL SECURITY;
