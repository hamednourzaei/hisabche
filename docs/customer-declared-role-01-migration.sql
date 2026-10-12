-- ═══════════════════════════════════════════════════════════════════════════
-- CUSTOMER DECLARED ROLE 01 — declared role at party creation
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Run by a person, in the Supabase SQL Editor, as one script. Additive and
-- idempotent: running it twice changes nothing the second time.
--
-- Adds nullable declared_role to customers:
--   NULL   = nothing declared (every existing row; no backfill, no guessing)
--   buyer  = explicitly declared customer
--   seller = explicitly declared supplier
--   both   = explicitly declared buyer and seller
--
-- And one read-only function, customer_invoice_roles(workspace): for each party
-- that appears on an invoice, whether it was a sale and whether it was a
-- purchase. «مشتری / تأمین‌کننده» is a filter over the WHOLE list; it was applied
-- after one page had been cut, so a supplier outside that page was missing from
-- the suppliers tab. One grouped row per party lets the list filter first and
-- cut the page afterwards.
--
-- ROLLBACK block is at the bottom of the file.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add column declared_role if it does not exist ───────────────────────
DO $col$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'customers'
       AND column_name = 'declared_role'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN declared_role text NULL;
  END IF;
END
$col$;

-- ─── 2. Add CHECK constraint NOT VALID then VALIDATE ────────────────────────
DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'customers_declared_role_check'
       AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_declared_role_check
      CHECK (declared_role IS NULL OR declared_role IN ('buyer', 'seller', 'both'))
      NOT VALID;
  END IF;
END
$chk$;

ALTER TABLE public.customers VALIDATE CONSTRAINT customers_declared_role_check;

-- ─── 3. Which parties have sold to us, and which have bought from us ────────
-- A missing invoice type is a pre-existing invoice, which was always a sale —
-- the same reading CustomerService.resolveRoles has always used.
-- Read in pages by key (p_after = the last customer_id of the page before):
-- PostgREST caps a response at max-rows, and a business with more parties than
-- that must not lose the ones past the cap without a word.
DROP FUNCTION IF EXISTS public.customer_invoice_roles(uuid);
CREATE OR REPLACE FUNCTION public.customer_invoice_roles(
  p_workspace uuid,
  p_after     uuid DEFAULT NULL,
  p_limit     integer DEFAULT 1000
)
RETURNS TABLE (customer_id uuid, has_sale boolean, has_purchase boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT i.customer_id,
         bool_or(i.type IS DISTINCT FROM 'purchase') AS has_sale,
         -- NULL = 'purchase' is NULL, not false: an untyped invoice must not
         -- leave «has it bought from us» unknown.
         COALESCE(bool_or(i.type = 'purchase'), false) AS has_purchase
    FROM public.invoices i
   WHERE i.workspace_id = p_workspace
     AND i.customer_id IS NOT NULL
     AND (p_after IS NULL OR i.customer_id > p_after)
   GROUP BY i.customer_id
   ORDER BY i.customer_id
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 1000)
$fn$;

REVOKE ALL ON FUNCTION public.customer_invoice_roles(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_invoice_roles(uuid, uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION
--
--   DROP FUNCTION IF EXISTS public.customer_invoice_roles(uuid, uuid, integer);
--   ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_declared_role_check;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS declared_role;
-- ═══════════════════════════════════════════════════════════════════════════
