-- READ-ONLY FINDING — do not run as a migration.
-- PART 5 §6.4: the accounts tenancy question, now RESOLVED by applied DDL.

-- HISTORY. An early survey read base-schema-migration.sql:62, where
-- public.accounts has user_id and no workspace_id. On that evidence the entity
-- was marked OWNER_DECISION_REQUIRED: a change-log trigger could not route its
-- rows to a workspace, and guessing a tenant for historical chart-of-accounts
-- rows would have misattributed financial data.

-- RESOLUTION. docs/accounting-core-migration.sql — already in this repository
-- and applied on the live database — adds accounts.workspace_id and backfills
-- it from the owning membership. The owner has now confirmed from
-- information_schema that accounts has a NOT NULL workspace_id (plus id and
-- user_id). No historical tenant was invented by the coding agent.

-- Therefore the remaining work was engineering, not a business decision:
--   docs/sync-account-tenancy-coverage-migration.sql adds the version column
--   and the change-log trigger under the protocol name 'account';
--   inventory_settings gains a stable id so the generic keyset snapshot and
--   the device's id-based upsert can address its single workspace row.
-- Both can now join PULLED_TABLES / DELTA_ENTITIES.

-- Read-only evidence — run this to re-confirm the premise:
SELECT table_name,
       column_name,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('accounts', 'cost_layers', 'stock_batches', 'stock_serials', 'inventory_settings')
  AND column_name IN ('workspace_id', 'user_id', 'id', 'version')
ORDER BY table_name, column_name;

-- Expected interpretation:
--   accounts            -> workspace_id NOT NULL + id + version  => covered
--   cost_layers         -> workspace_id + id + version            => covered
--   stock_batches       -> workspace_id + id + version            => covered
--   stock_serials       -> workspace_id + id + version            => covered
--   inventory_settings  -> workspace_id + id + version            => covered
