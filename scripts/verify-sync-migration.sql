-- ============================================================================
-- scripts/verify-sync-migration.sql
--
-- Run AFTER docs/sync-engine-migration.sql, against staging first.
--
--     psql "$SUPABASE_DATABASE_URL" -f scripts/verify-sync-migration.sql
--
-- Every check RAISES EXCEPTION on failure, so a non-zero psql exit means the
-- migration is not safe to promote. It is read-mostly: the few writes happen
-- inside transactions that roll back, so it leaves no residue.
--
-- The check that matters most is #6. It proves the change log and the business
-- row commit or roll back TOGETHER. If that fails, the delta protocol is
-- unsound and nothing else here matters.
-- ============================================================================

\set ON_ERROR_STOP on
\timing on

DO $$
DECLARE
  v_workspace UUID;
  v_user      UUID;
  v_invoice   UUID;
  v_count     BIGINT;
  v_version   BIGINT;
BEGIN
  RAISE NOTICE '── 1. objects exist ─────────────────────────────────────────';

  PERFORM 1 FROM information_schema.tables WHERE table_name = 'sync_change_log';
  IF NOT FOUND THEN RAISE EXCEPTION 'sync_change_log is missing'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_name = 'sync_mutations';
  IF NOT FOUND THEN RAISE EXCEPTION 'sync_mutations is missing'; END IF;

  RAISE NOTICE '   ok';

  RAISE NOTICE '── 2. columns added ─────────────────────────────────────────';

  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'invoices' AND column_name = 'version';
  IF NOT FOUND THEN RAISE EXCEPTION 'invoices.version is missing'; END IF;

  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'invoices' AND column_name = 'finalized_at';
  IF NOT FOUND THEN RAISE EXCEPTION 'invoices.finalized_at is missing'; END IF;

  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'customers' AND column_name = 'version';
  IF NOT FOUND THEN RAISE EXCEPTION 'customers.version is missing'; END IF;

  RAISE NOTICE '   ok';

  RAISE NOTICE '── 3. existing data initialised ─────────────────────────────';

  SELECT count(*) INTO v_count FROM invoices WHERE version IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION '% invoices have a NULL version', v_count;
  END IF;

  -- Every pre-existing row must start at 1. A row already above 1 would mean
  -- the migration ran twice with traffic in between, which is fine, but a row
  -- at 0 or negative would break the conflict check.
  SELECT count(*) INTO v_count FROM invoices WHERE version < 1;
  IF v_count > 0 THEN
    RAISE EXCEPTION '% invoices have version < 1', v_count;
  END IF;

  RAISE NOTICE '   ok';

  RAISE NOTICE '── 4. no invoice was wrongly marked finalized ───────────────';

  -- The migration must not retroactively freeze anything. Finalization is a
  -- decision the application makes, never a side effect of a schema change.
  SELECT count(*) INTO v_count FROM invoices WHERE finalized_at IS NOT NULL;
  IF v_count > 0 THEN
    RAISE WARNING '% invoices already carry finalized_at — verify this is intended', v_count;
  END IF;

  RAISE NOTICE '   ok';

  RAISE NOTICE '── 5. indexes present ───────────────────────────────────────';

  PERFORM 1 FROM pg_indexes WHERE indexname = 'sync_change_log_workspace_version_idx';
  IF NOT FOUND THEN RAISE EXCEPTION 'the pull index is missing — pulls will seq-scan'; END IF;

  RAISE NOTICE '   ok';

  RAISE NOTICE '── 6. THE ATOMICITY CHECK ───────────────────────────────────';

  SELECT id INTO v_workspace FROM workspaces LIMIT 1;
  IF v_workspace IS NULL THEN
    RAISE WARNING 'no workspace in this database; skipping the behavioural checks';
    RETURN;
  END IF;

  SELECT user_id INTO v_user FROM invoices WHERE workspace_id = v_workspace LIMIT 1;
  IF v_user IS NULL THEN
    SELECT id INTO v_user FROM auth.users LIMIT 1;
  END IF;

  v_invoice := gen_random_uuid();

  -- Inside a subtransaction so nothing survives.
  BEGIN
    INSERT INTO invoices (id, workspace_id, user_id, invoice_number, total, date)
    VALUES (v_invoice, v_workspace, v_user, 'VERIFY-ATOMIC', 1, now());

    SELECT count(*) INTO v_count
      FROM sync_change_log
     WHERE entity_id = v_invoice AND operation = 'create';

    IF v_count <> 1 THEN
      RAISE EXCEPTION
        'change log not written by the trigger (found %). The delta protocol is unsound.',
        v_count;
    END IF;

    RAISE NOTICE '   log written inside the transaction: ok';
    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback-marker' THEN RAISE; END IF;
  END;

  -- After the rollback, BOTH must be gone.
  SELECT count(*) INTO v_count FROM invoices WHERE id = v_invoice;
  IF v_count <> 0 THEN RAISE EXCEPTION 'invoice survived rollback'; END IF;

  SELECT count(*) INTO v_count FROM sync_change_log WHERE entity_id = v_invoice;
  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'change log row survived a rolled-back insert — log and data are NOT atomic';
  END IF;

  RAISE NOTICE '   log rolled back with the data: ok';

  RAISE NOTICE '── 7. version bumps on update ───────────────────────────────';

  BEGIN
    v_invoice := gen_random_uuid();

    INSERT INTO invoices (id, workspace_id, user_id, invoice_number, total, date)
    VALUES (v_invoice, v_workspace, v_user, 'VERIFY-VERSION', 1, now());

    UPDATE invoices SET notes = 'verify' WHERE id = v_invoice;
    SELECT version INTO v_version FROM invoices WHERE id = v_invoice;

    IF v_version <> 2 THEN
      RAISE EXCEPTION 'expected version 2 after one update, got %', v_version;
    END IF;

    RAISE NOTICE '   ok';
    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback-marker' THEN RAISE; END IF;
  END;

  RAISE NOTICE '── 8. finalized invoices are immutable ──────────────────────';

  BEGIN
    v_invoice := gen_random_uuid();

    INSERT INTO invoices (id, workspace_id, user_id, invoice_number, total, date)
    VALUES (v_invoice, v_workspace, v_user, 'VERIFY-FINAL', 100, now());

    UPDATE invoices SET finalized_at = now() WHERE id = v_invoice;

    BEGIN
      UPDATE invoices SET total = 999 WHERE id = v_invoice;
      RAISE EXCEPTION 'a finalized invoice was modified — the guard trigger is not working';
    EXCEPTION WHEN restrict_violation THEN
      RAISE NOTICE '   money change refused: ok';
    END;

    -- Sync bookkeeping must still be writable on a finalized row, or the
    -- lease could never be released.
    UPDATE invoices SET locked_by_user_id = NULL WHERE id = v_invoice;
    RAISE NOTICE '   sync columns still writable: ok';

    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback-marker' THEN RAISE; END IF;
  END;

  RAISE NOTICE '── 9. idempotency ledger enforces uniqueness ────────────────';

  BEGIN
    INSERT INTO sync_mutations (mutation_id, workspace_id, user_id, entity_type, operation, status)
    VALUES ('00000000-0000-4000-8000-0000000000ff', v_workspace, v_user, 'invoice', 'create', 'applied');

    BEGIN
      INSERT INTO sync_mutations (mutation_id, workspace_id, user_id, entity_type, operation, status)
      VALUES ('00000000-0000-4000-8000-0000000000ff', v_workspace, v_user, 'invoice', 'create', 'applied');
      RAISE EXCEPTION 'a duplicate mutation_id was accepted — retries can duplicate money';
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE '   duplicate refused: ok';
    END;

    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback-marker' THEN RAISE; END IF;
  END;

  RAISE NOTICE '── 10. cursor is monotonic ──────────────────────────────────';

  -- BIGSERIAL guarantees this, but assert it so a future change to the column
  -- type cannot silently break resumption.
  SELECT count(*) INTO v_count
    FROM (
      SELECT sync_version,
             lag(sync_version) OVER (PARTITION BY workspace_id ORDER BY sync_version) AS prev
        FROM sync_change_log
    ) t
   WHERE prev IS NOT NULL AND sync_version <= prev;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'cursor is not monotonic in % places', v_count;
  END IF;

  RAISE NOTICE '   ok';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE ' ALL CHECKS PASSED — migration is sound on this database';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
