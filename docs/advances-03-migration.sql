-- ============================================================================
-- docs/advances-03-migration.sql
--
-- پیش‌فروش / پیش‌خرید با اقلام — 9 Nov 2026, owner decision «advance + lines».
--
-- A pre-sale or pre-purchase is now written in the SAME invoice builder as a
-- sale: customer, lines, discount, tax. The lines are stored on the advance
-- itself as one jsonb document. They book NOTHING: no stock, no receivable, no
-- revenue. The money is still the advance (`amount_minor`), booked exactly as
-- in advances-02. The server computes every total from the lines
-- (packages/validation/src/schemas/advance-document.ts) and refuses an advance
-- larger than the document.
--
-- The document is written once, with the advance, and never changed: the
-- trigger below refuses any change to it.
--
-- RUN ORDER: after advances-02.
-- ADDITIVE, IDEMPOTENT, SAFE TO RE-RUN.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-advances-03.sql.
--    Status: PENDING HUMAN CONFIRMATION
--
-- ROLLBACK / MITIGATION (only if no advance has lines yet):
--   DROP TRIGGER IF EXISTS order_deposits_document_frozen_trg ON public.order_deposits;
--   DROP FUNCTION IF EXISTS public.order_deposits_document_frozen();
--   ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_document_shape;
--   ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS document;
-- ============================================================================

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_deposits' AND column_name = 'source_type'
  ) THEN
    RAISE EXCEPTION 'ADVANCES_03: run docs/advances-02-migration.sql first.';
  END IF;
END
$guard$;

ALTER TABLE public.order_deposits ADD COLUMN IF NOT EXISTS document jsonb;

-- Only an advance carries lines; the document is an object of bounded size.
ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_document_shape;
ALTER TABLE public.order_deposits ADD CONSTRAINT order_deposits_document_shape
  CHECK (
    document IS NULL
    OR (
      jsonb_typeof(document) = 'object'
      AND source_type IN ('pre_sale', 'pre_purchase')
      AND jsonb_typeof(document -> 'lines') = 'array'
      AND jsonb_array_length(document -> 'lines') BETWEEN 1 AND 200
      AND (document ->> 'totalMinor') ~ '^[0-9]+$'
      AND amount_minor <= (document ->> 'totalMinor')::numeric
      AND pg_column_size(document) <= 262144
    )
  );

-- Written once, with the advance.
CREATE OR REPLACE FUNCTION public.order_deposits_document_frozen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.document IS DISTINCT FROM OLD.document THEN
    RAISE EXCEPTION 'ADVANCE_DOCUMENT_FROZEN' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.order_deposits_document_frozen() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS order_deposits_document_frozen_trg ON public.order_deposits;
CREATE TRIGGER order_deposits_document_frozen_trg
  BEFORE UPDATE OF document ON public.order_deposits
  FOR EACH ROW EXECUTE FUNCTION public.order_deposits_document_frozen();

COMMENT ON COLUMN public.order_deposits.document IS
  'advances-03: the priced lines a pre-sale / pre-purchase was taken for. Books nothing; written once.';
