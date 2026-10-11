-- ============================================================================
-- FINDING — what deleted invoices left behind (READ ONLY)
--
-- Until 11 Oct 2026, deleting an invoice removed the row and its lines and
-- nothing else. Its journal entry stayed posted, its stock stayed moved, and
-- its payment stayed allocated. This file COUNTS and LISTS those leftovers.
--
-- It changes nothing. Run each query in the Supabase SQL editor and report the
-- output; what to do about old rows is the owner's decision (reverse them, or
-- leave them as they are) and is not made here.
--
-- Status: generated — PENDING HUMAN CONFIRMATION. No result has been seen.
-- ============================================================================

-- Q1 — posted journal entries whose invoice no longer exists, per business.
SELECT je.workspace_id,
       count(*)                       AS orphan_entries,
       min(je.date)                   AS oldest,
       max(je.date)                   AS newest
FROM journal_entries je
WHERE je.source_type = 'invoice'
  AND je.status = 'posted'
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = je.source_id)
GROUP BY je.workspace_id
ORDER BY orphan_entries DESC;

-- Q2 — the same entries, one per row, with what they still put in the books.
SELECT je.workspace_id,
       je.id            AS entry_id,
       je.entry_number,
       je.date,
       je.source_id     AS missing_invoice_id,
       sum(jl.debit)    AS debit_total
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_id = je.id
WHERE je.source_type = 'invoice'
  AND je.status = 'posted'
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = je.source_id)
GROUP BY je.workspace_id, je.id, je.entry_number, je.date, je.source_id
ORDER BY je.date DESC
LIMIT 500;

-- Q3 — stock that is still «sold» or «bought» by an invoice that is gone:
--      net movement per product for missing invoices (0 = already given back).
SELECT sm.workspace_id,
       sm.product_id,
       sm.reference_id  AS missing_invoice_id,
       sum(sm.quantity) AS net_quantity_still_moved
FROM stock_movements sm
WHERE sm.reference_type = 'invoice'
  AND sm.reference_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = sm.reference_id)
GROUP BY sm.workspace_id, sm.product_id, sm.reference_id
HAVING sum(sm.quantity) <> 0
ORDER BY sm.workspace_id
LIMIT 500;

-- Q4 — payments still allocated to an invoice that is gone.
SELECT pa.workspace_id,
       pa.payment_id,
       pa.invoice_id    AS missing_invoice_id,
       pa.amount
FROM payment_allocations pa
WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = pa.invoice_id)
ORDER BY pa.workspace_id
LIMIT 500;

-- Q5 — cancelled invoices whose entry is still posted (the same defect on the
--      cancel path: the status changed and the books did not).
SELECT i.workspace_id,
       count(*) AS cancelled_but_still_posted
FROM invoices i
JOIN journal_entries je
  ON je.source_type = 'invoice' AND je.source_id = i.id AND je.status = 'posted'
WHERE i.status = 'cancelled'
GROUP BY i.workspace_id
ORDER BY cancelled_but_still_posted DESC;
