-- ============================================================================
-- docs/invoice-write-grant-01-migration.sql
--
-- M5 SLICE D: Atomic Package Credit Grant inside Invoice Write Document
--
-- WHY:
--   grantPackageCreditsForInvoice previously wrote the GRANT in a second call after
--   the invoice was saved and only logged warnings on failure. If a failure happened,
--   the invoice existed with no package credit entitlement (orphan payment).
--   This migration extends invoice_write_document to atomically write the
--   package_credit_ledger GRANT rows within the exact same transaction.
--
-- INVARIANTS:
--   1. One atomic transaction: invoice + lines + details + stock movements + grants.
--   2. Any failure rolls back everything (no invoice without grant, no grant without invoice).
--   3. Every grant row must strictly match p_workspace_id, p_invoice_id, and entry_type 'GRANT'.
--   4. Idempotency is preserved on invoice retries.
--
-- RUN ORDER:
--   Run after invoice-write-document-migration.sql and package-credit-ledger-01-migration.sql.
--   Verify with docs/VERIFY-invoice-write-grant-01.sql.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb);
--   (the 10-argument function of invoice-write-document-migration.sql is untouched and keeps working)
--
-- RE-RUN SAFETY:
--   Re-running invoice-write-document-migration.sql afterwards only (re)creates the 10-argument function and
--   document_write_rows; this function does not depend on document_write_rows, so nothing here is undone.
-- ============================================================================

-- 1. document_write_rows is NOT touched: its whitelist lives in invoice-write-document-migration.sql,
--    and re-running that older file would remove anything added here. The grants are inserted by the function below.

-- 2. Define the 11-argument invoice_write_document with atomic grants.
--    NO parameter after p_movements has a DEFAULT on purpose (PostgreSQL requires every parameter after a defaulted one to
--    default too, so p_grants cannot be the only bare one): the 10-argument function of invoice-write-document-migration.sql
--    stays, and a default here would make a 10-argument call match both functions (42725 not unique). The server always names
--    all three of them; only p_grants is named conditionally, and then it selects THIS function.
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
  -- M5 Slice D: Atomic Package Credit Grants
  p_grants jsonb
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

  RETURN p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
