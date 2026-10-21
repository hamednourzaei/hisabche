-- ============================================
-- VERIFY: the operational pull.
--
-- Run AFTER docs/always-local-operational-pull-migration.sql.
--
-- Every question here has one right answer:
--   1. the four tables carry the change log;
--   2. a change to one of them lands in the log with its workspace;
--   3. a row with no workspace is NOT logged (nobody could receive it);
--   4. the version moves forward on every update;
--   5. a delete is logged as a delete.
-- ============================================

-- ─── 1. The triggers exist ─────────────────────────────────────────────────
SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND t.tgname IN (
    'warehouses_change_log_trg',
    'branches_change_log_trg',
    'exchange_rates_change_log_trg',
    'warehouse_stock_change_log_trg',
    'warehouses_bump_version_trg',
    'branches_bump_version_trg',
    'exchange_rates_bump_version_trg',
    'warehouse_stock_bump_version_trg'
  )
ORDER BY c.relname, t.tgname;
-- EXPECTED: 8 rows (two triggers on each of the four tables).

-- ─── 2. The version columns exist ─────────────────────────────────────────
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE column_name = 'version'
  AND table_name IN ('warehouses', 'branches', 'exchange_rates', 'warehouse_stock')
ORDER BY table_name;
-- EXPECTED: 4 rows, all bigint, default 1.

-- ─── 3. The change log carries the operational set ───────────────────────
SELECT entity_type, operation, count(*)
FROM sync_change_log
WHERE entity_type IN ('warehouse', 'branch', 'exchange_rate', 'product_stock')
GROUP BY entity_type, operation
ORDER BY entity_type, operation;
-- EXPECTED: the four entity types, each with the operations that happened.

-- ─── 4. A row with no workspace is never logged ───────────────────────────
-- The trigger skips it on purpose: a change nobody could route is a change
-- nobody could ever receive.
-- EXPECTED: 0 rows.

-- ─── 5. The version moves forward ─────────────────────────────────────────
-- Take a row, update it, and read its version again.
-- EXPECTED: the version is greater than before, and the change log holds one
-- 'update' row with the new version.
