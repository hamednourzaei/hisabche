-- ============================================
-- docs/budget-currency-02-any-unit-migration.sql
--
-- V100 Phase 2: Currency & Precious-Metal Neutrality for Budgets
--   Widens `budgets.currency` CHECK and `budgets_fx_check` so any workspace
--   currency or metal unit (e.g., USD, EUR, IRT, AFN, XAU, XAG) works cleanly
--   without assuming AFN as the only unrated base currency.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.budgets
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS amount_currency_minor bigint,
  ADD COLUMN IF NOT EXISTS fx_rate numeric(20, 8);

ALTER TABLE IF EXISTS public.budgets
  DROP CONSTRAINT IF EXISTS budgets_currency_check;

ALTER TABLE IF EXISTS public.budgets
  ADD CONSTRAINT budgets_currency_check
  CHECK (char_length(trim(currency)) BETWEEN 3 AND 8 AND currency = upper(trim(currency)));

ALTER TABLE IF EXISTS public.budgets
  DROP CONSTRAINT IF EXISTS budgets_fx_check;

ALTER TABLE IF EXISTS public.budgets
  ADD CONSTRAINT budgets_fx_check
  CHECK (
    fx_rate IS NULL
    OR (fx_rate > 0 AND (amount_currency_minor IS NULL OR amount_currency_minor >= 0))
  );

COMMIT;

-- Rollback:
-- ALTER TABLE IF EXISTS public.budgets DROP CONSTRAINT IF EXISTS budgets_fx_check;
-- ALTER TABLE IF EXISTS public.budgets DROP CONSTRAINT IF EXISTS budgets_currency_check;
