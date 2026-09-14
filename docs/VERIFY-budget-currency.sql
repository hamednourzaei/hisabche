-- docs/VERIFY-budget-currency.sql — run AFTER budget-currency-migration.sql.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT 'budgets currency columns' AS check,
       COUNT(*) = 3 AS ok
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'budgets'
  AND column_name IN ('currency', 'amount_currency_minor', 'fx_rate')
UNION ALL
SELECT 'currency + fx checks exist',
       (SELECT COUNT(*) FROM pg_constraint
        WHERE conrelid = 'public.budgets'::regclass
          AND conname IN ('budgets_currency_check', 'budgets_fx_check')) = 2
UNION ALL
SELECT 'existing rows are AFN',
       NOT EXISTS (SELECT 1 FROM public.budgets WHERE currency <> 'AFN' AND fx_rate IS NULL);
