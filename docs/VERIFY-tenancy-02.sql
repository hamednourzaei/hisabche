-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT
  count(*) FILTER (WHERE is_nullable = 'NO') AS not_null_tables,
  count(*) FILTER (WHERE is_nullable = 'YES') AS still_nullable_tables
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND c.column_name = 'workspace_id';
