-- docs/VERIFY-retail-ops-01.sql — every row must say ok = true.
SELECT 'repair_tickets exists' AS check_name, to_regclass('public.repair_tickets') IS NOT NULL AS ok
UNION ALL SELECT 'repair_ticket_events exists', to_regclass('public.repair_ticket_events') IS NOT NULL
UNION ALL SELECT 'serial status allows reserved',
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_serials_status_check'
           AND pg_get_constraintdef(oid) LIKE '%reserved%')
UNION ALL SELECT 'serial held-for column exists',
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
           AND table_name = 'stock_serials' AND column_name = 'reserved_for_customer_id')
UNION ALL SELECT 'repair events append-only trigger',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'repair_ticket_events_append_only_trg')
UNION ALL SELECT 'anon cannot read repair_tickets',
  NOT has_table_privilege('anon', 'public.repair_tickets', 'SELECT')
UNION ALL SELECT 'service_role cannot delete repair_tickets',
  NOT has_table_privilege('service_role', 'public.repair_tickets', 'DELETE')
UNION ALL SELECT 'repair_ticket_move closed to anon',
  NOT has_function_privilege('anon', 'public.repair_ticket_move(uuid, uuid, text, text, text, uuid, uuid)', 'EXECUTE');
