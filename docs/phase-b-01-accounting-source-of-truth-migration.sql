-- ============================================================================
-- docs/phase-b-01-accounting-source-of-truth-migration.sql
--
-- PHASE B · 1/2 — one book, and two read-models that say so.
--
-- ---------------------------------------------------------------------------
-- THE DECISION, WRITTEN INTO THE DATABASE
--
--   SOURCE OF TRUTH for accounting = journal_entries + journal_lines.
--
-- Nothing else. Three tables were competing for the title:
--
--   journal_entries / journal_lines   double-entry, posted through
--                                     accounting_post_journal_entry, balanced
--                                     by a constraint.  ← THE BOOK
--
--   ledger_entries                    single-sided rows, no workspace_id until
--                                     phase-a-02, and — verified by grep over
--                                     all of backend/src — ZERO readers and
--                                     ZERO writers. A book nobody has posted to
--                                     in a long time.  ← DEAD
--
--   transactions                      single-sided party movements. Alive, read
--                                     for customer balances and party
--                                     statements, written from exactly two
--                                     places.  ← NOT A LEDGER, and must stop
--                                                being treated as one.
--
-- ---------------------------------------------------------------------------
-- WHAT `transactions` ACTUALLY CONTAINED — the defect this file exists for
--
-- `customer.service.getBalance()` and `/api/transactions/ledger` compute what a
-- party owes by summing `transactions`. But NOTHING writes a `transactions` row
-- when an invoice is issued, and nothing writes one when a payment is recorded
-- through the payments core. Only two writers exist: a credit customer's
-- opening balance, and a manual POST /api/transactions.
--
-- So the customer balance on the screen was computed from a set of rows that
-- contains neither the invoices nor the payments. It was never going to agree
-- with `invoice_outstanding`, because it is not looking at the same events.
--
-- Worse: the web PaymentModal recorded a customer's payment as a raw
-- `transactions` row with `type: 'payment'` — and 'payment' in the party-ledger
-- vocabulary means money WE paid OUT. Taking 500 from a debtor increased their
-- recorded debt by 500. That is lesson 10, re-entered through the UI after
-- being fixed in the service.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES
--
--   1. writes the decision into COMMENT ON TABLE, where the next person looks
--   2. freezes `ledger_entries` — a trigger that refuses every write and names
--      the replacement. Safe precisely because nothing writes it.
--   3. rebuilds `transactions_view` as a PROJECTION OF DOCUMENTS: invoices and
--      payments, unioned with the legacy `transactions` rows that no document
--      stands behind. Every reader of the view now sees the real party ledger
--      without changing a line of its own code.
--   4. adds `party_ledger` as the name that says what it is; `transactions_view`
--      stays as the compatibility alias its callers already use.
--
-- NO ROW IS WRITTEN, MOVED OR DELETED. Views and triggers only. SAFE TO RE-RUN.
--
-- ⚠️ ORDER: apply this file BEFORE the code deploy — the view is additive and
-- correct for both the old and the new code. `phase-b-02` freezes the writes and
-- must be applied AFTER the code deploy.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The decision, recorded where psql shows it
-- ---------------------------------------------------------------------------

COMMENT ON TABLE journal_entries IS
  'SOURCE OF TRUTH for accounting (Phase B). Every financial statement — trial balance, balance sheet, income statement — is derived from posted entries here and nowhere else. Write only through accounting_post_journal_entry, which posts the header and its lines in one transaction.';

COMMENT ON TABLE journal_lines IS
  'SOURCE OF TRUTH for accounting (Phase B), with journal_entries. Balanced per entry; one-sided per line. journal_id references journal_entries(id) — the FK added in phase-a-01.';

COMMENT ON TABLE ledger_entries IS
  'DEPRECATED (Phase B). A legacy single-sided ledger with no readers and no writers in backend/src. Frozen by ledger_entries_frozen: every INSERT, UPDATE and DELETE is refused. Read ledger_entries_view instead, which is the same shape derived from posted journal lines. Retained, not dropped, because the historical rows are evidence.';

