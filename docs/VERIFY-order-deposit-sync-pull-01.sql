-- ============================================================================
-- Verification: docs/VERIFY-order-deposit-sync-pull-01.sql
-- Name: Post-migration verification for order deposit delta pull
-- Applies to: docs/order-deposit-sync-pull-01-migration.sql
-- Date: 2026-11-03
--
-- READ THIS FIRST
--
-- This file only READS. It is meant to be pasted into the Supabase SQL editor
-- after the migration, and the three expectations at the bottom of each block
-- are what a human compares against. Nothing here writes, drops or disables a
-- trigger.
--
-- Expected results:
--   Query 1 — three rows, one per table, each `version` bigint NOT NULL.
--   Query 2 — six triggers, one change-log and one bump-version per table.
--   Query 3 — missing_log_rows = 0 AND total_deposit_rows > 0.
--   Query 4 — three rows, one per entity name, each change_rows > 0.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The version column exists, is BIGINT and cannot be NULL
-- ----------------------------------------------------------------------------
-- Expected: one row per table, `is_nullable = NO`, `data_type = bigint`.

SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name = 'version'
  AND c.table_name IN (
    'order_deposits',
    'order_deposit_applications',
    'order_deposit_refunds'
  )
ORDER BY c.table_name;

-- ----------------------------------------------------------------------------
-- 2. Every table has BOTH triggers, each ENABLED
-- ----------------------------------------------------------------------------
-- Expected: 6 rows — bump_version BEFORE UPDATE, change_log AFTER INSERT OR
-- UPDATE, for each of the three tables. `tgenabled = 'O'` means enabled.

SELECT
  t.tgrelid::regclass::text      AS table_name,
  t.tgname                        AS trigger_name,
  t.tgenabled                     AS enabled,
  pg_get_triggerdef(t.oid)        AS definition
FROM pg_trigger t
WHERE t.tgrelid IN (
    'public.order_deposits'::regclass,
    'public.order_deposit_applications'::regclass,
    'public.order_deposit_refunds'::regclass
  )
  AND NOT t.tgisinternal
ORDER BY table_name, trigger_name;

-- ----------------------------------------------------------------------------
-- 3. Nothing that exists is missing from the change log
-- ----------------------------------------------------------------------------
-- The backfill in the migration is what makes a device that already holds a
-- cursor receive the deposit history. If either count is not 0, the backfill
-- did not run (or ran against a table that has no `version` column yet).
--
-- Expected: one row, both columns 0.

WITH missing AS (
  SELECT 'order_deposits' AS entity_type, d.id
    FROM public.order_deposits d
   WHERE NOT EXISTS (
     SELECT 1 FROM public.sync_change_log l
      WHERE l.entity_type = 'order_deposits' AND l.entity_id = d.id
   )
  UNION ALL
  SELECT 'order_deposit_applications', a.id
    FROM public.order_deposit_applications a
   WHERE NOT EXISTS (
     SELECT 1 FROM public.sync_change_log l
      WHERE l.entity_type = 'order_deposit_applications' AND l.entity_id = a.id
   )
  UNION ALL
  SELECT 'order_deposit_refunds', r.id
    FROM public.order_deposit_refunds r
   WHERE NOT EXISTS (
     SELECT 1 FROM public.sync_change_log l
      WHERE l.entity_type = 'order_deposit_refunds' AND l.entity_id = r.id
   )
)
SELECT
  (SELECT COUNT(*) FROM missing) AS missing_log_rows,
  (
    (SELECT COUNT(*) FROM public.order_deposits) +
    (SELECT COUNT(*) FROM public.order_deposit_applications) +
    (SELECT COUNT(*) FROM public.order_deposit_refunds)
  ) AS total_deposit_rows;

-- ----------------------------------------------------------------------------
-- 4. The three entity names are what the server accepts
-- ----------------------------------------------------------------------------
-- The pull is routed by `entity_type`. A log row written under a name the
-- client does not know would be delivered and then dropped on the device.
--
-- Expected: three distinct entity_type values, exactly the ones below.

SELECT entity_type, COUNT(*) AS change_rows
FROM public.sync_change_log
WHERE entity_type IN (
    'order_deposits',
    'order_deposit_applications',
    'order_deposit_refunds'
  )
GROUP BY entity_type
ORDER BY entity_type;
