-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING 6 — DID THE DATA COME THROUGH THE SAFE PATH?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHAT THE VOLUME QUERY ANSWERED, AND WHAT IT LEFT OPEN
--
-- 57 journal entries, 13 invoices, 33 payments, 24 stock movements. The ledger
-- is real and working.
--
-- But `cost_layers: 1` and `cost_consumptions: 1` against 24 stock movements is
-- the number that matters. It says the FIFO core — the thing every margin in
-- this product is computed from — has been used once, on one sale.
--
-- Two explanations, and they need different fixes:
--
--   a) The other 23 movements predate `phase-c-01` and were never backfilled.
--      Then the books say one thing and the movements explain another, and
--      #69 would "correct" nothing because there is nothing to correct.
--   b) Everything after the migration also bypassed the layers.
--      Then the costing core is written, tested and not on the live path.
--
-- ⚠️ `journal_entries.source_type` settles it in ONE query: it records which
-- engine produced each entry. `invoice` means the invoice path ran; a missing
-- or `manual` value means it did not.
--
-- ⚠️ RUN EACH QUERY IN THIS FILE SEPARATELY.
-- ═══════════════════════════════════════════════════════════════════════════


-- ① WHICH ENGINE PRODUCED EACH ENTRY. This is the cheapest way to tell whether
--     the write functions exist AND were used.
SELECT
  '=== ENTRY SOURCE ==='                              AS section,
  source_type,
  count(*)                                            AS entries,
  count(*) FILTER (WHERE status = 'posted')            AS posted,
  min(date)::date                                     AS first_entry,
  max(date)::date                                     AS last_entry
FROM journal_entries
GROUP BY source_type
ORDER BY entries DESC;


-- ② THE COSTING PATH. Every movement should carry a layer, and every sale
--     should have consumed one. Movements without either are the gap.
SELECT
  '=== COSTING COVERAGE ==='                                           AS section,
  (SELECT count(*) FROM stock_movements)                              AS movements,
  (SELECT count(*) FROM cost_consumptions)                            AS consumptions,
  (SELECT count(*) FROM cost_layers)                                  AS layers,
  (SELECT count(*) FROM stock_movements
    WHERE unit_cost IS NOT NULL)                                       AS movements_with_unit_cost,
  (SELECT count(*) FROM cost_consumptions WHERE is_estimated)          AS estimated_consumptions,
  (SELECT count(*) FROM journal_entries
    WHERE source_type = 'invoice')                                     AS invoice_entries,
  (SELECT count(*) FROM journal_entries
    WHERE source_type = 'pos_session')                                 AS pos_entries,
  (SELECT count(*) FROM journal_entries
    WHERE source_type = 'payroll')                                     AS payroll_entries,
  (SELECT count(*) FROM journal_entries
    WHERE source_type IN ('depreciation','fx_revaluation'))            AS automatic_entries;
