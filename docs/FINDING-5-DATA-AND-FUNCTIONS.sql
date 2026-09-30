-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING 5 — DOES THE ACCOUNTING CORE HAVE ANY DATA, AND DO ITS FUNCTIONS
--              EXIST?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS MATTERS MORE THAN ANY COUNT ABOVE
--
-- The dump settled which TABLES exist. It did not settle whether the FUNCTIONS
-- exist, and the functions are where the guarantees live:
--
--   invoice_write_document   one transaction for header, lines and movements
--   payments_record_keyed    idempotency under a unique key
--   purchase_order_write    atomic order + reservation
--   budget_consumption      what capability #128 reads
--
-- `HANDOFF-PHASES-G-TO-O.md` marks 54 files PENDING HUMAN CONFIRMATION. Until
-- this answers, "idempotent" and "atomic" are statements about text files.
--
-- ⚠️ RUN THE TWO QUERIES IN THIS FILE SEPARATELY. Postgres rejects `//`
-- comments, so each one is a single self-contained statement.
-- ═══════════════════════════════════════════════════════════════════════════


-- ① THE FINANCIAL FUNCTIONS. `installed` is what matters; `body` is optional
--     context and can be very long.
SELECT
  '=== FINANCIAL FUNCTIONS ==='                                              AS section,
  n.nspname                                                                   AS schema,
  p.proname                                                                   AS function,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END                 AS security,
  l.lanname                                                                    AS language,
  p.prosrc IS NOT NULL                                                        AS installed
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE p.proname IN (
  'invoice_write_document',
  'payments_record',
  'payments_record_keyed',
  'payments_cancel',
  'purchase_order_write',
  'warehouse_transfer_stock',
  'warehouse_transfer_stock_keyed',
  'budget_consumption',
  'budget_performance_batch',
  'budget_apply_revision',
  'accounting_post_journal_entry',
  'accounting_trial_balance',
  'accounting_period_locked',
  'pos_record_order',
  'inventory_consume_layers',
  'inventory_receive_layer',
  'inventory_release_consumption',
  'inventory_valuation',
  'get_next_invoice_number',
  'invoices_project_settlement',
  'stock_movements_project',
  'create_sandbox_workspace',
  'cost_reposts'
)
ORDER BY p.proname, n.nspname;


-- ② HOW MUCH ACCOUNTING DATA EXISTS. Zero rows through the core means every
--     financial capability in the 150 is untestable on this database, and that
--     is a fact to know before writing more code against it.
SELECT
  '=== FINANCIAL DATA VOLUME ==='                                             AS section,
  (SELECT count(*) FROM workspaces)              AS workspaces,
  (SELECT count(*) FROM accounts)                AS accounts,
  (SELECT count(*) FROM journal_entries)         AS journal_entries,
  (SELECT count(*) FROM journal_lines)           AS journal_lines,
  (SELECT count(*) FROM invoices)                AS invoices,
  (SELECT count(*) FROM invoice_items)            AS invoice_items,
  (SELECT count(*) FROM payments)                 AS payments,
  (SELECT count(*) FROM payment_allocations)      AS payment_allocations,
  (SELECT count(*) FROM products)                AS products,
  (SELECT count(*) FROM customers)                AS customers,
  (SELECT count(*) FROM stock_movements)          AS stock_movements,
  (SELECT count(*) FROM cost_layers)              AS cost_layers,
  (SELECT count(*) FROM cost_consumptions)        AS cost_consumptions,
  (SELECT count(*) FROM pos_sessions)             AS pos_sessions,
  (SELECT count(*) FROM budgets)                  AS budgets,
  (SELECT count(*) FROM subscriptions)            AS subscriptions;
