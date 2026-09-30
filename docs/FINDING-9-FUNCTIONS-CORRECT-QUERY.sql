-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING 9 — THE FUNCTIONS, ASKED CORRECTLY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY FINDING 8 ASKED THE WRONG QUESTION AND THIS ONE DOES NOT
--
-- Finding 8 asked `to_regclass('private.auth_workspace_ids')`. That was wrong:
-- `to_regclass` resolves TABLES, VIEWS and SEQUENCES. A FUNCTION is resolved by
-- `to_regprocedure`, and the answer came back NULL — which read as "the helper
-- is missing" when in fact every policy in the database calls it.
--
-- ⚠️ A guard written from the wrong vocabulary produces a confident wrong
-- answer. That is the third time in this project: BUG-029 (comment order),
-- BUG-065 (`public.` vs `private.` prefix), and this.
--
-- ⚠️ THIS QUERY LISTS WHAT EXISTS rather than asking about named functions. A
-- list cannot be wrong by omission, and it also reveals functions nobody in the
-- codebase knows about.
--
-- ⚠️ RUN EACH QUERY SEPARATELY. No `//` comments inside a statement.
-- ═══════════════════════════════════════════════════════════════════════════


-- ① THE COSTING FUNCTIONS, asked as "is this name a function at all" rather
--     than "is this exactly this signature in this schema".
SELECT
  '=== COSTING FUNCTIONS ==='                        AS section,
  n.nspname                                            AS schema,
  p.proname                                            AS function,
  pg_get_function_identity_arguments(p.oid)           AS args,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  COALESCE(p.proconfig::text, '-')                    AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN (
  'inventory_consume_layers',
  'inventory_receive_layer',
  'inventory_release_consumption',
  'inventory_valuation'
)
ORDER BY p.proname;


-- ② THE WRITE FUNCTIONS — the idempotency and atomicity guarantees.
SELECT
  '=== WRITE FUNCTIONS ==='                           AS section,
  n.nspname                                            AS schema,
  p.proname                                            AS function,
  pg_get_function_identity_arguments(p.oid)           AS args,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security
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
  'accounting_trial_balance',
  'accounting_period_locked',
  'stock_movements_project',
  'invoices_project_settlement',
  'budget_consumption',
  'budget_performance_batch',
  'get_next_invoice_number',
  'warehouse_transfer_stock',
  'warehouse_transfer_stock_keyed',
  'create_sandbox_workspace'
)
ORDER BY p.proname;


-- ③ THE HELPER, asked the right way, plus everything in `private` whatever it
--     is called. BUG-065 moved the RLS helpers into `private`, and a policy
--     written without that prefix fails 42883 — so the schema and its contents
--     are worth seeing in full.
SELECT
  '=== PRIVATE SCHEMA CONTENTS ==='                   AS section,
  n.nspname                                            AS schema,
  p.proname                                            AS object,
  CASE p.prokind WHEN 'f' THEN 'FUNCTION' ELSE p.prokind::text END AS kind,
  CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
ORDER BY p.proname;


-- ④ WHAT THE 39 MIGRATIONS ACTUALLY RAN. Named, so a missing one is a name
--     rather than a feeling — and this is the list to compare against the 54
--     files marked PENDING HUMAN CONFIRMATION.
SELECT
  '=== APPLIED MIGRATIONS ==='                         AS section,
  t.name                                               AS migration,
  t.applied_at                                         AS applied_at
FROM schema_migrations t
ORDER BY t.applied_at;
