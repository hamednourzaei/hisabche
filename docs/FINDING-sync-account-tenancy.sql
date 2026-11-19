-- READ-ONLY FINDING — do not run as a migration.
-- PART 5 §6.4: why `account` cannot join the sync delta at current HEAD.

-- 1. The local engine and the device both own an `account` table, and local
--    routes read it. It is in NOT_PULLED_YET, so on a device it holds only what
--    that device wrote.
-- 2. The server owns `public.accounts` (base-schema-migration.sql:62). That
--    table has `user_id`, NOT `workspace_id`. The canonical
--    sync_record_change() trigger reads NEW.workspace_id to route a change to
--    a pull; without the column it would either fail every INSERT/UPDATE or
--    log a change no workspace can ever receive.
-- 3. Adding workspace_id requires a TENANCY backfill decision: which workspace
--    owns historical accounts that currently carry only user_id? Inventing one
--    would silently misattribute financial chart-of-accounts data. That is an
--    OWNER_DECISION_REQUIRED — not something this migration may guess.

-- Read-only evidence for the owner:
SELECT table_name,
       column_name,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('accounts', 'cost_layers', 'stock_batches', 'stock_serials', 'inventory_settings')
  AND column_name IN ('workspace_id', 'user_id', 'id')
ORDER BY table_name, column_name;

-- Expected interpretation:
--   accounts            -> workspace_id ABSENT, user_id PRESENT  => BLOCKED
--   cost_layers         -> workspace_id + id                     => covered by
--                           docs/sync-entity-coverage-migration.sql
--   stock_batches       -> workspace_id + id                     => covered
--   stock_serials       -> workspace_id + id                     => covered
--   inventory_settings  -> workspace_id (no id)                  => covered by
--                           the workspace-keyed trigger variant
