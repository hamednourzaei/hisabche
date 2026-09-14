-- ============================================================================
-- docs/budget-currency-migration.sql
--
-- A budget can be ENTERED in another currency (USD, PKR, IRR). The ledger —
-- and so every actual a budget is compared with — is in the base currency
-- (AFN), so the control figure `amount_minor` stays in base currency and the
-- entry is kept beside it:
--
--   currency               what the person typed the amount in
--   amount_currency_minor  what they typed, in that currency's minor units
--   fx_rate                base units per 1 unit of `currency`, from the
--                          workspace's own exchange_rates on the period start
--                          (never a later quote, never a guess)
--
-- A budget in AFN has fx_rate NULL and amount_currency_minor = amount_minor.
--
-- EXISTING ROWS (§12): currency 'AFN' — every existing budget was entered and
-- checked in base currency. fx_rate NULL, amount_currency_minor NULL (unknown
-- is not guessed; the service treats NULL as "entered in AFN").
--
-- Depends on: docs/budget-planning-migration.sql
--
-- ROLLBACK / MITIGATION
--   ALTER TABLE public.budgets DROP COLUMN IF EXISTS currency,
--     DROP COLUMN IF EXISTS amount_currency_minor, DROP COLUMN IF EXISTS fx_rate;
-- The backend tolerates the columns being absent (42703): non-AFN budgets are
-- refused with BUDGET_MIGRATION_REQUIRED, AFN budgets keep working.
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS currency              text NOT NULL DEFAULT 'AFN';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS amount_currency_minor bigint;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS fx_rate               numeric(20, 8);

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_currency_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_currency_check
  CHECK (currency IN ('AFN', 'USD', 'PKR', 'IRR'));

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_fx_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_fx_check CHECK (
  (currency = 'AFN' AND fx_rate IS NULL)
  OR (currency <> 'AFN' AND fx_rate > 0 AND amount_currency_minor >= 0)
);

COMMIT;

NOTIFY pgrst, 'reload schema';
