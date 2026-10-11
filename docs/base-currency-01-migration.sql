-- ============================================================================
-- base-currency-01-migration.sql — the currency a business keeps its books in
-- (currency audit, phase 1 — .claude/reverse-and-import/01-CURRENCY-AUDIT.md)
--
-- WHY: «base currency» was the literal 'AFN' in the code. A business keeping
-- its books in another currency had nowhere to say so.
--
-- WHAT: one column, workspaces.base_currency, NOT NULL DEFAULT 'AFN'.
--   • Every existing workspace becomes 'AFN' — exactly what the code already
--     assumed for it. No amount, document or balance is touched or relabelled.
--   • The value is three capital letters; which codes the product supports is
--     decided by the application, not frozen into a constraint here.
--
-- Additive, idempotent, re-runnable. The application works before this runs
-- (it answers 'AFN' when the column is absent) and after.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-base-currency-01.sql)
-- ============================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'AFN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'workspaces_base_currency_format'
       AND conrelid = 'public.workspaces'::regclass
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_base_currency_format CHECK (base_currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

COMMENT ON COLUMN public.workspaces.base_currency IS
  'The currency this business keeps its books in. Changeable only while it has no financial documents (enforced by the application).';

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--   The application reads 'AFN' when the column is absent, so removing it is
--   safe ONLY while every workspace still holds 'AFN':
--
--   ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_base_currency_format;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS base_currency;
-- ============================================================================
