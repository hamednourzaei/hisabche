-- ============================================================================
-- scripts/emergency-drop-sync-triggers.sql
--
-- RUN THIS FIRST, RIGHT NOW, IF INSERTS ARE FAILING.
--
-- Symptom:
--     ERROR: record "new" has no field "version"
--     ERROR: record "new" has no field "workspace_id"
--     CONTEXT: PL/pgSQL function sync_record_change()
--
-- Cause: an earlier run of docs/sync-engine-migration.sql committed the
-- trigger FUNCTIONS and the TRIGGERS, but the ALTER TABLE statements that add
-- `version` and `workspace_id` did not take effect. The triggers now fire on
-- every INSERT/UPDATE and reference columns that do not exist, so every write
-- to invoices, customers, products and transactions fails.
--
-- This file removes ONLY the objects that migration created. It touches no
-- business data, no rows, no columns that hold financial information.
--
-- Safe to run repeatedly. Safe to run on production. Every statement is
-- IF EXISTS.
--
-- Runs in psql or the Supabase SQL editor.
-- ============================================================================

-- ─── 1. The triggers — this is what unbreaks writes ─────────────────────────
--
-- Dropping these restores the exact behaviour the database had before the sync
-- migration was attempted. Nothing else depends on them yet: no client reads
-- the change log.

DROP TRIGGER IF EXISTS invoices_change_log_trg     ON invoices;
DROP TRIGGER IF EXISTS customers_change_log_trg    ON customers;
DROP TRIGGER IF EXISTS products_change_log_trg     ON products;
DROP TRIGGER IF EXISTS transactions_change_log_trg ON transactions;

DROP TRIGGER IF EXISTS invoices_bump_version_trg   ON invoices;
DROP TRIGGER IF EXISTS customers_bump_version_trg  ON customers;
DROP TRIGGER IF EXISTS products_bump_version_trg   ON products;

DROP TRIGGER IF EXISTS invoices_guard_finalized_trg ON invoices;

-- ─── 2. The functions ───────────────────────────────────────────────────────
--
-- Dropped after the triggers, because a trigger depends on its function.

DROP FUNCTION IF EXISTS sync_record_change() CASCADE;
DROP FUNCTION IF EXISTS sync_bump_version() CASCADE;
DROP FUNCTION IF EXISTS invoices_guard_finalized() CASCADE;

-- ─── 3. Confirm writes work again ───────────────────────────────────────────
--
-- Proves an INSERT now succeeds, then rolls it back so no test row survives.
-- If this reports ok, the outage is over.

DO $$
DECLARE
  v_user    UUID;
  v_invoice UUID := gen_random_uuid();
BEGIN
  SELECT user_id INTO v_user FROM invoices LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'no existing invoice to borrow a user_id from; skipping the write test';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO invoices (id, user_id, invoice_number, total, date)
    VALUES (v_invoice, v_user, 'EMERGENCY-WRITE-TEST', 1, now());

    RAISE NOTICE 'INSERT succeeded — writes are working again';

    -- Deliberate abort so the probe leaves nothing behind.
    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback-marker' THEN
      RAISE EXCEPTION 'INSERT still failing after dropping triggers: %', SQLERRM;
    END IF;
  END;

  IF EXISTS (SELECT 1 FROM invoices WHERE id = v_invoice) THEN
    RAISE EXCEPTION 'the probe row survived its rollback — investigate before continuing';
  END IF;
END $$;

-- ─── 4. What is left, and what to do next ───────────────────────────────────
--
-- `sync_change_log` and `sync_mutations` are intentionally NOT dropped. They
-- are empty, inert, referenced by nothing, and harmless. Keeping them means
-- the eventual re-run has less to do. If you want them gone:
--
--     DROP VIEW  IF EXISTS sync_horizon;
--     DROP TABLE IF EXISTS sync_change_log;
--     DROP TABLE IF EXISTS sync_mutations;
--
-- Any `version` / `locked_by_user_id` / `lock_expires_at` / `finalized_at`
-- columns that DID get added are also left alone: they are nullable, unread by
-- the current application, and dropping a column is the one irreversible thing
-- in this file.
--
-- THE CORRECT ORDER, once writes are confirmed working:
--
--   1. this file                                    (done — writes restored)
--   2. docs/tenancy-workspace-migration.sql PART 1  (read-only analysis)
--   3. resolve any orphaned / ambiguous rows        (human decision)
--   4. tenancy migration PARTs 2 and 3              (add + backfill)
--   5. deploy the backend that writes workspace_id
--   6. tenancy migration PART 4                     (NOT NULL)
--   7. docs/sync-engine-migration.sql               (preflight will now pass)
--   8. scripts/verify-sync-migration.sql
--
-- Step 7 now begins with a preflight that refuses to install these triggers
-- unless workspace_id exists on all four tables. That guard is what stops this
-- outage from recurring.

-- The name patterns are parenthesised deliberately: AND binds tighter than OR,
-- so without the brackets this reads as
--     (internal AND table AND change_log) OR bump_version
-- which counts bump_version triggers on EVERY table in the database and would
-- report a false positive.
SELECT
  'sync triggers removed' AS action,
  (
    SELECT count(*)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal
       AND c.relname IN ('invoices', 'customers', 'products', 'transactions')
       AND (
            t.tgname LIKE '%change_log%'
         OR t.tgname LIKE '%bump_version%'
         OR t.tgname LIKE '%guard_finalized%'
       )
  ) AS sync_triggers_remaining,
  0 AS expected,
  CASE
    WHEN (
      SELECT count(*)
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal
         AND c.relname IN ('invoices', 'customers', 'products', 'transactions')
         AND (
              t.tgname LIKE '%change_log%'
           OR t.tgname LIKE '%bump_version%'
           OR t.tgname LIKE '%guard_finalized%'
         )
    ) = 0 THEN 'OK — writes restored'
    ELSE 'STILL BROKEN — a sync trigger survived; investigate'
  END AS verdict;
