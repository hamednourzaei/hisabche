-- ============================================================================
-- docs/phase-f-01-receivables-projection-migration.sql
--
-- PHASE F · 1/1 — what an invoice has been paid is DERIVED, not maintained.
--
-- ---------------------------------------------------------------------------
-- WHAT IS THERE NOW, AND WHY IT DRIFTS
--
-- `payments_record()` and `payments_cancel()` keep `invoices.paid_amount` in
-- step INCREMENTALLY:
--
--     paid_amount = COALESCE(paid_amount, 0) + <this allocation>
--     paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - <this allocation>)
--
-- Incremental maintenance of a figure that is also derivable is a drift
-- generator. Every one of these makes the two disagree, silently:
--
--   * ANY other writer. `invoice.service.update()` accepts `paidAmount` in a
--     PATCH body and writes it straight to the column — a client could set an
--     invoice to fully paid without a single payment existing.
--   * `GREATEST(0, …)` clamps. A cancellation that would take the figure
--     negative — because something else had already moved it — silently
--     absorbs the difference and the books stop reconciling (lesson 15).
--   * a partial cancellation. `payments_cancel` sets status 'paid' → 'pending'
--     for EVERY invoice it touches, even one that still has other payments
--     against it. An invoice 80% settled by a second payment is reported as
--     untouched.
--   * `payments_record` never writes 'partial' at all. It writes 'paid' when
--     the total is reached and otherwise leaves the status alone, so a
--     part-paid invoice is indistinguishable from an unpaid one.
--
-- ---------------------------------------------------------------------------
-- THE FIX: RECOMPUTE, DO NOT INCREMENT
--
-- One trigger on `payment_allocations`. On any insert, update or delete it
-- recomputes the affected invoice from `SUM(payment_allocations)` — the whole
-- figure, from the source of truth, every time. There is no accumulated error
-- to drift, and a retry writes the same answer as the first attempt.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY `status` IS NOT REUSED FOR THIS
--
-- `invoices.status` is ALREADY two things at once: pending | paid | completed |
-- cancelled | partial | overdue. `completed` and `cancelled` are DOCUMENT
-- states, and `invoice.schema.ts` derives the settlement date from
-- `status === 'completed'`. Overwriting that column with a settlement value
-- destroys the document state — which `payments_record` already does today,
-- turning a 'completed' invoice into a 'paid' one and losing the transition.
--
-- The architecture calls for these to be separated, so this migration adds
-- `settlement_status` as its own column: unpaid | partially_paid | paid. It is
-- the complete, correct answer and nothing else writes it.
--
-- `status` is still maintained, with EXACTLY the transitions it had before, so
-- no screen and no filter changes behaviour in this release. Splitting the
-- readers off it is a later change.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY `overdue` IS NOT A STORED VALUE
--
-- An invoice becomes overdue because a DATE PASSES, not because anything wrote
-- a row. No trigger can fire at midnight. A stored 'overdue' is correct only
-- until the next day and then quietly lies.
--
-- Overdue is derived in `invoice_outstanding`, where it is computed against
-- CURRENT_DATE at read time and is therefore always right.
--
-- SAFE TO RE-RUN. The backfill recomputes; it does not accumulate.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The settlement column
-- ---------------------------------------------------------------------------

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS settlement_status text;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_settlement_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_settlement_status_check
  CHECK (settlement_status IS NULL
         OR settlement_status IN ('unpaid', 'partially_paid', 'paid'));

COMMENT ON COLUMN invoices.settlement_status IS
  'PROJECTION of SUM(payment_allocations): unpaid | partially_paid | paid. Maintained by invoices_project_settlement(); never write it from application code. Overdue is deliberately absent — it depends on today''s date, not on a row, and is derived in invoice_outstanding.';

COMMENT ON COLUMN invoices.paid_amount IS
  'PROJECTION of SUM(payment_allocations) for this invoice (Phase F). Recomputed, not incremented. Never write it from application code — payment_allocations is the source of truth for what has been settled.';

CREATE INDEX IF NOT EXISTS invoices_settlement_status_idx
  ON invoices (workspace_id, settlement_status);

