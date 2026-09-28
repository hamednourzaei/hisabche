-- ============================================================================
-- VERIFY — docs/developer-platform-03-commerce-migration.sql
--
-- Read-only. Run in the SQL Editor AFTER the migration. Every row must read
-- ok = true. Paste the result back; until then the status is
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'tables' AS check,
       to_regclass('public.storefront_settings') IS NOT NULL
   AND to_regclass('public.sales_orders') IS NOT NULL
   AND to_regclass('public.sales_order_items') IS NOT NULL AS ok
UNION ALL
SELECT 'api_keys has kind, public_token, allowed_origins',
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'api_keys'
           AND column_name IN ('kind', 'public_token', 'allowed_origins')) = 3
UNION ALL
SELECT 'a secret key can never carry a public token',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_public_token_only_publishable')
   AND NOT EXISTS (SELECT 1 FROM public.api_keys WHERE kind = 'secret' AND public_token IS NOT NULL)
UNION ALL
SELECT 'rls on (3 tables)',
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relrowsecurity
           AND c.relname IN ('storefront_settings', 'sales_orders', 'sales_order_items')) = 3
UNION ALL
SELECT 'policies are SELECT-only and membership-scoped',
       (SELECT bool_and(cmd = 'SELECT' AND qual ILIKE '%workspace_members%')
          FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('storefront_settings', 'sales_orders', 'sales_order_items'))
   AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('storefront_settings', 'sales_orders', 'sales_order_items')) = 3
UNION ALL
SELECT 'clients cannot write orders',
       NOT has_table_privilege('authenticated', 'public.sales_orders', 'INSERT')
   AND NOT has_table_privilege('authenticated', 'public.sales_orders', 'UPDATE')
   AND NOT has_table_privilege('anon', 'public.sales_orders', 'SELECT')
UNION ALL
SELECT 'one order per idempotency key',
       EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sales_orders_idempotency_idx')
UNION ALL
SELECT 'functions present',
       to_regprocedure('public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid)') IS NOT NULL
   AND to_regprocedure('public.transition_sales_order(uuid, uuid, text, text, uuid, uuid)') IS NOT NULL
   AND to_regprocedure('public.expire_pending_sales_orders()') IS NOT NULL
   AND to_regprocedure('public.emit_sales_order_event(uuid, uuid, text)') IS NOT NULL
UNION ALL
SELECT 'clients cannot call them',
       NOT has_function_privilege('authenticated', 'public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.create_sales_order(uuid, text, uuid, text, jsonb, jsonb, uuid)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.transition_sales_order(uuid, uuid, text, text, uuid, uuid)', 'EXECUTE')
UNION ALL
SELECT 'orders follow their invoices',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sales_order_follows_invoice_trg' AND tgenabled <> 'D');
