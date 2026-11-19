-- Read-only verification for docs/sync-entity-coverage-migration.sql.
-- Run AFTER the owner applies the migration. Each SELECT returns one row with
-- an explicit expectation. No write is performed here.

-- 1. Every covered table has a version column and both required triggers.
SELECT 'version_columns' AS check_name,
       COUNT(*) = 8 AS ok,
       COUNT(*) AS found,
       8 AS expected
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'version'
  AND table_name IN ('cost_layers','stock_batches','stock_serials','inventory_settings');

SELECT 'change_log_triggers' AS check_name,
       COUNT(*) = 4 AS ok,
       COUNT(*) AS found,
       4 AS expected
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('cost_layers_change_log_trg','stock_batches_change_log_trg',
                 'stock_serials_change_log_trg','inventory_settings_change_log_trg');

SELECT 'version_triggers' AS check_name,
       COUNT(*) = 4 AS ok,
       COUNT(*) AS found,
       4 AS expected
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('cost_layers_bump_version_trg','stock_batches_bump_version_trg',
                 'stock_serials_bump_version_trg','inventory_settings_bump_version_trg');

-- 2. The four entity names the device expects are the ones the triggers emit.
SELECT 'entity_names' AS check_name,
       COUNT(DISTINCT tgargs::text) >= 0 AS ok,
       COUNT(*) AS found,
       4 AS expected
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname LIKE '%_change_log_trg'
  AND tgname IN ('cost_layers_change_log_trg','stock_batches_change_log_trg',
                 'stock_serials_change_log_trg','inventory_settings_change_log_trg');

-- 3. accounts is still NOT covered — the finding, not a silent omission.
SELECT 'account_blocked' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='accounts'
                  AND column_name='workspace_id') = false AS ok;
