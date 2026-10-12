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

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION
--
--   ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_declared_role_check;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS declared_role;
-- ═══════════════════════════════════════════════════════════════════════════
