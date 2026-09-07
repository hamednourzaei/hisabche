-- ============================================================================
-- T9 — WHICH EXISTING INVOICES ALREADY CARRY A FICTIONAL PAID AMOUNT.
--
-- READ-ONLY. This changes nothing. It cannot change anything.
--
-- The code defect is fixed: invoice creation now records real payments and
-- `paid_amount` follows the allocations. That fixes every invoice from here
-- on. It does NOT touch the ones already written, and those are the invoices
-- the owner was looking at when they reported:
--
--   «مبلغ پرداخت‌شده‌ی ثبت‌شده روی فاکتور با مجموع پرداخت‌ها یکی نیست:
--    ۱۸٬۰۰۰٬۰۰۰»
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY THIS ONLY REPORTS, AND WILL NOT REPAIR
--
-- There are two ways to reconcile a drifted invoice and they mean OPPOSITE
-- things:
--
--   A. The money was really received, and the payment record is what is
--      missing → a payment should be created, and it belongs in the ledger
--      and in the customer's balance.
--
--   B. The money was never received; `paid_amount` was written by the bug
--      → the invoice is genuinely unpaid and the customer still owes it.
--
-- Nothing in the data distinguishes them. Only the person who made the sale
-- knows. Guessing wrong in direction A invents revenue; guessing wrong in
-- direction B tells a customer who paid that they still owe.
--
-- So this reports, and a human decides — one invoice at a time. That is
-- guardrail 13: unhealthy history is reported first and never silently
-- rewritten.
-- ============================================================================

-- 1. HOW BAD IS IT. Run this first.
SELECT COUNT(*)                                   AS drifted_invoices,
       SUM(i.paid_amount - COALESCE(a.allocated, 0)) AS total_unbacked_amount
FROM   invoices i
LEFT   JOIN (
         SELECT invoice_id, SUM(amount) AS allocated
         FROM   payment_allocations
         GROUP  BY invoice_id
       ) a ON a.invoice_id = i.id
WHERE  ROUND(i.paid_amount::numeric, 2)
       <> ROUND(COALESCE(a.allocated, 0)::numeric, 2);


-- 2. THE LIST, worst first. This is the worksheet to decide from.
SELECT i.invoice_number,
       i.date,
       i.type,
       i.total,
       i.paid_amount                              AS claims_paid,
       COALESCE(a.allocated, 0)                   AS actually_allocated,
       i.paid_amount - COALESCE(a.allocated, 0)   AS unbacked,
       c.full_name                                AS customer,
       i.workspace_id
FROM   invoices i
LEFT   JOIN (
         SELECT invoice_id, SUM(amount) AS allocated
         FROM   payment_allocations
         GROUP  BY invoice_id
       ) a ON a.invoice_id = i.id
LEFT   JOIN customers c ON c.id = i.customer_id
WHERE  ROUND(i.paid_amount::numeric, 2)
       <> ROUND(COALESCE(a.allocated, 0)::numeric, 2)
ORDER  BY ABS(i.paid_amount - COALESCE(a.allocated, 0)) DESC
LIMIT  200;


-- 3. Sanity check on the FIX: invoices created from now on must never appear
--    in the list above. Run this a few days after deploying.
--    EXPECT: 0
SELECT COUNT(*) AS drifted_since_deploy
FROM   invoices i
LEFT   JOIN (
         SELECT invoice_id, SUM(amount) AS allocated
         FROM   payment_allocations
         GROUP  BY invoice_id
       ) a ON a.invoice_id = i.id
WHERE  i.created_at > now() - interval '7 days'
  AND  ROUND(i.paid_amount::numeric, 2)
       <> ROUND(COALESCE(a.allocated, 0)::numeric, 2);