COMMENT ON TABLE transactions IS
  'NOT A LEDGER and NOT a source of truth (Phase B). Single-sided party movements. A party balance is derived from invoices and payments via the party_ledger view; rows here survive only for opening balances and manual adjustments that no document stands behind. Recording a payment here instead of through the payments core produces a balance that disagrees with invoice_outstanding — see phase-b-02.';

-- ---------------------------------------------------------------------------
-- 2. Freeze ledger_entries
--
-- A dead table that is still writable is a book someone can post to by accident
-- — and rows landing here appear in no report, so the mistake is invisible.
--
-- The trigger refuses rather than silently ignoring: the whole class of defect
-- this phase addresses is financial writes that go somewhere nobody reads.
--
-- The message names the replacement, because the person who hits this will be
-- reading the error, not this file.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ledger_entries_frozen()
RETURNS trigger
LANGUAGE plpgsql
-- Pinned, per section 2 of linter-hardening-migration.sql. `pg_temp` is
-- deliberately absent: it resolves before `public`, so a caller with a temp
-- table of the same name could shadow a real one.
SET search_path = public
AS $frozen$
BEGIN
  RAISE EXCEPTION
    'ledger_entries is frozen (Phase B): accounting is written to journal_entries + journal_lines via accounting_post_journal_entry, and read from ledger_entries_view. Attempted % on ledger_entries.',
    TG_OP
    USING ERRCODE = '0A000',
          HINT = 'If you are booking a document, call the ledger port (postDocument). If you are reading, select from ledger_entries_view.';
END
$frozen$;

DROP TRIGGER IF EXISTS ledger_entries_frozen_trg ON ledger_entries;
CREATE TRIGGER ledger_entries_frozen_trg
  BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_frozen();

COMMENT ON FUNCTION ledger_entries_frozen() IS
  'Refuses every write to the deprecated ledger_entries table. Drop this trigger only to run a deliberate, reviewed data repair — and put it back.';

-- ---------------------------------------------------------------------------
-- 3. party_ledger — the party statement, derived from documents
--
-- Four sources, unioned. Each row carries `source` so a statement line can say
-- where it came from, and so a reader can exclude the legacy tail once it has
-- been reconciled.
--
-- SIGN VOCABULARY — unchanged, because `party-ledger.domain.ts` and
-- `payments.domain.ts` already encode it and this view must not invent a second
-- convention. For "how much does this party owe us":
--
--     sale      we billed a customer          → owes more
--     receipt   money arrived from them       → owes less
--     purchase  a supplier billed us          → we owe more
--     payment   money we paid out             → owes more (our side settled)
--     return    we credited them              → owes less
--
-- ⚠️ DRAFTS ARE EXCLUDED. A draft invoice is not a receivable, and a cancelled
-- payment did not happen. A statement that included either would disagree with
-- `invoice_outstanding` beside it.
--
-- ⚠️ `invoices.type` is 'sale' | 'purchase', and NULL means sale — legacy rows,
-- per the domain invariants in the database skill. COALESCE, not `= 'sale'`.
-- ---------------------------------------------------------------------------

-- Dropped in dependency order first, so a re-run after an edit to the column
-- list cannot hit 42P16 either. `transactions_view` selects from
-- `party_ledger`, so it goes first.
DROP VIEW IF EXISTS transactions_view;
DROP VIEW IF EXISTS party_ledger;

CREATE VIEW party_ledger AS

-- 3a. Invoices — what we billed, and what we were billed.
SELECT
  i.id                                        AS id,
  i.workspace_id                              AS workspace_id,
  i.customer_id                               AS customer_id,
  i.supplier_id                               AS supplier_id,
  CASE WHEN COALESCE(i.type, 'sale') = 'purchase' THEN 'purchase' ELSE 'sale' END AS type,
  i.total                                     AS amount,
  COALESCE(i.currency, 'AFN')                 AS currency,
  COALESCE(NULLIF(i.notes, ''), i.invoice_number) AS description,
  i.invoice_number                            AS reference,
  i.date                                      AS created_at,
  'invoice'::text                             AS source,
  i.id                                        AS source_id,
  i.branch_id                                 AS branch_id