-- Allocations are looked up by invoice on every recompute.
CREATE INDEX IF NOT EXISTS payment_allocations_invoice_only_idx
  ON payment_allocations (invoice_id);

-- ---------------------------------------------------------------------------
-- 2. The projection
--
-- `paid` is `outstanding <= 0`, not `= 0`. An over-allocation should never
-- happen — payments_record refuses it — but if one ever exists, the invoice is
-- settled, and an equality test would report it as still owing.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION invoices_project_settlement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $settle$
DECLARE
  v_invoice_id uuid;
  v_allocated  numeric(18, 2);
  v_total      numeric(18, 2);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_allocated
    FROM payment_allocations
   WHERE invoice_id = v_invoice_id;

  SELECT total INTO v_total FROM invoices WHERE id = v_invoice_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE invoices i
     SET paid_amount = v_allocated,

         settlement_status = CASE
           WHEN v_allocated <= 0                  THEN 'unpaid'
           WHEN v_allocated >= COALESCE(v_total, 0) THEN 'paid'
           ELSE 'partially_paid'
         END,

         -- The LEGACY column, with exactly the transitions it had before this
         -- migration and no new ones:
         --
         --   settled     → 'paid'
         --   unsettled   → 'pending', but only if it currently says 'paid'
         --
         -- 'cancelled' is never overwritten: a cancelled document that
         -- happens to have an allocation against it is a problem to
         -- investigate, not a status to quietly change.
         --
         -- ⚠️ It still overwrites 'completed', because that is what
         -- payments_record did and this release changes no behaviour. That
         -- conflation is the reason settlement_status exists beside it.
         status = CASE
           WHEN i.status = 'cancelled' THEN i.status
           WHEN v_allocated >= COALESCE(v_total, 0) AND COALESCE(v_total, 0) > 0 THEN 'paid'
           WHEN i.status = 'paid' THEN 'pending'
           ELSE i.status
         END,

         updated_at = now()
   WHERE i.id = v_invoice_id;

  RETURN NULL;
END
$settle$;

COMMENT ON FUNCTION invoices_project_settlement() IS
  'Recomputes invoices.paid_amount and settlement_status from SUM(payment_allocations). Phase F. Recomputes rather than increments, so a retry is a no-op and no error accumulates.';

DROP TRIGGER IF EXISTS invoices_project_settlement_trg ON payment_allocations;
CREATE TRIGGER invoices_project_settlement_trg
  AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION invoices_project_settlement();

-- ---------------------------------------------------------------------------
-- 3. Backfill — every invoice, from its allocations
--
-- This is the first moment the two figures are made to agree. Invoices whose
-- stored `paid_amount` differs from their allocations are listed by the report
-- at the bottom BEFORE you run this, if you want to see the damage first.
-- ---------------------------------------------------------------------------

WITH allocated AS (
  SELECT i.id,
         i.total,
         COALESCE((
           SELECT SUM(a.amount) FROM payment_allocations a WHERE a.invoice_id = i.id
         ), 0) AS allocated
  FROM invoices i
)
UPDATE invoices i
   SET paid_amount = al.allocated,
       settlement_status = CASE
         WHEN al.allocated <= 0                        THEN 'unpaid'
         WHEN al.allocated >= COALESCE(al.total, 0)    THEN 'paid'
         ELSE 'partially_paid'
       END
  FROM allocated al
 WHERE i.id = al.id
   AND (i.paid_amount IS DISTINCT FROM al.allocated
        OR i.settlement_status IS NULL);

-- ⚠️ `status` is NOT rewritten by the backfill.
--
-- Recomputing it would move real invoices between states based on data that
-- was maintained incorrectly for an unknown length of time — including
-- knocking 'completed' documents back to 'pending'. The trigger will correct
-- each invoice the next time money moves against it, which is the point at
-- which the change is explainable to whoever is looking at it.

