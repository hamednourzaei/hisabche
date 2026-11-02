-- ============================================================================
-- docs/accounts-role-deferred-and-loss-01-migration.sql
--
-- M5: Account Roles for Deferred Revenue and Inventory Scrap Loss
--
-- Adds account roles:
--   - 'deferred_revenue' (liability): Unearned package revenue recognized upon delivery (M5-1)
--   - 'inventory_loss' (expense): Write-off loss for scrapped returned goods (RG-1)
--
-- RUN ORDER:
--   Run after opening-capital-and-fees-01-migration.sql.
--   Verify with docs/VERIFY-accounts-role-deferred-and-loss-01.sql.
--
-- ROLLBACK:
--   ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
--   ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
--     role IS NULL OR role IN (
--       'bank', 'cash', 'receivable', 'payable', 'tax',
--       'inventory', 'cogs', 'sales', 'purchase',
--       'retained_earnings', 'current_year_earnings',
--       'salary_expense', 'fx_gain_loss', 'owner_capital', 'bank_fees'
--     )
--   );
-- ============================================================================

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
    -- M5: Package Credit Deferred Revenue
    'deferred_revenue',
    -- M5: Returned Goods Write-off Loss
    'inventory_loss'
  )
);
