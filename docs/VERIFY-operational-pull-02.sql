-- ============================================================================
-- docs/VERIFY-operational-pull-02.sql
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Run immediately after docs/operational-pull-02-migration.sql.
--
-- Every query below answers a PASS/FAIL word or a count that must equal the
-- number in the comment. Nothing here writes.
-- ============================================================================

-- 1. Every table has its `version` column — expect 4 rows, all HAZ.
SELECT 'version column' AS check, c.relname AS table_name,
       CASE WHEN a.attname IS NOT NULL THEN 'HAZ' ELSE 'NA' END AS result
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_attribute a
  ON a.attrelid = c.oid AND a.attname = 'version' AND NOT a.attisdropped
WHERE c.relname IN (
  'product_variants',
  'service_delivery_sessions',
  'package_credit_ledger',
  'repair_tickets'
)
ORDER BY c.relname;

-- 2. Every table has BOTH triggers — expect 8 rows, all HAZ.
SELECT 'trigger' AS check, c.relname AS table_name, t.tgname,
       CASE WHEN t.tgenabled <> 'D' THEN 'HAZ' ELSE 'NA' END AS result
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE NOT t.tgisinternal
  AND c.relname IN (
    'product_variants',
    'service_delivery_sessions',
    'package_credit_ledger',
    'repair_tickets'
  )
ORDER BY c.relname, t.tgname;

-- 3. The change-log trigger passes the SAME entity name the sync protocol uses.
--    Expect 4 rows; each `entity_type` must match syncEntitySchema in
--    packages/validation/src/schemas/sync-protocol.schema.ts.
SELECT 'change log entity' AS check, c.relname AS table_name, t.tgargs AS entity_type
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE NOT t.tgisinternal
  AND t.tgname LIKE '%_change_log_trg'
  AND c.relname IN (
    'product_variants',
    'service_delivery_sessions',
    'package_credit_ledger',
    'repair_tickets'
  )
ORDER BY c.relname;

-- 4. A client may not execute the trigger functions — expect 0 rows.
SELECT 'procedure privilege leak' AS check, p.proname, r.rolname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
CROSS JOIN pg_roles r
WHERE p.proname IN ('sync_bump_version', 'sync_record_change')
  AND r.rolname IN ('anon', 'authenticated', 'PUBLIC')
  AND has_function_privilege(r.oid, p.oid, 'EXECUTE');

-- 5. The pull function that carries them exists — expect 1 row.
SELECT 'pull function' AS check,
       CASE WHEN to_regprocedure('public.sync_pull_changes_v2(uuid, bigint, int, text[])') IS NOT NULL
            THEN 'HAZ' ELSE 'NA' END AS result;

-- 6. Nothing is in the change log for these four yet on a fresh apply —
--    expect 0 (a non-zero count means rows were written before the migration).
SELECT 'pre-existing log rows' AS check, count(*) AS rows
FROM sync_change_log
WHERE entity_type IN (
  'product_variants',
  'service_delivery_sessions',
  'package_credit_ledger',
  'repair_tickets'
);
