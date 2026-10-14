-- ============================================================================
-- FINDING — till units, cash/bank routing, exchange-rate key (14 Oct 2026)
--
-- READ-ONLY. Every block is a SELECT. Nothing is changed. Run each block on its
-- own in the Supabase SQL editor (it shows only the last result) and paste the
-- output back. A repair is a SEPARATE, reviewed step after this — never here.
--
-- What it measures (live audit .claude/LIVE-AUDIT-2026-10-14.md, #1 #2 #36 #47):
--   F1  payments named to a till whose drawer figure was scaled ×100 for a
--       currency with no minor units (AFN, IRT, IRR, PKR, JPY)
--   F2  ledger entries from the till (opening capital, bank transfer, till
--       close) booked at 1/100 of the drawer figure
--   F3  non-cash payments whose money was booked to the CASH account
--   F4  is the unique key behind PUT /currency/rates present?
--   F5  open tills whose expected cash is inflated by F1 — do NOT close them
--       before the repair, or the inflation is booked as a shortage
-- ============================================================================


-- ─── F1 — till figure of a payment, ×100 too large ─────────────────────────
-- A 4,000 AFN cash payment stored till_amount_minor = 400000 instead of 4000.
SELECT p.workspace_id,
       count(*)                                   AS payments,
       sum(p.till_amount_minor)                   AS stored_minor,
       sum(round(p.amount))                       AS should_be_minor,
       min(p.created_at)                          AS first_seen,
       max(p.created_at)                          AS last_seen
FROM payments p
JOIN pos_sessions s ON s.id = p.pos_session_id
WHERE p.pos_session_id IS NOT NULL
  AND coalesce(s.currency, (SELECT w.base_currency FROM workspaces w WHERE w.id = p.workspace_id))
      IN ('AFN', 'IRT', 'IRR', 'PKR', 'JPY')
  AND p.till_amount_minor = round(p.amount * 100)
  AND p.amount <> 0
GROUP BY p.workspace_id;


-- ─── F2 — till entries in the ledger at 1/100 ──────────────────────────────
-- Opening capital of 10,000 AFN was booked as 100. Compares each entry with
-- the drawer movement that carries the same id.
SELECT je.workspace_id,
       je.source_type,
       count(*)                                   AS entries,
       sum(m.amount_minor)                        AS drawer_minor,
       sum(jl.debit)                              AS ledger_debit
FROM journal_entries je
JOIN pos_cash_movements m ON m.id = je.source_id
JOIN pos_sessions s       ON s.id = m.session_id
JOIN LATERAL (
  SELECT sum(debit) AS debit FROM journal_lines WHERE journal_id = je.id
) jl ON true
WHERE je.source_type IN ('opening_capital', 'till_transfer')
  AND coalesce(s.currency, (SELECT w.base_currency FROM workspaces w WHERE w.id = je.workspace_id))
      IN ('AFN', 'IRT', 'IRR', 'PKR', 'JPY')
  AND jl.debit * 100 = m.amount_minor
GROUP BY je.workspace_id, je.source_type;

-- Till closes (source_type of the close entry) — count only; the close posts
-- several lines, each ÷100.
SELECT je.workspace_id, count(*) AS till_close_entries
FROM journal_entries je
JOIN pos_sessions s ON s.id = je.source_id
WHERE coalesce(s.currency, (SELECT w.base_currency FROM workspaces w WHERE w.id = je.workspace_id))
      IN ('AFN', 'IRT', 'IRR', 'PKR', 'JPY')
GROUP BY je.workspace_id;


-- ─── F3 — non-cash payments booked to the cash account ─────────────────────
SELECT p.workspace_id,
       p.method,
       count(*)              AS payments,
       sum(p.amount)         AS amount
FROM payments p
JOIN journal_entries je ON je.source_type = 'payment' AND je.source_id = p.id
JOIN journal_lines jl   ON jl.journal_id = je.id
JOIN accounts a         ON a.id = jl.account_id
WHERE coalesce(p.method, 'cash') <> 'cash'
  AND a.role = 'cash'
  AND p.status = 'posted'
GROUP BY p.workspace_id, p.method;


-- ─── F4 — the key behind «ثبت نرخ» (PUT /currency/rates returned 500) ──────
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'exchange_rates';

SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.exchange_rates'::regclass;


-- ─── F5 — open tills whose expected cash includes F1 ───────────────────────
SELECT s.workspace_id, s.id AS session_id, s.label, s.opened_at,
       count(p.id)                     AS inflated_payments,
       sum(p.till_amount_minor - round(p.amount)) AS excess_minor
FROM pos_sessions s
JOIN payments p ON p.pos_session_id = s.id
WHERE s.status = 'open'
  AND coalesce(s.currency, (SELECT w.base_currency FROM workspaces w WHERE w.id = s.workspace_id))
      IN ('AFN', 'IRT', 'IRR', 'PKR', 'JPY')
  AND p.till_amount_minor = round(p.amount * 100)
  AND p.amount <> 0
GROUP BY s.workspace_id, s.id, s.label, s.opened_at;


-- ─── F6 — audit_logs.created_at has no default (governance log «زمان: —») ──
-- Live audit #23: every row read in the page had created_at NULL.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at';

SELECT count(*) FILTER (WHERE created_at IS NULL) AS without_time,
       count(*)                                    AS all_rows
FROM audit_logs;
