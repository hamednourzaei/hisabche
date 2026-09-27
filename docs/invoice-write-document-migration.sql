-- ============================================================================
-- docs/invoice-write-document-migration.sql            (27 Sep 2026)
--
-- An invoice's DOCUMENT and its STOCK in ONE transaction — on create AND on
-- editing its lines.
--
-- WHY
--   supabase-js has no transactions (CLAUDE.md rule 4). Creating an invoice
--   wrote, one statement after another: the header, the items, the item
--   details, the stock movements. A failure between them left real half-states:
--     * a header with no items («Invoice N was created but its items could not
--       be saved»);
--     * items whose details failed — «fixed» by a compensating DELETE of the
--       invoice, which rule 4 forbids: a second write that can itself fail;
--     * a document with its lines but no stock movement: goods sold that never
--       left the shelf.
--   Editing the lines (replaceInvoiceItems) had the same shape, worse: the old
--   stock was reversed, the old items deleted, and a failure on the new insert
--   left an invoice with NO lines and its stock already given back.
--
--   ⚠️ THE EDIT'S REVERSAL WAS WRONG FOR ANY UNIT BUT THE BASE. It re-derived
--   the old lines' stock from `invoice_items` WITHOUT their unit, so «2 cartons»
--   (48 pieces) gave back 2. Here the reversal is the exact negative of the
--   movements actually recorded against this invoice — whatever units made
--   them, inside the same transaction, so two edits cannot both reverse.
--
--   ⚠️ AND AN EDIT COULD OVERWRITE ANOTHER EDIT. PATCH had no version check: two
--   people editing one invoice, the second silently won. An edit now names the
--   version it read; a different current version aborts with 40001.
--
--   ⚠️ AND A FINALIZED INVOICE'S LINES COULD BE REPLACED. invoices_guard_
--   finalized protects the header's money columns only; the lines live in
--   another table. An edit of a finalized invoice now aborts (55000).
--
--   Every business rule (money derived from the lines, unit conversion,
--   warehouse, tenancy) stays in TypeScript, in its one place. This function
--   only writes the rows it is given, together, and checks they belong here.
--
--   Costing, the journal entry and payments stay after it: each is its own
--   document with its own idempotency key and drift check (markPosted / V3).
--
-- SAFETY
--   * Additive, idempotent (CREATE OR REPLACE). No table or data changes.
--   * Every row is checked against p_workspace_id / p_invoice_id before it is
--     written: a row naming another workspace or invoice aborts the call.
--   * Takes the workspace as a PARAMETER, so clients must not call it: EXECUTE
--     only for service_role. SECURITY INVOKER, fixed search_path.
--   * Only the columns each row names are inserted, so a column the database
--     does not have yet fails loudly (42703), and defaults apply to the rest.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint);
--   DROP FUNCTION IF EXISTS public.document_write_rows(text, jsonb);
--   The backend detects the missing function (PGRST202 / 42883) and writes the
--   same rows one statement at a time, as before. No deploy needed.
-- ============================================================================

-- Insert a JSON array of rows into one of the document tables, naming only the
-- columns the rows carry. Private helper: whitelisted tables only. Shared with
-- docs/purchase-order-write-migration.sql.
CREATE OR REPLACE FUNCTION public.document_write_rows(p_table text, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cols text;
BEGIN
  IF p_table NOT IN ('invoices', 'invoice_items', 'invoice_item_details', 'stock_movements',
                     'purchase_orders', 'purchase_order_items') THEN
    RAISE EXCEPTION 'document_write_rows: table % is not a document table', p_table
      USING ERRCODE = '22023';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(k), ', ' ORDER BY k)
    INTO v_cols
    FROM (SELECT DISTINCT jsonb_object_keys(r) AS k FROM jsonb_array_elements(p_rows) r) keys;

  EXECUTE format(
    'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1)',
    p_table, v_cols, v_cols, p_table
  ) USING p_rows;
END;
$$;

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
  p_replace_items boolean DEFAULT false,
  -- Edit: the header's money, derived from the new lines by the backend.
  p_header_patch jsonb DEFAULT NULL,
  -- Edit: the version the editor read. NULL = no check (metadata-free callers).
  p_expected_version bigint DEFAULT NULL
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

  -- ── The document ─────────────────────────────────────────────────────────
  IF p_header IS NOT NULL THEN
    PERFORM public.document_write_rows('invoices', jsonb_build_array(p_header));
  ELSE
    -- An edit. Locked, so two edits of one invoice run one after the other;
    -- read as JSON so optional columns (version, finalized_at) never fail.
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
      -- Only the money the lines decide, and when it changed.
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
    -- Give back what this invoice moved so far: per product and warehouse, the
    -- NET of every movement recorded against it (earlier edits included), so a
    -- line's own unit never has to be re-derived. A net outflow comes back as
    -- an inflow to the same warehouse, and the other way round.
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

    -- Old details go with their items (ON DELETE CASCADE).
    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  END IF;

  PERFORM public.document_write_rows('invoice_items', p_items);
  PERFORM public.document_write_rows('invoice_item_details', p_details);

  -- ── The stock ────────────────────────────────────────────────────────────
  -- stock_movements_project() maintains products.quantity / warehouse_stock
  -- from these rows, inside this same transaction.
  PERFORM public.document_write_rows('stock_movements', p_movements);

  RETURN p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.document_write_rows(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.document_write_rows(text, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.document_write_rows(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
