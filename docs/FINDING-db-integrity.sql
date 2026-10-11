-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING — DATABASE INTEGRITY (11 Oct 2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. Every statement is a SELECT. Nothing is created, altered or
-- written. Run each block on its own in the SQL Editor and send the output.
--
-- WHY THIS COMES BEFORE ANY MIGRATION
--
-- The plan is to move eight rules from «the code behaves» to «the database
-- refuses»: tenant columns, cross-tenant references, currency, journal balance,
-- the cost chain, payment currency, orphans, and the legacy tables. A
-- constraint cannot be added over rows that already break it — the migration
-- would fail, or worse, be written to tolerate them. These blocks count the
-- rows that break each rule TODAY, so each migration can be written for the
-- database that exists.
--
-- A block that returns no rows means: nothing breaks that rule.
--
-- No double-slash comments inside a query: Postgres rejects them.
-- ═══════════════════════════════════════════════════════════════════════════


-- A1. TENANT COLUMN — rows with no workspace on the tables that carry money
--     or stock. Each of these is a row no workspace filter can see.
SELECT 'accounts' AS table_name, COUNT(*) AS rows_without_workspace FROM accounts WHERE workspace_id IS NULL
UNION ALL SELECT 'journal_entries', COUNT(*) FROM journal_entries WHERE workspace_id IS NULL
UNION ALL SELECT 'journal_lines', COUNT(*) FROM journal_lines WHERE workspace_id IS NULL
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices WHERE workspace_id IS NULL
UNION ALL SELECT 'invoice_items', COUNT(*) FROM invoice_items WHERE workspace_id IS NULL
UNION ALL SELECT 'products', COUNT(*) FROM products WHERE workspace_id IS NULL
UNION ALL SELECT 'customers', COUNT(*) FROM customers WHERE workspace_id IS NULL
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers WHERE workspace_id IS NULL
UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements WHERE workspace_id IS NULL
UNION ALL SELECT 'warehouses', COUNT(*) FROM warehouses WHERE workspace_id IS NULL
UNION ALL SELECT 'warehouse_stock', COUNT(*) FROM warehouse_stock WHERE workspace_id IS NULL
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions WHERE workspace_id IS NULL
UNION ALL SELECT 'employees', COUNT(*) FROM employees WHERE workspace_id IS NULL
UNION ALL SELECT 'payrolls', COUNT(*) FROM payrolls WHERE workspace_id IS NULL
ORDER BY 2 DESC, 1;


-- A2. TENANT COLUMN — the catalogue's view: every public table, whether it has
--     a workspace_id, whether that column may be NULL, and whether a foreign
--     key ties it to workspaces. «has_fk = false» is a tenant column the
--     database does not check.
SELECT
  t.table_name,
  (c.column_name IS NOT NULL)              AS has_workspace_id,
  COALESCE(c.is_nullable = 'YES', false)   AS workspace_id_nullable,
  EXISTS (
    SELECT 1
      FROM pg_constraint k
      JOIN pg_attribute a
        ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
     WHERE k.contype = 'f'
       AND k.conrelid = format('public.%I', t.table_name)::regclass
       AND k.confrelid = 'public.workspaces'::regclass
       AND a.attname = 'workspace_id'
  )                                         AS has_fk
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
  ON c.table_schema = t.table_schema
 AND c.table_name = t.table_name
 AND c.column_name = 'workspace_id'
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY has_workspace_id, has_fk, workspace_id_nullable DESC, t.table_name;


-- B1. CROSS-TENANT REFERENCES — a row in one workspace pointing at a row of
--     another. The foreign keys check the id and nothing else, so only this
--     query can say whether it has ever happened. Every count should be 0.
SELECT 'journal_lines → accounts' AS reference, COUNT(*) AS crossing_rows
  FROM journal_lines l JOIN accounts a ON a.id = l.account_id
 WHERE l.workspace_id IS DISTINCT FROM a.workspace_id
UNION ALL
SELECT 'journal_lines → journal_entries', COUNT(*)
  FROM journal_lines l JOIN journal_entries e ON e.id = l.journal_id
 WHERE l.workspace_id IS DISTINCT FROM e.workspace_id
UNION ALL
SELECT 'invoice_items → invoices', COUNT(*)
  FROM invoice_items i JOIN invoices v ON v.id = i.invoice_id
 WHERE i.workspace_id IS NOT NULL AND i.workspace_id IS DISTINCT FROM v.workspace_id
UNION ALL
SELECT 'invoice_items → products', COUNT(*)
  FROM invoice_items i
  JOIN invoices v ON v.id = i.invoice_id
  JOIN products p ON p.id = i.product_id
 WHERE v.workspace_id IS DISTINCT FROM p.workspace_id
UNION ALL
SELECT 'invoices → customers', COUNT(*)
  FROM invoices v JOIN customers c ON c.id = v.customer_id
 WHERE v.workspace_id IS DISTINCT FROM c.workspace_id
UNION ALL
SELECT 'invoices → suppliers', COUNT(*)
  FROM invoices v JOIN suppliers s ON s.id = v.supplier_id
 WHERE v.workspace_id IS DISTINCT FROM s.workspace_id
UNION ALL
SELECT 'payment_allocations → payments', COUNT(*)
  FROM payment_allocations x JOIN payments p ON p.id = x.payment_id
 WHERE x.workspace_id IS DISTINCT FROM p.workspace_id
UNION ALL
SELECT 'payment_allocations → invoices', COUNT(*)
  FROM payment_allocations x JOIN invoices v ON v.id = x.invoice_id
 WHERE x.workspace_id IS DISTINCT FROM v.workspace_id
UNION ALL
SELECT 'cost_layers → products', COUNT(*)
  FROM cost_layers l JOIN products p ON p.id = l.product_id
 WHERE l.workspace_id IS DISTINCT FROM p.workspace_id
UNION ALL
SELECT 'cost_consumptions → cost_layers', COUNT(*)
  FROM cost_consumptions c JOIN cost_layers l ON l.id = c.layer_id
 WHERE c.workspace_id IS DISTINCT FROM l.workspace_id
UNION ALL
SELECT 'stock_movements → products', COUNT(*)
  FROM stock_movements m JOIN products p ON p.id = m.product_id
 WHERE m.workspace_id IS DISTINCT FROM p.workspace_id
ORDER BY 2 DESC, 1;


-- B2. ORPHANS — references that have no foreign key at all, so the row they
--     point at may be gone. Every count should be 0.
SELECT 'payment_allocations.invoice_id' AS reference, COUNT(*) AS orphan_rows
  FROM payment_allocations x
 WHERE NOT EXISTS (SELECT 1 FROM invoices v WHERE v.id = x.invoice_id)
UNION ALL
SELECT 'cost_layers.product_id', COUNT(*)
  FROM cost_layers l
 WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = l.product_id)
