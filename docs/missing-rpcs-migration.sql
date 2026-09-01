-- ============================================================================
-- docs/missing-rpcs-migration.sql
--
-- The two functions the backend calls that no migration created.
--
-- Found by `scripts/verify-bundle-covers-code.mjs`, which reads every
-- `.rpc('…')` in `backend/src` and checks the bundle creates it.
--
-- Neither failure was visible in production, for two different reasons — and
-- both reasons are worth reading, because they are how a gap survives.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. get_next_invoice_number ─────────────────────────────────────────────
--
-- `invoice.service.ts` calls it, and on failure falls back to a timestamp:
--
--     INV-M8K2P1-A3F9
--
-- So the missing function never broke anything. It just quietly produced
-- invoice numbers that are not sequential, which a shopkeeper reading their
-- own book notices immediately and an automated test never does.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY A SEQUENCE AND NOT max(number) + 1
--
-- `SELECT max(…) + 1` under two concurrent sales returns the same number
-- twice. A sequence is atomic and never does — at the cost that a rolled-back
-- transaction leaves a gap. Gaps are fine and expected; duplicates are two
-- invoices with one identity.

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS bigint
LANGUAGE sql
VOLATILE
AS $$
  SELECT nextval('invoice_number_seq');
$$;

-- ─── 2. traceability_consume_batch ──────────────────────────────────────────
--
-- `traceability.service.ts` calls it and, when it errors, falls back to a
-- read-then-write in application code. That fallback carries a comment saying
-- exactly what it is:
--
--     "No RPC deployed yet: fall back to a guarded update … Slower and racier
--      than the function, and it says so."
--
-- Which is honest, and has been the code path in production this whole time.
-- Two tills selling the last of a batch at the same moment both read the same
-- remainder and both write it down.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY THE UPDATE CARRIES ITS OWN GUARD
--
-- `remaining_qty >= p_quantity` is in the WHERE clause, not checked before it.
-- That makes the read and the write one statement, which is the only version
-- that is safe under concurrency: the second till's UPDATE matches no row and
-- raises, rather than succeeding on a remainder that is already gone.
--
-- The CHECK constraint on `stock_batches` would also refuse a negative
-- remainder — but it would refuse it as a constraint violation, after the
-- application had already decided the sale was fine.

CREATE OR REPLACE FUNCTION traceability_consume_batch(
  p_workspace_id uuid,
  p_batch_id     uuid,
  p_quantity     numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- Pinned so a caller cannot shadow `stock_batches` with something of their own.
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'TRACEABILITY_QUANTITY_INVALID';
  END IF;

  UPDATE stock_batches
     SET remaining_qty = remaining_qty - p_quantity
   WHERE id = p_batch_id
     -- The tenancy boundary, inside the function. A SECURITY DEFINER function
     -- runs as its owner and bypasses RLS, so this line is the ONLY thing
     -- stopping one workspace from consuming another's stock.
     AND workspace_id = p_workspace_id
     AND remaining_qty >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- One message for "no such batch here" and "not enough left", because
    -- telling them apart would confirm to a caller that a batch exists in a
    -- workspace they cannot see.
    RAISE EXCEPTION 'TRACEABILITY_BATCH_UNAVAILABLE';
  END IF;
END;
$$;

COMMIT;
