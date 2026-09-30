-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING 7 — WHY DID THE COSTING CORE NEVER RUN?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHAT IS NOW KNOWN
--
--   24 stock movements      0 with a unit_cost
--    1 cost layer           1 consumption
--   24 entries from invoice · 13 invoices exist
--    0 entries from payroll · 0 automatic (depreciation / fx)
--
-- The invoice path ran. The costing path inside it did not. And 24 entries for
-- 13 invoices is two per invoice, which is either correct (a revenue entry and
-- a COGS entry) or a duplicate — and nothing in the data says which.
--
-- ⚠️ THREE QUERIES, RUN SEPARATELY, IN THIS ORDER. They decide whether the
-- problem is historical, structural, or both, and the answers are different
-- fixes.
--
-- ⚠️ NO `//` COMMENTS INSIDE A QUERY. Postgres rejects them, and that is what
-- broke an earlier version of this file twice. Every note lives above the
-- statement it belongs to.
-- ═══════════════════════════════════════════════════════════════════════════


-- ① TWO ENTRIES PER SOURCE — correct, or a posting that ran twice? Every
--     invoice should have one revenue entry. A second with the same source_id and
--     date is a duplicate write, and the ledger key is supposed to prevent it.
SELECT
  '=== ENTRIES PER SOURCE ==='                                           AS section,
  source_type,
  source_id,
  count(*)                                                            AS entries,
  string_agg(status, ',' ORDER BY created_at)                          AS statuses,
  string_agg(coalesce(description, '(none)'), ' | ' ORDER BY created_at) AS descriptions
FROM journal_entries
WHERE source_id IS NOT NULL
GROUP BY source_type, source_id
HAVING count(*) > 1
ORDER BY entries DESC, source_id
LIMIT 30;


-- ② WERE THE COSTLESS MOVEMENTS ALL HISTORICAL? If every one of them predates
--     the costing consolidation, this is a backfill question. If they are spread
--     across months, the costing call is simply not on the live path.
--
--     ⚠️ GROUP BY THE EXPRESSION ITSELF, not its ordinal. `GROUP BY 1` groups by
--     the FIRST SELECT COLUMN, which here is the literal string '=== ... ===',
--     not the month — which is what made the first version of this query fail
--     with 42803.
SELECT
  '=== MOVEMENTS WITHOUT COST, BY MONTH ==='                          AS section,
  to_char(date_trunc('month', created_at), 'YYYY-MM')                 AS month,
  count(*)                                                            AS movements,
  count(*) FILTER (WHERE unit_cost IS NULL)                           AS without_cost,
  round(100.0 * count(*) FILTER (WHERE unit_cost IS NULL) / count(*), 1) AS percent_without
FROM stock_movements
GROUP BY to_char(date_trunc('month', created_at), 'YYYY-MM')
ORDER BY month;


-- ③ WHAT SHAPE ARE THE MOVEMENTS? A purchase receipt with no cost and no
--     destination warehouse never went through the costing engine; one with a
--     warehouse leg but no cost went through the movement path and missed only
--     the valuation. Those are different bugs.
SELECT
  '=== MOVEMENT SHAPES ==='      AS section,
  type,
  (from_warehouse_id IS NOT NULL) AS has_from,
  (to_warehouse_id   IS NOT NULL) AS has_to,
  (unit_cost         IS NOT NULL) AS has_cost,
  count(*)                       AS movements
FROM stock_movements
GROUP BY type, 2, 3, 4
ORDER BY movements DESC;