UNION ALL
SELECT 'cost_consumptions.layer_id', COUNT(*)
  FROM cost_consumptions c
 WHERE c.layer_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM cost_layers l WHERE l.id = c.layer_id)
UNION ALL
SELECT 'cost_consumptions.product_id', COUNT(*)
  FROM cost_consumptions c
 WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = c.product_id)
UNION ALL
SELECT 'journal_entries.reversal_of', COUNT(*)
  FROM journal_entries e
 WHERE e.reversal_of IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM journal_entries o WHERE o.id = e.reversal_of)
UNION ALL
SELECT 'journal_lines.journal_id is null', COUNT(*) FROM journal_lines WHERE journal_id IS NULL
UNION ALL
SELECT 'journal_lines.account_id is null', COUNT(*) FROM journal_lines WHERE account_id IS NULL
UNION ALL
SELECT 'payments.journal_entry_id', COUNT(*)
  FROM payments p
 WHERE p.journal_entry_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = p.journal_entry_id)
ORDER BY 2 DESC, 1;


-- C1. JOURNAL BALANCE — posted entries whose debits and credits differ. The
--     posting function refuses these; nothing stops a row written around it.
SELECT
  e.workspace_id,
  e.id            AS entry_id,
  e.entry_number,
  e.date,
  e.source_type,
  SUM(l.debit)    AS total_debit,
  SUM(l.credit)   AS total_credit,
  SUM(l.debit) - SUM(l.credit) AS difference
FROM journal_entries e
JOIN journal_lines l ON l.journal_id = e.id
WHERE e.status = 'posted'
  AND e.deleted_at IS NULL
GROUP BY e.workspace_id, e.id, e.entry_number, e.date, e.source_type
HAVING SUM(l.debit) <> SUM(l.credit)
ORDER BY ABS(SUM(l.debit) - SUM(l.credit)) DESC
LIMIT 200;


-- C2. JOURNAL LINES — shapes a line must never have, and posted entries that
--     have no lines at all.
SELECT 'line with a negative amount' AS problem, COUNT(*) AS line_count
  FROM journal_lines WHERE debit < 0 OR credit < 0