-- ---------------------------------------------------------------------------
-- 4. The RPCs stop maintaining what the trigger now owns
--
-- Both functions are otherwise UNCHANGED — same signature, same validation,
-- same locking, same error codes. Only the `UPDATE invoices SET paid_amount…`
-- statements are gone.
--
-- They have to go: the trigger fires on the allocation INSERT, and then the
-- function's own incremental UPDATE ran afterwards and overwrote the correct
-- figure with the accumulated one. Leaving both would be worse than leaving
-- neither.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION payments_record(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payment      jsonb,
  p_allocations  jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_payment_id  uuid;
  v_amount      numeric(18, 2) := (p_payment ->> 'amount')::numeric;
  v_allocated   numeric(18, 2) := 0;
  v_row         record;
  v_outstanding numeric(18, 2);
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM((a ->> 'amount')::numeric), 0)
    INTO v_allocated
    FROM jsonb_array_elements(p_allocations) AS a;

  -- Allocating more than was paid would settle invoices with money that does
  -- not exist. Under-allocating is fine: the rest is an advance.
  IF v_allocated > v_amount THEN
    RAISE EXCEPTION 'PAYMENT_OVER_ALLOCATED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO payments (
    workspace_id, payment_number, direction, party_type, party_id,
    amount, currency, method, entry_date, reference, notes, status, created_by
  ) VALUES (
    p_workspace_id,
    p_payment ->> 'payment_number',
    p_payment ->> 'direction',
    p_payment ->> 'party_type',
    NULLIF(p_payment ->> 'party_id', '')::uuid,
    v_amount,
    COALESCE(p_payment ->> 'currency', 'AFN'),
    COALESCE(p_payment ->> 'method', 'cash'),
    (p_payment ->> 'entry_date')::date,
    COALESCE(p_payment ->> 'reference', ''),
    COALESCE(p_payment ->> 'notes', ''),
    COALESCE(p_payment ->> 'status', 'posted'),
    p_user_id
  )
  RETURNING id INTO v_payment_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_allocations) AS a (item)
  LOOP
    -- The invoice is locked while its outstanding balance is checked, so two
    -- payments cannot both settle the same last 100 of it.
    SELECT i.total - COALESCE((
             SELECT SUM(amount) FROM payment_allocations WHERE invoice_id = i.id
           ), 0)
      INTO v_outstanding
      FROM invoices i
     WHERE i.id = (v_row.item ->> 'invoice_id')::uuid
       AND i.workspace_id = p_workspace_id
     FOR UPDATE;

    IF v_outstanding IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_INVOICE_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
    END IF;

    IF (v_row.item ->> 'amount')::numeric > v_outstanding THEN
      RAISE EXCEPTION 'PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING' USING ERRCODE = 'P0001';
    END IF;

    -- PHASE F: this insert is the ONLY write. invoices_project_settlement()
    -- recomputes paid_amount, settlement_status and status from it.
    INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount)
    VALUES (
      p_workspace_id,
      v_payment_id,
      (v_row.item ->> 'invoice_id')::uuid,
      (v_row.item ->> 'amount')::numeric
    );
  END LOOP;

  RETURN v_payment_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION payments_cancel(
  p_workspace_id uuid,
  p_payment_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_removed numeric(18, 2) := 0;
BEGIN
  PERFORM 1 FROM payments
   WHERE id = p_payment_id AND workspace_id = p_workspace_id AND status = 'posted'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CANCELLABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_removed
    FROM payment_allocations
   WHERE payment_id = p_payment_id AND workspace_id = p_workspace_id;

  -- PHASE F: deleting the allocations is the whole reversal. The trigger fires
  -- per row and recomputes each affected invoice from what REMAINS — so an
  -- invoice still settled by another payment stays settled, which the old
  -- loop got wrong by forcing every touched invoice back to 'pending'.
  DELETE FROM payment_allocations
   WHERE payment_id = p_payment_id AND workspace_id = p_workspace_id;

  -- The payment row stays and is marked cancelled: money that was taken and
  -- given back is two facts, not the absence of one.
  UPDATE payments SET status = 'cancelled', updated_at = now()
   WHERE id = p_payment_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('unallocated', v_removed);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. invoice_outstanding gains the states that depend on today
--
-- `settlement_state` repeats the stored projection so a caller needs only this
-- view; `is_overdue` and `days_overdue` are computed against CURRENT_DATE and
-- are therefore correct on the day they are read, which no stored column can
-- be.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS invoice_outstanding;

CREATE VIEW invoice_outstanding AS
SELECT
  i.id            AS invoice_id,
  i.workspace_id,
  i.invoice_number,
  i.type,
  i.customer_id,
  i.supplier_id,
  i.date          AS invoice_date,
  i.due_date,
  i.currency,
  i.total,
  COALESCE(a.allocated, 0)                     AS allocated,
  i.total - COALESCE(a.allocated, 0)           AS outstanding,

  -- Derived here rather than read from the column, so this view still tells
  -- the truth about an invoice whose projection has somehow drifted. A report
  -- that reads the same cache it is meant to be checking cannot detect
  -- anything (lesson 6).
  CASE
    WHEN COALESCE(a.allocated, 0) <= 0                  THEN 'unpaid'
    WHEN COALESCE(a.allocated, 0) >= COALESCE(i.total, 0) THEN 'paid'
    ELSE 'partially_paid'
  END                                          AS settlement_state,

  (i.due_date IS NOT NULL
   AND i.due_date::date < CURRENT_DATE
   AND i.total - COALESCE(a.allocated, 0) > 0) AS is_overdue,

  CASE
    WHEN i.due_date IS NOT NULL
     AND i.due_date::date < CURRENT_DATE
     AND i.total - COALESCE(a.allocated, 0) > 0
    THEN CURRENT_DATE - i.due_date::date
    ELSE 0
  END                                          AS days_overdue,

  i.settlement_status                          AS stored_settlement_status,
  i.paid_amount                                AS stored_paid_amount
FROM invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS allocated
  FROM payment_allocations
  GROUP BY invoice_id
) a ON a.invoice_id = i.id;

