-- VERIFY for docs/workspace-signature-01-migration.sql — read-only.
-- One row; `ok` must be true.
select
  'workspaces.signature_url' as what,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workspaces'
      and column_name = 'signature_url'
      and data_type = 'text'
      and is_nullable = 'YES'
  ) as ok;
