-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING 8 — DO THE COSTING FUNCTIONS EXIST ON THIS DATABASE?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHAT IS NOW KNOWN, AND WHY THIS IS THE DECISIVE QUERY
--
--   23 of 23 stock movements in September 2026 have NO unit_cost
--    1 of 24 have no month at all — created_at is NULL
--    1 cost layer, 1 consumption, total
--
-- `invoice.service.ts:2420` DOES call `costing.recordIssue`, and the catch at
-- 2440 rethrows rather than swallowing — so a failure there stops the invoice
-- from being written at all. Yet 24 journal entries exist for 13 invoices.
--
-- That combination has exactly one explanation that fits: those entries were
-- written by a version of the service that did not call costing, OR costing
-- called an RPC that does not exist here and the fallback path wrote the
-- movements directly.
--
-- ⚠️ `CostingRepository.consumeLayers` and `receiveLayer` go through
-- `.rpc('inventory_consume_layers')` and `.rpc('inventory_receive_layer')`.
-- `aggregate-rpc.ts` documents the fallback exactly: PGRST202 or 42883 means the
-- function is NOT INSTALLED, the code logs a warning and carries on. That is a
-- silent success path, and it is the most likely reason 24 movements have no
-- cost.
--
-- ⚠️ SO THIS QUERY IS THE ANSWER. If these four are absent, the FIFO core has
-- never run on this database, and every analytical capability written in Phase 1
-- is computing from nothing.
--
-- ⚠️ RUN EACH QUERY SEPARATELY. No `//` comments inside a statement.
-- ═══════════════════════════════════════════════════════════════════════════


-- ① THE COSTING FUNCTIONS. These four are what `CostingRepository` calls by name.
SELECT
  '=== COSTING FUNCTIONS ==='                        AS section,
  n.nspname                                            AS schema,
  p.proname                                            AS function,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  p.proname IS NOT NULL                                AS installed
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN (
  'inventory_consume_layers',
  'inventory_receive_layer',
  'inventory_release_consumption',
  'inventory_valuation',
  'cost_reposts',
  'invoice_write_document',
  'payments_record_keyed',
  'purchase_order_write',
  'budget_consumption',
  'warehouse_transfer_stock_keyed'
)
ORDER BY p.proname, n.nspname;


-- ② AND THE FUNCTIONS THAT MAKE THE DATA WRITES ATOMIC. Same question, for the
--     idempotency guarantees: these are the ones whose absence turns "safe" into
--     "probably fine".
SELECT
  '=== WRITE FUNCTIONS ==='                           AS section,
  n.nspname                                            AS schema,
  p.proname                                            AS function,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  p.prosrc                                             AS body
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN (
  'invoice_write_document',
  'payments_record',
  'payments_record_keyed',
  'payments_cancel',
  'purchase_order_write',
  'pos_record_order',
  'accounting_post_journal_entry',
  'stock_movements_project',
  'invoices_project_settlement'
)
ORDER BY p.proname;


-- ③ THE MIGRATION LEDGER. If this is empty, nothing was ever run through
--     `run-migrations.mjs` and every "applied" claim came from pasting a file.
--     `to_regclass` returns NULL instead of raising, so this is safe either way.
SELECT
  '=== MIGRATION LEDGER ==='                          AS section,
  to_regclass('public.schema_migrations')              AS ledger_exists,
  (SELECT count(*) FROM schema_migrations)             AS applied_count,
  to_regclass('private.auth_workspace_ids')           AS private_helper,
  to_regnamespace('private')                          AS private_schema;
