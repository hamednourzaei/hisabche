-- docs/DIAG-payment-invoice-unknown.sql
-- READ-ONLY. Why does POST /api/payments answer PAYMENT_ALLOCATION_INVOICE_UNKNOWN?
-- One query, one result: put the invoice number on the marked line and run.

WITH target AS (
  SELECT 'INV-000051'::text AS invoice_number   -- ← فقط این‌جا شماره‌ی فاکتور را بنویسید
)
SELECT
  i.id,
  i.invoice_number,
  i.type,
  i.status,
  i.total,
  i.paid_amount,
  o.allocated                           AS view_allocated,
  o.outstanding                         AS view_outstanding,
  (SELECT count(*) FROM public.payment_allocations a WHERE a.invoice_id = i.id) AS allocation_rows,
  (SELECT string_agg(a.amount::text || ' / ' || COALESCE(p.status, 'NO PAYMENT'), ', ')
     FROM public.payment_allocations a
     LEFT JOIN public.payments p ON p.id = a.payment_id
    WHERE a.invoice_id = i.id)          AS allocations_amount_status
FROM public.invoices i
JOIN target t ON i.invoice_number ILIKE '%' || t.invoice_number || '%'
LEFT JOIN public.invoice_outstanding o ON o.invoice_id = i.id
LIMIT 10;
