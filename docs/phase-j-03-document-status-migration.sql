-- ============================================================================
-- docs/phase-j-03-document-status-migration.sql
--
-- PHASE J · J3 — the document's own state, separated from how much of it is paid.
--
-- ---------------------------------------------------------------------------
-- THE CONFLATION, EXACTLY
--
-- `invoices.status` holds six values from two different questions:
--
--   pending  paid  completed  cancelled  partial  overdue
--   └ doc ┘  └── settlement ──┘  └ doc ┘  └ settlement ┘  └ derived ┘
--
-- And `invoice.service.create()` writes it like this:
--
--     status: data.paidAmount >= data.total ? 'completed' : 'pending'
--
-- So `completed` — a DOCUMENT word — is set by whether the invoice was PAID at
-- the moment it was created. `settlementDate()` in the validation package then
-- reads `status === 'completed'` to decide when it was settled, which works
-- only because of that accident.
--
-- Phase F added `settlement_status` (unpaid | partially_paid | paid), derived
-- from `payment_allocations` by trigger, and that half is now correct. What is
-- still missing is the OTHER half: nothing records whether the document itself
-- is a draft, is posted, or was cancelled.
--
-- ---------------------------------------------------------------------------
-- WHY THIS MATTERS MORE AFTER G6
--
-- G6 made approval real: an invoice awaiting approval is HELD — no journal
-- entry, no stock movement — and is marked `pending`, because `pending` was
-- the only existing value that could carry it.
--
-- That makes `pending` mean three different things at once: not yet paid, not
-- yet approved, and not yet posted. No screen and no query can tell them
-- apart. `document_status` is what separates them.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHAT IS **NOT** DONE HERE
--
-- `status` IS NOT DROPPED, NOT NARROWED, AND NOT REWRITTEN.
--
-- Every screen, filter and export still reads it, `settlementDate()` still
-- derives from it, and the deprecation flow in DATABASE_MIGRATION_POLICY.md is
-- three releases: add beside → move readers → remove. This is release one.
--
-- The backfill below therefore only WRITES the new column. It changes no
-- existing value, so nothing that reads `status` today behaves differently
-- tomorrow.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- Additive. To undo:
--
--   ALTER TABLE invoices DROP COLUMN IF EXISTS document_status;
--   DROP INDEX IF EXISTS invoices_document_status_idx;
--
-- Nothing reads it that did not exist before this change, so dropping it
-- cannot break a screen.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. What does `status` actually contain? This is the conflation, measured.
--
--   SELECT status, COUNT(*) FROM invoices GROUP BY status ORDER BY 2 DESC;
--
-- P2. How many invoices have a POSTED journal entry behind them? That is the
--     real "is it posted" answer and what section 2 derives from.
--
--   SELECT COUNT(DISTINCT i.id) AS posted
--   FROM   invoices i
--   JOIN   journal_entries je
--     ON   je.source_type = 'invoice' AND je.source_id = i.id AND je.status = 'posted';
--
-- P3. ⚠️ INVOICES WITH NO JOURNAL ENTRY AT ALL.
--
--     Expect this to be non-trivial and DO NOT be alarmed: it includes every
--     invoice created while the ledger posting silently failed (lesson 4), and
--     every one created before the accounting core existed. They are reported,
--     never repaired — §13 of the phase brief.
--
--   SELECT COUNT(*) AS no_journal
--   FROM   invoices i
--   WHERE  COALESCE(i.status, '') <> 'cancelled'
--     AND  NOT EXISTS (
--       SELECT 1 FROM journal_entries je
--       WHERE je.source_type = 'invoice' AND je.source_id = i.id
--     );
--
-- P4. Values outside the documented vocabulary (J3.5 asks for these).
--
--   SELECT status, COUNT(*) FROM invoices
--   WHERE status IS NULL
--      OR status NOT IN ('pending','paid','completed','cancelled','partial','overdue')
--   GROUP BY status;
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The document dimension
-- ---------------------------------------------------------------------------

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_status text;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_document_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_document_status_check
  CHECK (document_status IS NULL OR document_status IN ('draft', 'posted', 'cancelled'));

COMMENT ON COLUMN invoices.document_status IS
  'The DOCUMENT''s own state: draft | posted | cancelled. Orthogonal to settlement_status, which says how much has been paid. An invoice can be posted and unpaid, or draft and (impossibly) paid — the two never encode each other. `posted` means a journal entry exists for it. Phase J (J3).';

COMMENT ON COLUMN invoices.status IS
  'DEPRECATED (Phase J, J3) and still authoritative for every reader. Holds six values from two questions: pending/completed/cancelled describe the DOCUMENT, paid/partial describe SETTLEMENT, overdue is derived from the due date. Replaced by document_status + settlement_status, which separate them. Readers move in a later release — see DATABASE_MIGRATION_POLICY.md.';

CREATE INDEX IF NOT EXISTS invoices_document_status_idx
  ON invoices (workspace_id, document_status);