UNION ALL
SELECT 'line on both sides at once', COUNT(*)
  FROM journal_lines WHERE debit <> 0 AND credit <> 0
UNION ALL
SELECT 'line with no amount', COUNT(*)
  FROM journal_lines WHERE debit = 0 AND credit = 0
UNION ALL
SELECT 'posted entry with no lines', COUNT(*)
  FROM journal_entries e
 WHERE e.status = 'posted'
   AND e.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM journal_lines l WHERE l.journal_id = e.id)
UNION ALL
SELECT 'two live entries for one source document', COUNT(*)
  FROM (
    SELECT 1
      FROM journal_entries
     WHERE source_id IS NOT NULL
       AND status <> 'cancelled'
       AND deleted_at IS NULL
     GROUP BY workspace_id, source_type, source_id
    HAVING COUNT(*) > 1
  ) AS duplicated
ORDER BY 2 DESC, 1;


-- D1. PAYMENT CURRENCY — a payment settling an invoice of another currency.
--     «100 afghani paid» must not reduce a debt of 100 dollars.
SELECT
  x.workspace_id,
  p.currency                   AS payment_currency,
  COALESCE(v.currency, '(none)') AS invoice_currency,
  COUNT(*)                     AS allocations,
  SUM(x.amount)                AS allocated_amount
FROM payment_allocations x
JOIN payments p ON p.id = x.payment_id
JOIN invoices v ON v.id = x.invoice_id
WHERE p.status = 'posted'
  AND p.currency IS DISTINCT FROM v.currency
GROUP BY x.workspace_id, p.currency, COALESCE(v.currency, '(none)')
ORDER BY 4 DESC;


-- D2. CURRENCY COLUMNS — every column named like a currency: whether it may be
--     NULL, and the default the database fills in. A default of AFN is a
--     currency nobody chose.
SELECT
  table_name,
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name = 'currency' OR column_name LIKE '%\_currency' ESCAPE '\' OR column_name = 'currency_code')
ORDER BY (column_default IS NULL), table_name, column_name;


-- D3. CURRENCY VALUES — rows with no currency, and rows in a currency that is
--     not the workspace's books currency, per table.
SELECT 'invoices' AS table_name,
       COUNT(*) FILTER (WHERE v.currency IS NULL OR v.currency = '')            AS no_currency,
       COUNT(*) FILTER (WHERE v.currency IS NOT NULL AND v.currency <> ''
                          AND v.currency <> w.base_currency)                    AS not_books_currency,
       COUNT(*)                                                                 AS all_rows
  FROM invoices v JOIN workspaces w ON w.id = v.workspace_id
UNION ALL
SELECT 'payments',
       COUNT(*) FILTER (WHERE p.currency IS NULL OR p.currency = ''),
       COUNT(*) FILTER (WHERE p.currency <> w.base_currency),
       COUNT(*)
  FROM payments p JOIN workspaces w ON w.id = p.workspace_id
UNION ALL
SELECT 'cost_layers',
       COUNT(*) FILTER (WHERE l.currency IS NULL OR l.currency = ''),
       COUNT(*) FILTER (WHERE l.currency <> w.base_currency),
       COUNT(*)
  FROM cost_layers l JOIN workspaces w ON w.id = l.workspace_id
UNION ALL
SELECT 'products',
       COUNT(*) FILTER (WHERE p.currency IS NULL OR p.currency = ''),
       COUNT(*) FILTER (WHERE p.currency <> w.base_currency),
       COUNT(*)
  FROM products p JOIN workspaces w ON w.id = p.workspace_id
UNION ALL
SELECT 'transactions',
       COUNT(*) FILTER (WHERE t.currency IS NULL OR t.currency = ''),
       COUNT(*) FILTER (WHERE t.currency IS NOT NULL AND t.currency <> ''
                          AND t.currency <> w.base_currency),
       COUNT(*)
  FROM transactions t JOIN workspaces w ON w.id = t.workspace_id
ORDER BY 1;


-- E1. THE COST CHAIN — sale lines of a stocked product that drew no cost.
--     Each is a sale whose profit is not known (INV-000077).
SELECT
  v.workspace_id,
  COUNT(DISTINCT v.id)           AS invoices_without_cost,
  COUNT(*)                       AS lines_without_cost,
  SUM(i.total_price)             AS revenue_without_cost,
  MIN(v.date)                    AS first_one,
  MAX(v.date)                    AS last_one
