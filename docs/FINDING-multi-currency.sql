-- ============================================================================
-- FINDING-multi-currency.sql — READ-ONLY. Nothing here writes.
--
-- What it answers, before any restriction is switched on:
--   how many invoices, payments, manual transactions and cost layers on the
--   live database are in a currency OTHER than the books currency of their own
--   business — and how many payments are allocated to an invoice of a
--   different currency (the allocation the code never checked).
--
-- It returns COUNTS and SUMS per currency only. No customer name, phone,
-- invoice number or business name is selected; a workspace is shown as the
-- first eight characters of its id.
--
-- «Books currency» is workspaces.base_currency when the column exists, and
-- 'AFN' otherwise — the same rule the application uses.
--
-- Run each block separately (the SQL editor shows only the last result).
-- Every statement is a single SELECT.
-- ============================================================================

-- ─── Q1. Documents by currency, per kind — the whole database ───────────────
-- `foreign_to_books` = in a currency other than that business's books currency.
WITH book AS (
  SELECT w.id, COALESCE(NULLIF(to_jsonb(w) ->> 'base_currency', ''), 'AFN') AS base
    FROM public.workspaces w
),
docs AS (
  SELECT 'invoice_' || COALESCE(i.type, 'sale') AS kind, i.workspace_id,
         COALESCE(NULLIF(i.currency, ''), '(none)') AS currency,
         i.total::numeric AS amount
    FROM public.invoices i
  UNION ALL
  SELECT 'payment_' || p.direction, p.workspace_id,
         COALESCE(NULLIF(p.currency, ''), '(none)'), p.amount::numeric
    FROM public.payments p
   WHERE p.status <> 'cancelled'
  UNION ALL
  SELECT 'transaction_' || t.type, t.workspace_id,
         COALESCE(NULLIF(t.currency, ''), '(none)'), t.amount::numeric
    FROM public.transactions t
)
SELECT d.kind,
       d.currency,
       (d.currency NOT IN (b.base, '(none)')) AS foreign_to_books,
       count(*)                               AS documents,
       count(DISTINCT d.workspace_id)         AS businesses,
       round(sum(d.amount), 2)                AS sum_in_that_currency
  FROM docs d
  JOIN book b ON b.id = d.workspace_id
 GROUP BY 1, 2, 3
 ORDER BY 3 DESC, 1, 2;

-- ─── Q2. Which businesses work in more than one currency ────────────────────
WITH book AS (
  SELECT w.id, COALESCE(NULLIF(to_jsonb(w) ->> 'base_currency', ''), 'AFN') AS base
    FROM public.workspaces w
),
used AS (
  SELECT workspace_id, COALESCE(NULLIF(currency, ''), '(none)') AS currency, 'invoice' AS kind
    FROM public.invoices
  UNION ALL
  SELECT workspace_id, COALESCE(NULLIF(currency, ''), '(none)'), 'payment'
    FROM public.payments WHERE status <> 'cancelled'
)
SELECT left(u.workspace_id::text, 8)                              AS business,
       b.base                                                     AS books_currency,
       string_agg(DISTINCT u.currency, ', ' ORDER BY u.currency)  AS currencies_used,
       count(*) FILTER (WHERE u.kind = 'invoice' AND u.currency NOT IN (b.base, '(none)')) AS foreign_invoices,
       count(*) FILTER (WHERE u.kind = 'payment' AND u.currency NOT IN (b.base, '(none)')) AS foreign_payments
  FROM used u
  JOIN book b ON b.id = u.workspace_id
 GROUP BY u.workspace_id, b.base
HAVING count(DISTINCT u.currency) FILTER (WHERE u.currency <> '(none)') > 1
    OR bool_or(u.currency NOT IN (b.base, '(none)'))
 ORDER BY count(*) FILTER (WHERE u.currency NOT IN (b.base, '(none)')) DESC, 1;

-- ─── Q3. Payments allocated to an invoice of a DIFFERENT currency ───────────
-- The allocation function compares amounts and never currencies
-- (01-CURRENCY-AUDIT.md, DEFECT-CUR-03). Zero rows = it never happened.
SELECT COALESCE(NULLIF(p.currency, ''), '(none)') AS payment_currency,
       COALESCE(NULLIF(i.currency, ''), '(none)') AS invoice_currency,
       count(*)                                   AS allocations,
       count(DISTINCT a.workspace_id)             AS businesses,
       round(sum(a.amount), 2)                    AS allocated_amount
  FROM public.payment_allocations a
  JOIN public.payments p ON p.id = a.payment_id
  JOIN public.invoices i ON i.id = a.invoice_id
 WHERE COALESCE(NULLIF(p.currency, ''), 'AFN') <> COALESCE(NULLIF(i.currency, ''), 'AFN')
 GROUP BY 1, 2
 ORDER BY allocations DESC;

-- ─── Q4. Foreign-currency invoices and whether the ledger booked them ───────
-- A booked one carries the figure at an implicit rate of 1 (DEFECT-CUR-02).
WITH book AS (
  SELECT w.id, COALESCE(NULLIF(to_jsonb(w) ->> 'base_currency', ''), 'AFN') AS base
    FROM public.workspaces w
)
SELECT i.currency,
       COALESCE(i.type, 'sale')                         AS type,
       count(*)                                         AS invoices,
       count(j.id)                                      AS booked_in_ledger,
       count(*) - count(j.id)                           AS not_booked,
       round(sum(i.total), 2)                           AS total_in_that_currency,
       round(sum(i.total - COALESCE(i.paid_amount, 0)), 2) AS unpaid_in_that_currency
  FROM public.invoices i
  JOIN book b ON b.id = i.workspace_id
  LEFT JOIN public.journal_entries j
         ON j.source_type = 'invoice' AND j.source_id = i.id
        AND j.workspace_id = i.workspace_id AND j.reversal_of IS NULL
 WHERE NULLIF(i.currency, '') IS NOT NULL
   AND i.currency <> b.base
 GROUP BY 1, 2
 ORDER BY invoices DESC;

-- ─── Q5. Exchange rates on file, and revaluations already posted ────────────
SELECT (SELECT count(*) FROM public.exchange_rates)                         AS rates_on_file,
       (SELECT count(DISTINCT workspace_id) FROM public.exchange_rates)     AS businesses_with_rates,
       (SELECT count(*) FROM public.journal_entries
         WHERE source_type = 'fx_revaluation')                              AS revaluation_entries;
