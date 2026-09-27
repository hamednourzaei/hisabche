-- ============================================================================
-- product-barcode-unique-migration.sql — one barcode, one product, per workspace
-- (request: barcode scanner in invoicing, 27 Sep 2026)
--
-- WHY: the scanner resolves a code to exactly one product. Two products with
-- the same barcode make a scan ambiguous, and until now nothing stopped it —
-- not the database and not the form. This makes it a database
-- invariant: a second product with a barcode already in use is refused
-- (the API answers 409 BARCODE_TAKEN on the barcode field).
--
-- SCOPE: per workspace (two shops may sell the same Coca-Cola). Empty barcodes
-- are excluded — the API stores '' for «no barcode», and many products have
-- none.
--
-- SAFE TO RE-RUN: IF NOT EXISTS everywhere. ADDITIVE: one index, no data is
-- changed. If duplicates ALREADY exist the index is NOT created and a NOTICE
-- says so — run the verification query below, fix the duplicates by hand (the
-- people who know which product is right), then run this file again.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

DO $$
DECLARE
  v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT 1
      FROM public.products
     WHERE barcode IS NOT NULL AND barcode <> ''
     GROUP BY workspace_id, barcode
    HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE NOTICE 'products_workspace_barcode_key NOT created: % barcode(s) are shared by more than one product in a workspace. Run the verification query (section 2), resolve them, and re-run this file.', v_dupes;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS products_workspace_barcode_key
      ON public.products (workspace_id, barcode)
      WHERE barcode IS NOT NULL AND barcode <> '';
    RAISE NOTICE 'products_workspace_barcode_key is in place.';
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK / MITIGATION
--   DROP INDEX IF EXISTS public.products_workspace_barcode_key;
-- Dropping it only removes the guarantee; no data depends on it. The API keeps
-- working (the 409 simply stops happening, and a shared barcode becomes a
-- «pick one» dialog at the scanner instead of being impossible).
-- ============================================================================
