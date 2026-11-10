-- ============================================
-- docs/variant-stock-01-migration.sql
--
-- Clothing / footwear (QA document §5, 10 Nov 2026): stock PER VARIANT.
--
-- A variant (e.g. «T-shirt, black, L») already had its own SKU, barcode and price
-- (universal-core) and an invoice line could already name it (variant-binding-01).
-- What it did not have was a quantity: stock lived only on the parent, so «how many
-- black L are left?» had no answer.
--
-- The model: a stock movement may name the variant it moved. The parent's quantity
-- is unchanged (it is still the sum of every movement of the product); a variant's
-- quantity is the sum of the movements that name it. Nothing is backfilled — old
-- movements keep variant_id = NULL and count as «not assigned to a variant» (§12).
--
--   1. stock_movements.variant_id            + FK (NOT VALID) + index
--   2. product_variant_stock(ws, product)    per variant × warehouse, one read
--   3. invoice_write_document                edit give-back keeps the variant
--                                            (otherwise editing a line returned
--                                            the stock to the parent only and the
--                                            variant stayed «sold» forever)
--
-- Additive and re-runnable. Depends on: universal-core-migration.sql
-- (product_variants), m5-forward-fix-01-migration.sql (invoice_write_document rev2).
-- Deploy the backend AFTER this file: before it, a movement that names a variant is
-- refused by the database (42703) — never silently stripped.
--
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-variant-stock-01.sql.
--
-- ROLLBACK (only while no movement names a variant; afterwards the identity is lost):
--   DROP FUNCTION IF EXISTS public.product_variant_stock(uuid, uuid);
--   DROP INDEX IF EXISTS public.stock_movements_variant_idx;
--   ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_variant_fk;
--   ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS variant_id;
--   then re-run the invoice_write_document block of m5-forward-fix-01-migration.sql.
-- ============================================

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS variant_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_variant_fk') THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_variant_fk
      FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stock_movements_variant_idx
  ON public.stock_movements (workspace_id, product_id, variant_id)
  WHERE variant_id IS NOT NULL;

-- ─── 2. One product's stock per variant and warehouse ─────────────────────
-- Signed movements: + in, − out. The warehouse of a row is the one it names
-- (to_ for an arrival, from_ for a departure); NULL = «no warehouse».
CREATE OR REPLACE FUNCTION public.product_variant_stock(p_workspace_id uuid, p_product_id uuid)
RETURNS TABLE (variant_id uuid, warehouse_id uuid, quantity numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT m.variant_id,
         coalesce(m.to_warehouse_id, m.from_warehouse_id) AS warehouse_id,
         sum(m.quantity) AS quantity
    FROM public.stock_movements m
   WHERE m.workspace_id = p_workspace_id
     AND m.product_id = p_product_id
     AND m.variant_id IS NOT NULL
   GROUP BY 1, 2
$fn$;

REVOKE ALL ON FUNCTION public.product_variant_stock(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_variant_stock(uuid, uuid) TO service_role;

-- ─── 3. invoice_write_document, rev3: the edit give-back keeps the variant ──
-- Identical to rev2 (m5-forward-fix-01) except the three marked lines.
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
      (product_id, variant_id, type, quantity, reference_type, reference_id,
       from_warehouse_id, to_warehouse_id, workspace_id, user_id)
    SELECT t.product_id,
           t.variant_id,
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
               variant_id,
               coalesce(from_warehouse_id, to_warehouse_id) AS wh,
               sum(quantity) AS net
          FROM public.stock_movements
         WHERE workspace_id = p_workspace_id
           AND reference_type = 'invoice'
           AND reference_id = p_invoice_id
         GROUP BY 1, 2, 3
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
