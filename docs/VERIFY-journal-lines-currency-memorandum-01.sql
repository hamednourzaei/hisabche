-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.1 (journal_lines FX columns) & B.2.2 (accounts.kind = 'standard' | 'memorandum')

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'journal_lines'
  AND column_name IN ('currency', 'amount_currency_minor', 'exchange_rate')
ORDER BY column_name;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounts'
  AND column_name = 'kind';
