-- ============================================================================
-- docs/product-barcodes-migration.sql                  (27 Sep 2026)
--
-- ⚠️ RUN AFTER docs/product-barcode-unique-migration.sql.
--
-- MORE THAN ONE BARCODE PER PRODUCT.
--
-- WHY
--   A product had exactly one barcode. The same goods arrive under a second
--   supplier's code, the carton has its own code, a new packaging changes the
--   code — and a scan of any of those found nothing.
--
-- WHAT
--   product_barcodes: extra codes for a product, each optionally naming the
--   UNIT it sells in (the carton's code adds a carton, not a piece).
--
--   ⚠️ ONE CODE, ONE PRODUCT — across BOTH places. A code must not be both one
--   product's main barcode and another's extra code: the scanner would have to
--   guess. The unique index covers the extra codes; two triggers cover the
--   crossing (an extra code equal to any main barcode, and a main barcode equal
--   to any extra code), raising the same 23505 the backend already answers as
--   BARCODE_TAKEN.
--
-- SAFETY
--   Additive and idempotent. Row security like product_units: only the
--   workspace's own members, through auth_workspace_ids(). The backend uses
--   the service role.
--
-- ROLLBACK
--   DROP TRIGGER IF EXISTS products_barcode_not_extra ON public.products;
--   DROP TABLE IF EXISTS public.product_barcodes;   -- the extra codes only
--   DROP FUNCTION IF EXISTS public.product_barcode_guard();
--   The backend reads the table as «no extra codes» while it is absent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode      text NOT NULL CHECK (length(btrim(barcode)) > 0),
  -- The unit this code sells in; NULL = the product's own unit.
  unit         text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_barcodes_workspace_barcode_key
  ON public.product_barcodes (workspace_id, barcode);
CREATE INDEX IF NOT EXISTS product_barcodes_product_idx
  ON public.product_barcodes (workspace_id, product_id);

-- ── One code, one product, across both places ──────────────────────────────
CREATE OR REPLACE FUNCTION public.product_barcode_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'product_barcodes' THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.workspace_id = NEW.workspace_id AND p.barcode = NEW.barcode
    ) THEN
      RAISE EXCEPTION 'product_barcodes_workspace_barcode_key: % is already a product''s barcode', NEW.barcode
        USING ERRCODE = 'unique_violation';
    END IF;
  ELSIF NEW.barcode IS NOT NULL AND NEW.barcode <> ''
        AND NEW.barcode IS DISTINCT FROM OLD.barcode THEN
    IF to_regclass('public.product_barcodes') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.product_barcodes b
       WHERE b.workspace_id = NEW.workspace_id AND b.barcode = NEW.barcode
    ) THEN
      RAISE EXCEPTION 'product_barcodes_workspace_barcode_key: % is already another product''s extra barcode', NEW.barcode
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_barcodes_not_main ON public.product_barcodes;
CREATE TRIGGER product_barcodes_not_main
  BEFORE INSERT OR UPDATE OF barcode ON public.product_barcodes
  FOR EACH ROW EXECUTE FUNCTION public.product_barcode_guard();

DROP TRIGGER IF EXISTS products_barcode_not_extra ON public.products;
CREATE TRIGGER products_barcode_not_extra
  BEFORE INSERT OR UPDATE OF barcode ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.product_barcode_guard();

-- ── Row security ────────────────────────────────────────────────────────────
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;

-- ⚠️ WHERE THE HELPER LIVES DEPENDS ON THE DATABASE. tenancy-rls.sql created
-- auth_workspace_ids() in `public`; linter-2026-09-14-migration.sql moved it
-- to `private` (so PostgREST stops exposing a SECURITY DEFINER function). A
-- bare `auth_workspace_ids()` fails with 42883 on a database that ran the
-- latter. The policy names whichever one exists; with neither, RLS stays ON
-- with NO policy — clients see nothing, the backend (service role) is
-- unaffected — and this says so rather than inventing a weaker rule.
-- Two written-out statements, one per place the helper can be: PL/pgSQL only
-- resolves the function in the branch that runs, so the other never errors.
DO $$
BEGIN
  DROP POLICY IF EXISTS product_barcodes_workspace ON product_barcodes;

  IF to_regprocedure('private.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY product_barcodes_workspace ON product_barcodes
      FOR ALL
      USING (EXISTS (SELECT 1 FROM private.auth_workspace_ids() w WHERE w = product_barcodes.workspace_id))
      WITH CHECK (EXISTS (SELECT 1 FROM private.auth_workspace_ids() w WHERE w = product_barcodes.workspace_id));
  ELSIF to_regprocedure('public.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY product_barcodes_workspace ON product_barcodes
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.auth_workspace_ids() w WHERE w = product_barcodes.workspace_id))
      WITH CHECK (EXISTS (SELECT 1 FROM public.auth_workspace_ids() w WHERE w = product_barcodes.workspace_id));
  ELSE
    RAISE NOTICE 'product_barcodes: auth_workspace_ids() not found — RLS is on with no policy (clients read nothing; the backend is unaffected). Run tenancy-rls.sql, then re-run this file.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
