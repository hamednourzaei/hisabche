-- ═══════════════════════════════════════════════════════════════════════════
-- TEST A — BEFORE: a baseline to prove the test changed nothing else
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ RUN THIS FIRST, AND SAVE THE OUTPUT.
--
-- The test below creates a product, buys it, sells it. It is supposed to make
-- ONE new cost layer and ONE new consumption. This snapshot is how we prove it
-- did that and nothing else — so a surprise later is attributable rather than
-- merely suspicious.
--
-- ⚠️ WHY A BASELINE AT ALL: lesson 12 says a repair with a guess in it is worse
-- than no repair, and the only defence against a guess is a number taken before
-- the change.
--
-- ⚠️ RUN THIS QUERY ALONE.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  '=== BEFORE ==='                                              AS section,
  (SELECT count(*) FROM products)                                AS products,
  (SELECT count(*) FROM stock_movements)                          AS movements,
  (SELECT count(*) FROM stock_movements WHERE unit_cost IS NOT NULL) AS movements_with_cost,
  (SELECT count(*) FROM cost_layers)                             AS layers,
  (SELECT count(*) FROM cost_consumptions)                       AS consumptions,
  (SELECT count(*) FROM invoices)                                AS invoices,
  (SELECT count(*) FROM journal_entries)                         AS entries,
  (SELECT count(*) FROM journal_lines)                           AS lines,
  (SELECT count(*) FROM payments)                                AS payments;
