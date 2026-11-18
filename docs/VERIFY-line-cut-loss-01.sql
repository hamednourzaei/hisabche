-- ============================================================================
-- HISABCHE — VERIFY docs/line-cut-loss-01-migration.sql (WP-03)
--
-- READ-ONLY. Every query below is a SELECT; nothing here writes, and running
-- it twice changes nothing. Run it after the migration and paste the result.
--
-- ⚠️ Read the numbers, not just the ✓/✗. A check that finds rows is a finding,
-- not a failure of this script.
-- ============================================================================

-- 1. The column exists with the type, default and NOT NULL the code expects.
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoice_items'
  AND column_name = 'cut_loss_quantity';
-- EXPECT: one row · numeric · 12 · 3 · NO · 0

-- 2. Both constraints exist and are VALIDATED (an unvalidated one protects only
--    new rows, and its absence is not visible on any screen).
SELECT conname, convalidated,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.invoice_items'::regclass
  AND conname IN ('invoice_items_cut_loss_non_negative', 'invoice_items_cut_loss_measured_unit')
ORDER BY conname;
-- EXPECT: two rows, both convalidated = true

-- 3. No line holds a negative loss. EXPECT: 0 rows.
SELECT id, invoice_id, quantity, cut_loss_quantity
FROM invoice_items
WHERE cut_loss_quantity < 0;

-- 4. No line records a loss on a COUNT unit. EXPECT: 0 rows.
SELECT id, invoice_id, unit, cut_loss_quantity
FROM invoice_items
WHERE cut_loss_quantity > 0
  AND unit NOT IN ('gram', 'kg', 'meter', 'liter', 'custom');

-- 5. No PURCHASE line records a loss (a delivery arrives intact; the refused
--    case is a damaged delivery, which is a supplier claim, not a cut).
--    EXPECT: 0 rows.
SELECT ii.id, ii.invoice_id, i.type AS invoice_type, ii.cut_loss_quantity
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
WHERE ii.cut_loss_quantity > 0
  AND i.type = 'purchase';

-- 6. How much loss has been recorded so far, per unit. EXPECT: the lines a
--    person actually entered — 0 rows means nobody has used the feature yet,
--    which is a fact about usage, not about the migration.
SELECT unit, COUNT(*) AS lines, SUM(cut_loss_quantity) AS total_loss
FROM invoice_items
WHERE cut_loss_quantity > 0
GROUP BY unit
ORDER BY unit;

-- 7. Each line's loss against the stock movement it produced, for a human to
--    eyeball. The movement is the source of truth for what the shelf lost, so a
--    line whose movement is smaller than quantity + loss is a real finding.
--    (Base-unit conversion makes an exact comparison a code rule, not SQL; this
--    query only lists what was written.)
SELECT ii.invoice_id,
       ii.id           AS line_id,
       ii.product_id,
       ii.quantity,
       ii.cut_loss_quantity,
       ii.unit,
       SUM(sm.quantity) AS moved
FROM invoice_items ii
LEFT JOIN stock_movements sm
  ON sm.reference_type = 'invoice'
 AND sm.reference_id = ii.invoice_id
 AND sm.product_id = ii.product_id
WHERE ii.cut_loss_quantity > 0
GROUP BY ii.invoice_id, ii.id, ii.product_id, ii.quantity, ii.cut_loss_quantity, ii.unit
ORDER BY ii.invoice_id, ii.id;

-- 8. Historical rows were not rewritten: any invoice written before the
--    migration reads 0 and still foots. EXPECT: 0 rows with a NULL loss.
SELECT COUNT(*) AS rows_with_null_loss
FROM invoice_items
WHERE cut_loss_quantity IS NULL;
