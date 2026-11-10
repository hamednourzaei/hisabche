-- docs/VERIFY-exchange-01.sql — every row must say ok = true.
SELECT 'fx_settings exists' AS check_name, to_regclass('public.fx_settings') IS NOT NULL AS ok
UNION ALL SELECT 'fx_rate_board exists', to_regclass('public.fx_rate_board') IS NOT NULL
UNION ALL SELECT 'fx_trades exists', to_regclass('public.fx_trades') IS NOT NULL
UNION ALL SELECT 'remittances exists', to_regclass('public.remittances') IS NOT NULL
UNION ALL SELECT 'remittance_events append-only trigger',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'remittance_events_append_only_trg')
UNION ALL SELECT 'trades written only by the function',
  NOT has_table_privilege('service_role', 'public.fx_trades', 'INSERT')
UNION ALL SELECT 'rate board is history (no update)',
  NOT has_table_privilege('service_role', 'public.fx_rate_board', 'UPDATE')
UNION ALL SELECT 'anon cannot read trades',
  NOT has_table_privilege('anon', 'public.fx_trades', 'SELECT')
UNION ALL SELECT 'fx_trade_create closed to anon',
  NOT has_function_privilege('anon', 'public.fx_trade_create(uuid, uuid, jsonb)', 'EXECUTE')
UNION ALL SELECT 'remittance_move closed to authenticated',
  NOT has_function_privilege('authenticated', 'public.remittance_move(uuid, uuid, text, text, text, text, uuid)', 'EXECUTE');
