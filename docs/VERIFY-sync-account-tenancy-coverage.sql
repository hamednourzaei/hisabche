-- Verification for docs/sync-account-tenancy-coverage-migration.sql.
-- Run after applying the migration. Every answer below must be true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.

-- 1. accounts has a NOT NULL workspace_id and a version column.
SELECT
  bool_and(column_name IN ('id', 'workspace_id', 'version', 'user_id')) AS accounts_columns_ok,
  count(*) FILTER (WHERE column_name = 'workspace_id' AND is_nullable = 'NO') AS workspace_not_null
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'accounts';

-- 2. Both bump triggers and both change-log triggers exist.
SELECT tgname, tgrelid::regclass AS table_name, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN (
    'accounts_bump_version_trg', 'accounts_change_log_trg',
    'inventory_settings_bump_version_trg', 'inventory_settings_change_log_trg'
  )
ORDER BY tgname;

-- 3. The log carries the PROTOCOL entity names the device filters on.
SELECT DISTINCT entity_type
FROM sync_change_log
WHERE entity_type IN ('account', 'inventory_settings')
ORDER BY entity_type;

-- 4. inventory_settings rows all have a stable, unique id.
SELECT
  count(*) AS total_rows,
  count(*) FILTER (WHERE id IS NULL) AS rows_without_id,
  count(DISTINCT id) AS distinct_ids
FROM inventory_settings;

-- 5. No account or settings row may sit outside a workspace.
SELECT
  (SELECT count(*) FROM accounts WHERE workspace_id IS NULL) AS accounts_without_workspace,
  (SELECT count(*) FROM inventory_settings WHERE workspace_id IS NULL) AS settings_without_workspace;
