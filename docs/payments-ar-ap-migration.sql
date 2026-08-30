-- ============================================================================
-- docs/payments-ar-ap-migration.sql
--
-- Payments, and the allocation of a payment to the invoices it settles.
--
-- WHY THIS FILE EXISTS
--   There was no such thing as a payment. There was a number, `paid_amount`,
--   sitting on the invoice, writable by any PATCH that touched the invoice —
--   and a free-form row in `transactions` that nothing reconciled against it.
--   A customer who paid 500 against two invoices of 300 could not be recorded
--   at all, and the 200 they overpaid had nowhere to live.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- ============================================================================

BEGIN;

-- ─── 1. Payments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  payment_number text,
  -- 'in'  — money received from a customer  (settles a receivable)
  -- 'out' — money paid to a supplier        (settles a payable)
  direction      text NOT NULL,
  party_type     text NOT NULL,
  party_id       uuid,
  amount         numeric(18, 2) NOT NULL,
  currency       text NOT NULL DEFAULT 'AFN',
  method         text NOT NULL DEFAULT 'cash',
  entry_date     date NOT NULL,
  reference      text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'posted',
  journal_entry_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  CONSTRAINT payments_direction_check CHECK (direction IN ('in', 'out')),
  CONSTRAINT payments_party_check CHECK (party_type IN ('customer', 'supplier')),
  CONSTRAINT payments_status_check CHECK (status IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT payments_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS payments_workspace_date_idx
  ON payments (workspace_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS payments_party_idx
  ON payments (workspace_id, party_type, party_id);

CREATE UNIQUE INDEX IF NOT EXISTS payments_number_key
  ON payments (workspace_id, payment_number)
  WHERE payment_number IS NOT NULL;

-- ─── 2. Allocation ──────────────────────────────────────────────────────────
-- Which invoice each part of a payment settled. The outstanding balance of an
-- invoice is derived from these rows, never from a stored figure.

CREATE TABLE IF NOT EXISTS payment_allocations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  payment_id   uuid NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
  invoice_id   uuid NOT NULL,
  amount       numeric(18, 2) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_amount_check CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx
  ON payment_allocations (workspace_id, invoice_id);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx
  ON payment_allocations (payment_id);

-- ─── 3. What an invoice still owes ──────────────────────────────────────────
-- total − everything allocated to it. `paid_amount` is kept in step as a
-- display cache, but nothing decides anything from it.

CREATE OR REPLACE VIEW invoice_outstanding AS
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
  COALESCE(a.allocated, 0)          AS allocated,
  i.total - COALESCE(a.allocated, 0) AS outstanding
FROM invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS allocated
  FROM payment_allocations
  GROUP BY invoice_id
) a ON a.invoice_id = i.id;

-- ─── 4. Recording a payment ─────────────────────────────────────────────────
-- The payment, its allocations and the invoices' cached paid_amount move
-- together or not at all.

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

    INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount)
    VALUES (
      p_workspace_id,
      v_payment_id,
      (v_row.item ->> 'invoice_id')::uuid,
      (v_row.item ->> 'amount')::numeric
    );

    UPDATE invoices
       SET paid_amount = COALESCE(paid_amount, 0) + (v_row.item ->> 'amount')::numeric,
           status = CASE
             WHEN COALESCE(paid_amount, 0) + (v_row.item ->> 'amount')::numeric >= total
               THEN 'paid'
             ELSE status
           END,
           updated_at = now()
     WHERE id = (v_row.item ->> 'invoice_id')::uuid
       AND workspace_id = p_workspace_id;
  END LOOP;

  RETURN v_payment_id;
END;
$fn$;

-- ─── 5. Cancelling a payment ────────────────────────────────────────────────
-- The allocations are removed and the invoices reopened. The payment row stays
-- and is marked cancelled: money that was taken and given back is two facts,
-- not the absence of one.

CREATE OR REPLACE FUNCTION payments_cancel(
  p_workspace_id uuid,
  p_payment_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row     record;
  v_removed numeric(18, 2) := 0;
BEGIN
  PERFORM 1 FROM payments
   WHERE id = p_payment_id AND workspace_id = p_workspace_id AND status = 'posted'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CANCELLABLE' USING ERRCODE = 'P0001';
  END IF;

  FOR v_row IN
    SELECT invoice_id, amount FROM payment_allocations
     WHERE payment_id = p_payment_id AND workspace_id = p_workspace_id
  LOOP
    UPDATE invoices
       SET paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - v_row.amount),
           status = CASE WHEN status = 'paid' THEN 'pending' ELSE status END,
           updated_at = now()
     WHERE id = v_row.invoice_id AND workspace_id = p_workspace_id;

    v_removed := v_removed + v_row.amount;
  END LOOP;

  DELETE FROM payment_allocations
   WHERE payment_id = p_payment_id AND workspace_id = p_workspace_id;

  UPDATE payments SET status = 'cancelled', updated_at = now()
   WHERE id = p_payment_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('unallocated', v_removed);
END;
$fn$;

-- ─── 6. Row level security ──────────────────────────────────────────────────

ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_workspace_members ON payments;
CREATE POLICY payments_workspace_members ON payments
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS payment_allocations_workspace_members ON payment_allocations;
CREATE POLICY payment_allocations_workspace_members ON payment_allocations
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;
