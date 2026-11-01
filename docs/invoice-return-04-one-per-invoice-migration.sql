-- ============================================================================
-- Hisabche Migration: one return per invoice (database-level lock)
-- File: docs/invoice-return-04-one-per-invoice-migration.sql
--
-- WHY: the service checks «does this invoice already have a return?» before calling
-- invoice_return_create, but two requests arriving together can both pass that check.
-- A user recorded FIVE returns on one invoice. This trigger makes the rule hold in the
-- database itself.
--
-- WHY A TRIGGER AND NOT A UNIQUE INDEX: the live database already holds invoices with
-- several returns. CREATE UNIQUE INDEX would fail on them, and the rows must not be
-- deleted (each has a journal entry and stock movements). A BEFORE INSERT trigger only
-- judges NEW rows, so the old duplicates stay untouched and nothing new can join them.
--
-- The advisory lock serialises two concurrent inserts for the same invoice: the second
-- one waits, then sees the first and is refused with INVOICE_ALREADY_RETURNED.
--
-- Additive and idempotent. Run docs/VERIFY-invoice-return-04.sql after it:
-- PENDING HUMAN CONFIRMATION.
-- Rollback: DROP TRIGGER IF EXISTS invoice_returns_one_per_invoice_trg ON public.invoice_returns;
--           DROP FUNCTION IF EXISTS public.invoice_returns_one_per_invoice();
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoice_returns_one_per_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.original_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.original_invoice_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.invoice_returns r
    WHERE r.original_invoice_id = NEW.original_invoice_id
      AND r.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'INVOICE_ALREADY_RETURNED' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_returns_one_per_invoice() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS invoice_returns_one_per_invoice_trg ON public.invoice_returns;
CREATE TRIGGER invoice_returns_one_per_invoice_trg
  BEFORE INSERT ON public.invoice_returns
  FOR EACH ROW EXECUTE FUNCTION public.invoice_returns_one_per_invoice();