FROM invoices i
WHERE COALESCE(i.status, '') NOT IN ('draft', 'cancelled', 'void')

UNION ALL

-- 3b. Payments — money that actually moved, through the payments core.
--     direction 'in'  = received from a customer → 'receipt'
--     direction 'out' = paid to a supplier       → 'payment'
SELECT
  p.id,
  p.workspace_id,
  CASE WHEN p.party_type = 'customer' THEN p.party_id END,
  CASE WHEN p.party_type = 'supplier' THEN p.party_id END,
  CASE WHEN p.direction = 'in' THEN 'receipt' ELSE 'payment' END,
  p.amount,
  p.currency,
  COALESCE(NULLIF(p.notes, ''), p.payment_number),
  COALESCE(p.reference, ''),
  p.entry_date::timestamptz,
  'payment'::text,
  p.id,
  NULL::uuid
FROM payments p
WHERE p.status = 'posted'

UNION ALL

-- 3c. The legacy tail — `transactions` rows that stand behind no document.
--
--     Opening balances for credit customers and manual adjustments live here
--     and are real. They are kept, not migrated: rewriting a financial row to
--     make a view tidier is exactly the move the migration policy forbids.
--
--     Rows WITH an invoice_id are excluded — the invoice itself is already in
--     3a, and counting both would double the amount.
SELECT
  t.id,
  t.workspace_id,
  t.customer_id,
  t.supplier_id,
  t.type,
  t.amount,
  COALESCE(t.currency, 'AFN'),
  t.description,
  t.reference,
  COALESCE(t.date, t.created_at),
  'legacy_transaction'::text,
  t.id,
  NULL::uuid
FROM transactions t
WHERE t.invoice_id IS NULL;

-- ⚠️ SECURITY INVOKER — NOT OPTIONAL, and the reason it is written here rather
-- than left to `linter-hardening-migration.sql`:
--
-- A view runs with its CREATOR's permissions unless told otherwise. Left at the
-- default, this view returns EVERY workspace's invoices and payments to anyone
-- who can read it, because RLS on the tables underneath never gets a chance to
-- apply. `security_invoker = true` makes it run as the querying user.
--
-- `linter-hardening-migration.sql` set this on `transactions_view` once. A
-- `DROP VIEW` throws the setting away with the view, so re-creating a view
-- without re-applying it silently re-opens a hole that was already closed once.
-- That is exactly what happened on the first run of this file.
ALTER VIEW party_ledger SET (security_invoker = true);

COMMENT ON VIEW party_ledger IS
  'What each party owes, derived from documents: posted invoices, posted payments, and the legacy transactions rows no document stands behind. Read-only by construction. Phase B.';

-- ---------------------------------------------------------------------------
-- 4. transactions_view — same name, real contents
--
-- `customer.service.getBalance()` already selects `type, amount` from this
-- view. Redefining it here means that balance starts counting invoices and
-- payments without the service changing at all.
--
-- The column list is a superset of the previous definition, so every existing
-- caller keeps working. `id` is no longer unique across the view — a party
-- statement is a list of movements, not a table of transactions — which is why
-- nothing may PATCH or DELETE through this name.
-- ---------------------------------------------------------------------------

-- DROP + CREATE, not CREATE OR REPLACE.
--
-- `CREATE OR REPLACE VIEW` may add columns to the end of a view, but it may not
-- change the TYPE of one that already exists — it fails with 42P16. And the
-- type does change here: the old view read `transactions.amount`, which is
-- numeric(12,2), while `party_ledger` unions it with `payments.amount` at
-- numeric(18,2). Postgres resolves that union to unconstrained `numeric`.
--
-- Unconstrained is the right answer for money that has to hold both. The
-- precision was never doing any rounding work — every caller converts to minor
-- units before summing, exactly so a long statement does not drift by cents.
--
-- Safe because the whole file is one transaction: the view is never absent to
-- any other session. CASCADE is deliberately NOT used anywhere in this file —
-- if something does depend on one of these views, the DROP must fail loudly
-- rather than silently taking the dependant with it.
--
-- (The DROP itself is above, next to party_ledger's, so the two happen in
-- dependency order.)
CREATE VIEW transactions_view AS
SELECT
  id,
  workspace_id,
  customer_id,
  supplier_id,
  type,
  amount,
  currency,
  description,
  reference,
  created_at,
  source,
  source_id,
  branch_id
