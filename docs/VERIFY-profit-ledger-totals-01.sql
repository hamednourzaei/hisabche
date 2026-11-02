-- docs/VERIFY-profit-ledger-totals-01.sql (read-only; one row; every column true). PENDING HUMAN CONFIRMATION until pasted back.
SELECT
  to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)') IS NOT NULL AS function_exists,
  NOT has_function_privilege('authenticated', 'public.accounting_profit_ledger_totals(uuid, date, date)', 'EXECUTE') AS function_private;
