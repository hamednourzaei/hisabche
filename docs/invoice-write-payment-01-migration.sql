-- ============================================================================
-- docs/invoice-write-payment-01-migration.sql
--
-- THE MONEY AN INVOICE TAKES AT CREATION IS WRITTEN IN THE INVOICE'S OWN
-- TRANSACTION.
--
-- WHY:
--   `InvoiceService.create` wrote the document, the items, the stock movements
--   and the package grants in one transaction, and THEN called
--   `recordPayment` once per tranche. A failure between the two left an issued
--   invoice, moved shelves and no payment row for money the person had already
--   taken. The retry helped only if the client asked again, and the till could
--   never be reconciled from the data.
--
--   The backend now prepares the payment rows BEFORE the document
--   (`PaymentsService.prepareCreationPayments`) and names them here. The
--   function calls the payments core's own wrappers —
--   `payments_record_keyed` / `payments_record_at_till` — in the same
--   transaction, so the invoice and its money commit or roll back together.
--
--   ⚠️ THE PAYMENT CORE REMAINS THE ONLY WRITER. This file does not insert
--   into `payments` or `payment_allocations`; it delegates, so `paid_amount`,
--   the allocation checks and the idempotency key behave exactly as they do for
--   a standalone payment.
--
-- INVARIANTS:
--   1. Header + items + details + stock + grants + creation payments: one
--      transaction. Any refusal rolls back ALL of it.
--   2. Every payment allocation names THIS invoice, and the payment's party is
--      the invoice's own party. A purchase cannot be settled with a customer's
--      money, and a sale cannot be settled with a supplier's.
--   3. The payment's direction follows the document: a sale takes money in, a
--      purchase pays it out.
--   4. Every payment carries the request key the backend derived per tranche,
--      so the later `recordPayment` pass finds the SAME row and books its
--      journal entry instead of writing a second payment.
--   5. A database without `payments_record_keyed` refuses the request with
--      PAYMENT_IDEMPOTENCY_MIGRATION_REQUIRED; a till payment on a database
--      without `payments_record_at_till` refuses with
--      PAYMENT_TILL_MIGRATION_REQUIRED. Nothing is written either way.
--
-- RUN ORDER (each one before this file):
--   1. docs/payments-ar-ap-migration.sql         (payments, allocations, payments_record)
--   2. docs/invoice-write-document-migration.sql (document_write_rows + 10-arg function)
--   3. docs/invoice-write-grant-01-migration.sql (11-arg function + p_grants)
--   4. docs/offline-idempotency-migration.sql    (payments_record_keyed)
--   5. docs/till-payments-01-migration.sql       (payments_record_at_till; only needed for cash at a till)
--   6. docs/opening-capital-and-fees-01-migration.sql (not used here; kept for ordering after 5)
--   Verify with docs/VERIFY-invoice-write-payment-01.sql.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb);
--   (the 10- and 11-argument functions are untouched and keep working; the
--   server then refuses a create that takes money with
--   INVOICE_PAYMENT_ATOMIC_MIGRATION_REQUIRED, so no invoice is written
--   without the money it says it took.)
--
-- RE-RUN SAFETY:
--   CREATE OR REPLACE with the identical signature. Re-running any earlier
--   migration afterwards only (re)creates its own arity and does not remove
--   this one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The 12-argument invoice_write_document with atomic creation payments.
--
--    NO parameter after p_movements has a DEFAULT, on purpose: PostgreSQL
--    requires every parameter after a defaulted one to default too, and a
--    default would make a shorter call match both functions (42725, "not
--    unique"). The server names p_grants and p_payments together whenever
--    there is money, so it selects exactly this one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_write_document(
  p_workspace_id uuid,
  p_invoice_id uuid,
  -- The actor, recorded on reversal movements. Never a filter.
  p_user_id uuid,
  -- The header row for a NEW invoice. NULL for an edit.
  p_header jsonb,
  p_items jsonb,
  p_details jsonb,
  p_movements jsonb,
  -- Edit: delete the old lines and give back EXACTLY the stock they moved.
  p_replace_items boolean,
  -- Edit: the header's money, derived from the new lines by the backend.
  p_header_patch jsonb,
  -- Edit: the version the editor read. NULL = no check (metadata-free callers).
  p_expected_version bigint,
  -- M5 Slice D: atomic package credit grants.
  p_grants jsonb,
  -- The payments the creation request takes, written by the payments core in
  -- this transaction. Each element:
  --   { payment: jsonb, allocations: jsonb, client_request_id: text,
  --     till_session_id?: uuid, till_amount_minor?: bigint }
  p_payments jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bad int;
  v_row jsonb;
  v_cols text;
  v_grant_cols text;
  v_pay jsonb;
  v_customer uuid;
  v_supplier uuid;
  v_type text;
BEGIN
  IF p_workspace_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_write_document: workspace and invoice are required' USING ERRCODE = '22023';
  END IF;

  -- ── Every row belongs to THIS workspace and THIS invoice ─────────────────
  IF p_header IS NOT NULL AND (
       (p_header ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id
    OR (p_header ->> 'id')::uuid IS DISTINCT FROM p_invoice_id) THEN
    RAISE EXCEPTION 'invoice_write_document: header does not match workspace/invoice' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_items, '[]')) r
   WHERE (r ->> 'invoice_id')::uuid IS DISTINCT FROM p_invoice_id OR (r ->> 'id') IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: an item names another invoice' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_details, '[]')) d
   WHERE NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(coalesce(p_items, '[]')) r
      WHERE r ->> 'id' = d ->> 'invoice_item_id');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: a detail names an item outside this write' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_movements, '[]')) m
   WHERE (m ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id
      OR (m ->> 'reference_id')::uuid IS DISTINCT FROM p_invoice_id
      OR (m ->> 'reference_type') IS DISTINCT FROM 'invoice';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: a stock movement names another workspace or document' USING ERRCODE = '42501';
  END IF;

  -- M5 SLICE D: Validate atomic grant rows
  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_grants, '[]')) g
   WHERE (g ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id
      OR (g ->> 'source_document_id')::uuid IS DISTINCT FROM p_invoice_id
      OR (g ->> 'source_document_type') IS DISTINCT FROM 'invoice'
      OR (g ->> 'entry_type') IS DISTINCT FROM 'GRANT';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invoice_write_document: a grant names another workspace or document' USING ERRCODE = '42501';
  END IF;

  -- ── The document ─────────────────────────────────────────────────────────
  IF p_header IS NOT NULL THEN
    PERFORM public.document_write_rows('invoices', jsonb_build_array(p_header));
  ELSE
    SELECT to_jsonb(i) INTO v_row
      FROM public.invoices i
     WHERE i.id = p_invoice_id AND i.workspace_id = p_workspace_id
       FOR UPDATE;
    IF v_row IS NULL THEN
      RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_version IS NOT NULL
       AND (v_row ->> 'version')::bigint IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'INVOICE_VERSION_CONFLICT' USING ERRCODE = '40001';
    END IF;
    IF p_replace_items AND (v_row ->> 'finalized_at') IS NOT NULL THEN
      RAISE EXCEPTION 'INVOICE_FINALIZED' USING ERRCODE = '55000';
    END IF;

    IF p_header_patch IS NOT NULL AND p_header_patch <> '{}'::jsonb THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_header_patch) k
                  WHERE k NOT IN ('subtotal', 'discount_total', 'tax_total', 'total', 'updated_at')) THEN
        RAISE EXCEPTION 'invoice_write_document: the patch may only set the derived money' USING ERRCODE = '42501';
      END IF;
      SELECT string_agg(quote_ident(k), ', ' ORDER BY k) INTO v_cols
        FROM jsonb_object_keys(p_header_patch) k;
      EXECUTE format(
        'UPDATE public.invoices SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.invoices, $1)) WHERE id = $2 AND workspace_id = $3',
        v_cols, v_cols
      ) USING p_header_patch, p_invoice_id, p_workspace_id;
    END IF;
  END IF;

  IF p_replace_items THEN
    INSERT INTO public.stock_movements
      (product_id, type, quantity, reference_type, reference_id,
       from_warehouse_id, to_warehouse_id, workspace_id, user_id)
    SELECT t.product_id,
           CASE WHEN t.net < 0 THEN 'purchase' ELSE 'sale' END,
           -t.net,
           'invoice',
           p_invoice_id,
           CASE WHEN t.net > 0 THEN t.wh END,
           CASE WHEN t.net < 0 THEN t.wh END,
           p_workspace_id,
           p_user_id
      FROM (
        SELECT product_id,
               coalesce(from_warehouse_id, to_warehouse_id) AS wh,
               sum(quantity) AS net
          FROM public.stock_movements
         WHERE workspace_id = p_workspace_id
           AND reference_type = 'invoice'
           AND reference_id = p_invoice_id
         GROUP BY 1, 2
      ) t
     WHERE t.net <> 0;

    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  END IF;

  PERFORM public.document_write_rows('invoice_items', p_items);
  PERFORM public.document_write_rows('invoice_item_details', p_details);
  PERFORM public.document_write_rows('stock_movements', p_movements);

  -- M5 SLICE D: Write package credit grant rows in same transaction
  IF p_grants IS NOT NULL AND jsonb_typeof(p_grants) = 'array' AND jsonb_array_length(p_grants) > 0 THEN
    SELECT string_agg(quote_ident(k), ', ' ORDER BY k)
      INTO v_grant_cols
      FROM (SELECT DISTINCT jsonb_object_keys(g) AS k FROM jsonb_array_elements(p_grants) g) keys;
    EXECUTE format(
      'INSERT INTO public.package_credit_ledger (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.package_credit_ledger, $1)',
      v_grant_cols, v_grant_cols
    ) USING p_grants;
  END IF;

  -- ── THE MONEY, IN THE SAME TRANSACTION ───────────────────────────────────
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    -- The invoice's own party and kind, from the row that now exists.
    SELECT customer_id, supplier_id, type
      INTO v_customer, v_supplier, v_type
      FROM public.invoices
     WHERE id = p_invoice_id AND workspace_id = p_workspace_id;

    -- Every payment belongs to this invoice and to its party, and moves the
    -- right way. Refused before ANY payment is written.
    SELECT count(*) INTO v_bad
      FROM jsonb_array_elements(p_payments) p
     WHERE p ->> 'client_request_id' IS NULL
        OR length(p ->> 'client_request_id') < 8
        OR p -> 'payment' IS NULL
        OR (p -> 'payment' ->> 'party_type') NOT IN ('customer', 'supplier')
        OR jsonb_array_length(coalesce(p -> 'allocations', '[]'::jsonb)) = 0
        OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(coalesce(p -> 'allocations', '[]'::jsonb)) a
              WHERE (a ->> 'invoice_id') IS NULL
                 OR (a ->> 'invoice_id')::uuid IS DISTINCT FROM p_invoice_id
                 OR (a ->> 'amount') IS NULL
                 OR (a ->> 'amount')::numeric <= 0
           )
        OR (
             (p -> 'payment' ->> 'party_type') = 'customer'
             AND (p -> 'payment' ->> 'party_id')::uuid IS DISTINCT FROM v_customer
           )
        OR (
             (p -> 'payment' ->> 'party_type') = 'supplier'
             AND (p -> 'payment' ->> 'party_id')::uuid IS DISTINCT FROM v_supplier
           )
        OR (v_type = 'sale' AND (p -> 'payment' ->> 'direction') IS DISTINCT FROM 'in')
        OR (v_type = 'purchase' AND (p -> 'payment' ->> 'direction') IS DISTINCT FROM 'out');
    IF v_bad > 0 THEN
      RAISE EXCEPTION 'invoice_write_document: a creation payment names another invoice, party or direction' USING ERRCODE = '42501';
    END IF;

    FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
      IF v_pay ->> 'till_session_id' IS NOT NULL THEN
        IF to_regprocedure('public.payments_record_at_till(uuid,uuid,jsonb,jsonb,text,uuid,bigint)') IS NULL THEN
          RAISE EXCEPTION 'PAYMENT_TILL_MIGRATION_REQUIRED: apply docs/till-payments-01-migration.sql before taking cash into a till with a new invoice. Nothing was written.' USING ERRCODE = 'P0001';
        END IF;
        PERFORM public.payments_record_at_till(
          p_workspace_id,
          p_user_id,
          v_pay -> 'payment',
          v_pay -> 'allocations',
          v_pay ->> 'client_request_id',
          (v_pay ->> 'till_session_id')::uuid,
          (v_pay ->> 'till_amount_minor')::bigint
        );
      ELSE
        IF to_regprocedure('public.payments_record_keyed(uuid,uuid,jsonb,jsonb,text)') IS NULL THEN
          RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_MIGRATION_REQUIRED: apply docs/offline-idempotency-migration.sql before taking money with a new invoice. Nothing was written.' USING ERRCODE = 'P0001';
        END IF;
        PERFORM public.payments_record_keyed(
          p_workspace_id,
          p_user_id,
          v_pay -> 'payment',
          v_pay -> 'allocations',
          v_pay ->> 'client_request_id'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
