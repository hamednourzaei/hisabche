-- ============================================================================
-- VERIFICATION — run AFTER module-created-at-default-migration.sql
-- READ-ONLY. Nothing here changes data or schema.
-- ============================================================================


-- ─── 1. Does each column now carry the default? ───────────────────────────
-- EXPECTED: `column_default` = `now()` on every row.
-- NULL here means the ALTER did not apply to that table.

SELECT  table_name,
        column_name,
        is_nullable,
        column_default
FROM    information_schema.columns
WHERE   table_schema = 'public'
  AND   column_name  = 'created_at'
  AND   table_name IN ('invoices', 'stock_movements', 'invoice_items',
                       'customers', 'products')
ORDER BY table_name;


-- ─── 2. How many old rows still have no creation time? ────────────────────
-- EXPECTED: whatever it was before — this migration deliberately does NOT
-- backfill. These counts should stay constant; only NEW rows get a timestamp.
--
-- ⚠️ If a later session is tempted to "fix" these numbers by copying `date`
-- into `created_at`, read the §12 note in the migration file first. Those two
-- columns mean different things.

SELECT  'invoices'        AS table_name,
        COUNT(*) FILTER (WHERE created_at IS NULL) AS missing_created_at,
        COUNT(*)                                   AS total
FROM    invoices
UNION ALL
SELECT  'stock_movements',
        COUNT(*) FILTER (WHERE created_at IS NULL),
        COUNT(*)
FROM    stock_movements
UNION ALL
SELECT  'invoice_items',
        COUNT(*) FILTER (WHERE created_at IS NULL),
        COUNT(*)
FROM    invoice_items;


-- ─── 3. Prove the default actually fires on a new row ─────────────────────
-- Inserts nothing permanent: the transaction is rolled back.
-- EXPECTED: `created_at` is a real timestamp, not null.

BEGIN;

INSERT INTO invoices (invoice_number, type, date, total, workspace_id)
SELECT  'VERIFY-DEFAULT-DELETEME',
        'sale',
        now(),
        0,
        workspace_id
FROM    invoices
LIMIT   1;

SELECT  invoice_number,
        created_at,
        (created_at IS NOT NULL) AS default_fired
FROM    invoices
WHERE   invoice_number = 'VERIFY-DEFAULT-DELETEME';

ROLLBACK;   -- ⚠️ nothing above is kept