FROM invoice_items i
JOIN invoices v ON v.id = i.invoice_id
WHERE v.type = 'sale'
  AND COALESCE(v.status, '') <> 'cancelled'
  AND i.product_id IS NOT NULL
  AND i.quantity > 0
  AND NOT EXISTS (
    SELECT 1
      FROM cost_consumptions c
     WHERE c.consumer_type = 'invoice'
       AND c.consumer_id = v.id
       AND c.product_id = i.product_id
  )
GROUP BY v.workspace_id
ORDER BY 3 DESC;


-- E2. THE COST CHAIN — stock on the shelf with no cost layer behind it, and
--     whether the product has a purchase price to value it at.
SELECT
  p.workspace_id,
  COUNT(*)                                                      AS products_with_unvalued_stock,
  SUM(p.quantity - COALESCE(l.layered, 0))                      AS unvalued_units,
  COUNT(*) FILTER (WHERE COALESCE(p.buy_price, 0) > 0)          AS can_be_valued,
  COUNT(*) FILTER (WHERE COALESCE(p.buy_price, 0) <= 0)         AS no_purchase_price,
  SUM((p.quantity - COALESCE(l.layered, 0)) * p.buy_price)
    FILTER (WHERE COALESCE(p.buy_price, 0) > 0)                 AS value_at_purchase_price
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(remaining_qty) AS layered
    FROM cost_layers
   WHERE remaining_qty > 0
   GROUP BY product_id
) AS l ON l.product_id = p.id
WHERE COALESCE(p.quantity, 0) > COALESCE(l.layered, 0)
GROUP BY p.workspace_id
ORDER BY 3 DESC;


-- E3. THE COST CHAIN — layers and consumptions whose own arithmetic is off.
SELECT 'layer with more remaining than received' AS problem, COUNT(*) AS row_count
  FROM cost_layers WHERE remaining_qty > received_qty
UNION ALL
SELECT 'layer with a negative remainder', COUNT(*)
  FROM cost_layers WHERE remaining_qty < 0
UNION ALL
SELECT 'consumption whose amount is not quantity × unit cost', COUNT(*)
  FROM cost_consumptions WHERE ABS(amount - quantity * unit_cost) > 0.01
UNION ALL
SELECT 'estimated consumption (sold with no stock behind it)', COUNT(*)
  FROM cost_consumptions WHERE is_estimated
UNION ALL
SELECT 'layer drawn for more than it received', COUNT(*)
  FROM (
    SELECT l.id
      FROM cost_layers l
      JOIN cost_consumptions c ON c.layer_id = l.id
     GROUP BY l.id, l.received_qty
    HAVING SUM(c.quantity) > l.received_qty
  ) AS overdrawn
ORDER BY 2 DESC, 1;


-- F1. DUPLICATE FOREIGN KEYS — the same column tied to the same table twice
--     (customers, invoices, products, subscriptions and transactions each carry
--     two workspace keys). Harmless to reads, paid for on every write.
SELECT
  k.conrelid::regclass   AS table_name,
  k.confrelid::regclass  AS references_table,
  k.conkey               AS column_numbers,
  COUNT(*)               AS constraints,
  array_agg(k.conname ORDER BY k.conname) AS names
FROM pg_constraint k
WHERE k.contype = 'f'
  AND k.connamespace = 'public'::regnamespace
GROUP BY k.conrelid, k.confrelid, k.conkey
HAVING COUNT(*) > 1
ORDER BY 1;


-- F2. LEGACY TABLES — tables no code path reads any more, and how much they
--     hold. Their rows decide whether they are dropped, archived or kept.
SELECT 'ledger_entries' AS table_name, COUNT(*) AS row_count, MAX(created_at)::text AS newest FROM ledger_entries
UNION ALL SELECT 'sync_queue', COUNT(*), MAX(created_at)::text FROM sync_queue
UNION ALL SELECT 'sync_logs', COUNT(*), MAX(created_at)::text FROM sync_logs
UNION ALL SELECT 'journal_lines_archive', COUNT(*), MAX(archived_at)::text FROM journal_lines_archive
UNION ALL SELECT 'transactions', COUNT(*), MAX(created_at)::text FROM transactions
ORDER BY 1;


-- F3. TIME COLUMNS — timestamps stored with no time zone. Two servers in two
--     regions read the same value as two different moments.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone'
ORDER BY table_name, column_name;
