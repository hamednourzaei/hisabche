-- ============================================================================
-- docs/customer-advances-01-migration.sql
--
-- P1 (V53 owner decision): an order deposit is a LIABILITY, not revenue.
--
-- The ledger needs a role for «money a customer paid before the sale»:
--   receipt            Dr cash|bank          Cr customer advances
--   applied to invoice Dr customer advances  Cr receivable
--   refund             Dr customer advances  Cr cash|bank
--
-- This migration only widens the account-role check so that role can exist.
-- It creates no account, posts nothing and touches no row: the account itself
-- is created by `ensureAccountsForRoles` with the standard code 2150 when a
-- deposit is first booked (packages/validation/src/schemas/standard-accounts.ts).
--
-- ADDITIVE and IDEMPOTENT: the constraint is dropped and re-added, and every
-- role the previous migration allowed is still allowed. Run
-- docs/VERIFY-customer-advances-01.sql afterwards; «Success. No rows returned»
-- is NOT a pass.
--
-- RUN ORDER:
--   after docs/accounts-role-deferred-and-loss-01-migration.sql.
--
-- ROLLBACK:
--   ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
--   ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
--     role IS NULL OR role IN (
--       'bank', 'cash', 'receivable', 'payable', 'tax',
--       'inventory', 'cogs', 'sales', 'purchase',
--       'retained_earnings', 'current_year_earnings',
--       'salary_expense', 'fx_gain_loss', 'owner_capital', 'bank_fees',
--       'deferred_revenue', 'inventory_loss'
--     )
--   );
--   (Deliberately no data change: an account that already carries the
--   role would block the rollback until a human maps it by hand.)
-- ============================================================================

-- No BEGIN/COMMIT: a script sent as one simple query already runs as a single
-- implicit transaction, and a failure leaves nothing half-applied.

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;

ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
  role IS NULL OR role IN (
    'bank', 'cash', 'receivable', 'payable', 'tax',
    'inventory', 'cogs', 'sales', 'purchase',
    'retained_earnings', 'current_year_earnings',
    'salary_expense',
    'fx_gain_loss',
    'owner_capital',
    'bank_fees',
    'deferred_revenue',
    'inventory_loss',
    -- P1 (V53): money received before the sale.
    'customer_advances'
  )
) NOT VALID;

-- Widening a check cannot invalidate an existing row (every old role is still
-- listed), so VALIDATE is cheap and safe; it still proves that claim.
ALTER TABLE public.accounts VALIDATE CONSTRAINT accounts_role_check;