-- ---------------------------------------------------------------------------
-- 2. Backfill — from the FINANCIAL EFFECT, not from the word
--
-- ⚠️ The obvious mapping is wrong.
--
-- Reading `status` and translating ('completed' → posted, 'pending' → draft)
-- would carry the conflation across intact: `completed` is written when an
-- invoice is fully PAID at creation, and `pending` covers not-yet-paid,
-- not-yet-approved and not-yet-posted alike. The new column would mean exactly
-- as little as the old one.
--
-- The honest source is whether a POSTED JOURNAL ENTRY EXISTS. That is what
-- "posted" means in this system — Phase B made journal_entries the source of
-- truth for accounting, and G6 made the entry the thing approval withholds.
--
-- Three cases, in order:
--   cancelled  the document says so; a cancelled document is cancelled
--              whatever the ledger holds
--   posted     a posted journal entry names it
--   draft      everything else — including invoices whose posting failed
--              silently, which is why P3 exists
-- ---------------------------------------------------------------------------

UPDATE invoices i
SET    document_status = CASE
         WHEN COALESCE(i.status, '') = 'cancelled' THEN 'cancelled'
         WHEN EXISTS (
           SELECT 1 FROM journal_entries je
           WHERE  je.source_type = 'invoice'
             AND  je.source_id = i.id
             AND  je.status = 'posted'
             AND  je.workspace_id = i.workspace_id
         ) THEN 'posted'
         ELSE 'draft'
       END
WHERE  i.document_status IS NULL;

-- ---------------------------------------------------------------------------
-- 3. The read that separates the two dimensions
--
-- One row per invoice with BOTH answers, plus the derived one. A screen that
-- needs "posted but unpaid" or "draft awaiting approval" asks here instead of
-- decoding a single overloaded word.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS invoice_state;

CREATE VIEW invoice_state AS
SELECT
  i.id                              AS invoice_id,
  i.workspace_id,
  i.branch_id,
  i.invoice_number,
  i.type,
  i.customer_id,
  i.supplier_id,
  i.date,
  i.due_date,
  i.total,

  -- The document: is it real yet, and was it cancelled?
  COALESCE(i.document_status, 'draft')   AS document_status,

  -- Settlement, from payment_allocations (Phase F). Derived here rather than
  -- read from the stored column so this view can be used to CHECK that column
  -- rather than agreeing with it by construction (lesson 6).
  CASE
    WHEN COALESCE(a.allocated, 0) <= 0                  THEN 'unpaid'
    WHEN COALESCE(a.allocated, 0) >= COALESCE(i.total, 0) THEN 'paid'
    ELSE 'partially_paid'
  END                                    AS settlement_status,

  COALESCE(a.allocated, 0)               AS allocated,
  i.total - COALESCE(a.allocated, 0)     AS outstanding,

  -- Derived from today, never stored — see phase-f-01 for why.
  (i.due_date IS NOT NULL
   AND i.due_date::date < CURRENT_DATE
   AND i.total - COALESCE(a.allocated, 0) > 0)          AS is_overdue,

  -- ⚠️ Whether a journal entry actually exists. `document_status` is a stored
  -- projection of this; keeping both visible is what lets a drift report find
  -- an invoice marked posted that never reached the ledger.
  EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE  je.source_type = 'invoice' AND je.source_id = i.id
      AND  je.status = 'posted' AND je.workspace_id = i.workspace_id
  )                                      AS has_journal_entry,

  i.status                               AS legacy_status
FROM   invoices i
LEFT   JOIN (
  SELECT invoice_id, SUM(amount) AS allocated
  FROM   payment_allocations
  GROUP  BY invoice_id
) a ON a.invoice_id = i.id;

-- Without this the view runs as its creator and returns every workspace's
-- invoices to anyone who can read it. See phase-b-03.
ALTER VIEW invoice_state SET (security_invoker = true);

COMMENT ON VIEW invoice_state IS
  'An invoice''s two states, separated: document_status (draft|posted|cancelled) and settlement_status (unpaid|partially_paid|paid), plus is_overdue derived from today and has_journal_entry as the ground truth behind document_status. Phase J (J3).';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. Every invoice has a document status. MUST BE EMPTY.
--
--   SELECT id, status FROM invoices WHERE document_status IS NULL;
--
-- V2. The two dimensions, crossed. This table IS the point of the phase — it
--     shows combinations the single column could never express.
--
--   SELECT document_status, settlement_status, COUNT(*)
--   FROM   invoice_state
--   GROUP  BY 1, 2 ORDER BY 1, 2;
--
-- V3. ⚠️ DRIFT — marked posted, but no journal entry. MUST BE EMPTY.
--     A row here means the stored column disagrees with the ledger.
--
--   SELECT invoice_id, invoice_number, legacy_status
--   FROM   invoice_state
--   WHERE  document_status = 'posted' AND NOT has_journal_entry;
--
-- V4. 🟠 THE REPORT J3.5 ASKS FOR — invoices with a financial effect that were
--     classed as drafts, i.e. money moved with no journal entry behind it.
--
--     NOT AN ERROR TO FIX HERE. These predate the accounting core or were
--     created while the ledger posting failed silently (lesson 4). §13: report,
--     do not rewrite history. Hand this list over before deciding anything.
--
--   SELECT invoice_id, invoice_number, legacy_status, total, allocated
--   FROM   invoice_state
--   WHERE  document_status = 'draft' AND allocated > 0
--   ORDER  BY allocated DESC;
--
-- V5. Legacy values outside the vocabulary, still untouched.
--
--   SELECT status, COUNT(*) FROM invoices
--   WHERE status IS NULL
--      OR status NOT IN ('pending','paid','completed','cancelled','partial','overdue')
--   GROUP BY status;
-- ============================================================================
