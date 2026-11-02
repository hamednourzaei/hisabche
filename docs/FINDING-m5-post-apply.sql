-- ============================================================================
-- docs/FINDING-m5-post-apply.sql
--
-- READ-ONLY anomaly detection for the owner to run AFTER applying the four M5 migrations (see
-- docs/architecture/universal-business-core/M5-POST-APPLY-CHECKLIST.md). It writes nothing. Each block is its own statement:
-- the SQL Editor shows only the last result, so run them ONE AT A TIME. A healthy database returns ZERO ROWS (or
-- `ok = true`) for every block. Replace nothing; no workspace is hard-coded (every block reports per workspace).
-- Status of the results until the owner pastes them: PENDING HUMAN CONFIRMATION.
-- ============================================================================

-- 1. Posted journal entries that do not balance (expected: no rows)
SELECT je.workspace_id, je.id, ROUND(SUM(jl.debit) - SUM(jl.credit), 2) AS difference
  FROM public.journal_entries je
  JOIN public.journal_lines jl ON jl.journal_id = je.id
 WHERE je.status = 'posted'
 GROUP BY je.workspace_id, je.id
HAVING ROUND(SUM(jl.debit) - SUM(jl.credit), 2) <> 0;

-- 2. Package credit that went negative per customer and package (expected: no rows)
SELECT workspace_id, customer_id, package_product_id,
       SUM(CASE WHEN entry_type IN ('GRANT','ADJUSTMENT','REVERSAL') THEN quantity
                WHEN entry_type IN ('CONSUME','EXPIRE') THEN -quantity ELSE 0 END) AS balance
  FROM public.package_credit_ledger
 WHERE deleted_at IS NULL
 GROUP BY workspace_id, customer_id, package_product_id
HAVING SUM(CASE WHEN entry_type IN ('GRANT','ADJUSTMENT','REVERSAL') THEN quantity
                WHEN entry_type IN ('CONSUME','EXPIRE') THEN -quantity ELSE 0 END) < 0;

-- 3. A GRANT whose selling invoice no longer exists (expected: no rows)
SELECT g.workspace_id, g.id AS grant_id, g.source_document_id AS invoice_id
  FROM public.package_credit_ledger g
 WHERE g.entry_type = 'GRANT' AND g.source_document_type = 'invoice' AND g.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = g.source_document_id AND i.workspace_id = g.workspace_id);

-- 4. Deferred-revenue liability versus the unspent sale-time value of the GRANTs, per workspace (expected: difference = 0)
SELECT w.workspace_id,
       COALESCE(acc.balance, 0) AS ledger_balance,
       COALESCE(gr.deferred, 0) - COALESCE(al.released, 0) AS unspent_sale_time_value,
       ROUND(COALESCE(acc.balance, 0) - (COALESCE(gr.deferred, 0) - COALESCE(al.released, 0)), 2) AS difference
  FROM (SELECT DISTINCT workspace_id FROM public.package_credit_ledger) w
  LEFT JOIN (
    SELECT je.workspace_id, SUM(jl.credit - jl.debit) AS balance
      FROM public.journal_lines jl
      JOIN public.journal_entries je ON je.id = jl.journal_id
      JOIN public.accounts a ON a.id = jl.account_id
     WHERE a.role = 'deferred_revenue' AND je.status = 'posted'
     GROUP BY je.workspace_id) acc ON acc.workspace_id = w.workspace_id
  LEFT JOIN (
    SELECT workspace_id, SUM(deferred_amount) AS deferred
      FROM public.package_credit_ledger WHERE entry_type = 'GRANT' AND deleted_at IS NULL GROUP BY workspace_id) gr
    ON gr.workspace_id = w.workspace_id
  LEFT JOIN (
    SELECT workspace_id, SUM(CASE kind WHEN 'CONSUME' THEN released_amount ELSE -released_amount END) AS released
      FROM public.package_credit_allocations GROUP BY workspace_id) al
    ON al.workspace_id = w.workspace_id
 WHERE ROUND(COALESCE(acc.balance, 0) - (COALESCE(gr.deferred, 0) - COALESCE(al.released, 0)), 2) <> 0;

-- 5. A release recorded in the allocations with no journal entry behind it (expected: no rows)
SELECT a.workspace_id, a.entry_id, a.released_amount
  FROM public.package_credit_allocations a
 WHERE a.kind = 'CONSUME' AND a.released_amount > 0
   AND NOT EXISTS (SELECT 1 FROM public.journal_entries je
                    WHERE je.workspace_id = a.workspace_id AND je.source_type = 'package_release'
                      AND je.source_id = a.entry_id AND je.status <> 'cancelled');

-- 6. A GRANT that releases more than it deferred (expected: no rows)
SELECT g.workspace_id, g.id AS grant_id, g.deferred_amount,
       SUM(CASE a.kind WHEN 'CONSUME' THEN a.released_amount ELSE -a.released_amount END) AS released
  FROM public.package_credit_ledger g
  JOIN public.package_credit_allocations a ON a.grant_entry_id = g.id
 GROUP BY g.workspace_id, g.id, g.deferred_amount
HAVING SUM(CASE a.kind WHEN 'CONSUME' THEN a.released_amount ELSE -a.released_amount END) > COALESCE(g.deferred_amount, 0);

-- 7. Consumptions written AFTER the allocation table existed that have no allocation (expected: no rows; older ones are legacy)
SELECT c.workspace_id, c.id AS consume_id, c.created_at
  FROM public.package_credit_ledger c
 WHERE c.entry_type = 'CONSUME'
   AND c.created_at >= (SELECT COALESCE(MIN(created_at), now()) FROM public.package_credit_allocations)
   AND NOT EXISTS (SELECT 1 FROM public.package_credit_allocations a WHERE a.entry_id = c.id);

-- 8. Inventory sub-ledger (remaining layers x unit cost, books currency) versus the inventory ledger account, per workspace
--    (informational: stock written before costing existed may differ; review any difference, do not auto-correct)
SELECT l.workspace_id, ROUND(l.layers_value, 2) AS layers_value, ROUND(COALESCE(g.balance, 0), 2) AS inventory_account_balance,
       ROUND(l.layers_value - COALESCE(g.balance, 0), 2) AS difference
  FROM (SELECT workspace_id, SUM(remaining_qty * unit_cost) AS layers_value FROM public.cost_layers GROUP BY workspace_id) l
  LEFT JOIN (
    SELECT je.workspace_id, SUM(jl.debit - jl.credit) AS balance
      FROM public.journal_lines jl
      JOIN public.journal_entries je ON je.id = jl.journal_id
      JOIN public.accounts a ON a.id = jl.account_id
     WHERE a.role = 'inventory' AND je.status = 'posted'
     GROUP BY je.workspace_id) g ON g.workspace_id = l.workspace_id
 WHERE ROUND(l.layers_value - COALESCE(g.balance, 0), 2) <> 0;

-- 9. A scrapped return line with no loss entry behind it (expected: only returns created BEFORE invoice-return-06)
SELECT r.workspace_id, r.id AS return_id, r.return_date
  FROM public.invoice_returns r
 WHERE r.return_type = 'sale_return'
   AND EXISTS (SELECT 1 FROM public.invoice_return_lines l WHERE l.return_id = r.id AND l.restock_choice = 'scrap')
   AND NOT EXISTS (SELECT 1 FROM public.journal_entries je
                    WHERE je.workspace_id = r.workspace_id AND je.source_type = 'return_scrap_loss' AND je.source_id = r.id);