-- Without this the view runs as its creator and returns every workspace's
-- receivables to anyone who can read it. See phase-b-03.
ALTER VIEW invoice_outstanding SET (security_invoker = true);

COMMENT ON VIEW invoice_outstanding IS
  'What each invoice still owes, derived from payment_allocations. Carries both the derived settlement_state and the stored projection, so the two can be compared. Overdue is computed against CURRENT_DATE at read time. Phase F.';

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================
--
-- 1) DRIFT — where the stored projection disagrees with the allocations.
--    MUST BE EMPTY after this migration. Run it BEFORE applying too, to see
--    how far the incremental maintenance had wandered.
--
-- SELECT invoice_id, invoice_number, total, allocated,
--        stored_paid_amount, stored_settlement_status, settlement_state
-- FROM   invoice_outstanding
-- WHERE  stored_paid_amount IS DISTINCT FROM allocated
--    OR  stored_settlement_status IS DISTINCT FROM settlement_state
-- ORDER  BY ABS(COALESCE(stored_paid_amount, 0) - allocated) DESC;
--
-- 2) Invoices marked paid in the LEGACY status column that are not settled.
--    These are the ones the old partial-cancellation bug left behind, plus any
--    a PATCH set by hand. Not corrected automatically — see section 3.
--
-- SELECT invoice_id, invoice_number, total, allocated, outstanding
-- FROM   invoice_outstanding io
-- JOIN   invoices i ON i.id = io.invoice_id
-- WHERE  i.status = 'paid' AND io.outstanding > 0;
--
-- 3) The receivables ageing this now makes possible.
--
-- SELECT CASE
--          WHEN NOT is_overdue     THEN 'current'
--          WHEN days_overdue <= 30 THEN '1-30'
--          WHEN days_overdue <= 60 THEN '31-60'
--          WHEN days_overdue <= 90 THEN '61-90'
--          ELSE '90+'
--        END AS bucket,
--        COUNT(*), SUM(outstanding)
-- FROM   invoice_outstanding
-- WHERE  outstanding > 0 AND workspace_id = '<workspace uuid>'
-- GROUP  BY 1 ORDER BY 1;