FROM party_ledger;

-- Same reason as party_ledger above, and the same setting this view already
-- carried before it was dropped and rebuilt.
ALTER VIEW transactions_view SET (security_invoker = true);

COMMENT ON VIEW transactions_view IS
  'Compatibility alias for party_ledger, kept because customer.service.ts and the transaction routes already select from this name. Phase B changed WHAT it returns: documents, not the transactions table.';

-- ---------------------------------------------------------------------------
-- 5. Indexes the view now depends on
--
-- The view filters invoices by status and payments by status; both are then
-- filtered by workspace and party by every caller.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS invoices_workspace_customer_idx
  ON invoices (workspace_id, customer_id);

CREATE INDEX IF NOT EXISTS invoices_workspace_supplier_idx
  ON invoices (workspace_id, supplier_id);

CREATE INDEX IF NOT EXISTS payments_workspace_status_idx
  ON payments (workspace_id, status);

CREATE INDEX IF NOT EXISTS transactions_workspace_customer_idx
  ON transactions (workspace_id, customer_id);

CREATE INDEX IF NOT EXISTS transactions_workspace_supplier_idx
  ON transactions (workspace_id, supplier_id);

COMMIT;

-- ============================================================================
-- AFTER APPLYING — two things to look at.
-- ============================================================================
--
-- A) MIS-RECORDED CUSTOMER PAYMENTS.
--    Rows the web PaymentModal wrote: a customer payment stored as type
--    'payment', which the sign rules read as money paid OUT to that customer.
--    Each one moves the balance the WRONG WAY BY TWICE the amount.
--
-- SELECT t.id, t.customer_id, t.amount, t.reference AS invoice_id, t.created_at,
--        t.description
-- FROM   transactions t
-- WHERE  t.customer_id IS NOT NULL
--   AND  t.type = 'payment'
-- ORDER  BY t.created_at DESC;
--
--    These are NOT rewritten here. Each one is a real payment that should exist
--    as a `payments` row with an allocation and a journal entry, and replaying
--    them is a data repair with a person's name on it — not a side effect of a
--    schema migration. Do it deliberately, after the Phase B code deploy, by
--    re-recording each through POST /api/payments and archiving the legacy row.
--
-- B) THE TWO BALANCES, SIDE BY SIDE.
--    They should now agree for every customer. Where they do not, (A) is the
--    usual reason.
--
-- C) THE OPENING BALANCE IS COUNTED TWICE — pre-existing, not caused here.
--    `customer.service.create()` writes BOTH `customers.opening_balance` AND a
--    'sale' row on `transactions` for a credit customer. `/api/transactions/
--    ledger` then adds `opening_balance` to a sum that already contains that
--    row. This predates Phase B and is left alone deliberately: deciding which
--    of the two is authoritative, and retiring the other, is Phase F work on
--    the receivables model — not something to slip into a view definition.
--
-- SELECT c.id, c.full_name, c.opening_balance
-- FROM   customers c
-- WHERE  c.type = 'credit' AND COALESCE(c.opening_balance, 0) <> 0;
--
-- SELECT c.id, c.full_name,
--        (SELECT COALESCE(SUM(CASE WHEN pl.type IN ('sale','payment') THEN pl.amount
--                                  ELSE -pl.amount END), 0)
--           FROM party_ledger pl WHERE pl.customer_id = c.id)         AS ledger_balance,
--        (SELECT COALESCE(SUM(io.outstanding), 0)
--           FROM invoice_outstanding io WHERE io.customer_id = c.id)  AS invoice_outstanding
-- FROM   customers c
-- WHERE  c.workspace_id = '<workspace uuid>';
