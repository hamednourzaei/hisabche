-- ============================================================================
-- WIPE-ALL-BUSINESS-DATA — a clean slate for EVERY business on this database
-- ============================================================================
-- ⚠️ THIS DELETES DATA AND CANNOT BE UNDONE. It is for a database that is not
-- yet in real use. Take a backup first (Supabase → Database → Backups).
--
-- WHAT GOES — for all workspaces: invoices and their lines, payments, the
-- ledger (journal entries and lines), cost layers, stock and stock movements,
-- products, customers and suppliers, employees, payroll, attendance, tills,
-- orders, projects, budgets, bank statements, activities, notifications,
-- audit and event logs, sync queues, imports — every table that carries a
-- `workspace_id` and is not on the KEEP list below, plus the tables that
-- depend on them.
--
-- WHAT STAYS — the accounts themselves: users and profiles, the businesses
-- (workspaces) and who belongs to them, roles and permissions, plans,
-- subscriptions and wallets, API keys and apps, the blog and the site content,
-- and each business's SETTINGS: its chart of accounts, books currency and time
-- zone, tax settings, custom units and custom fields, workflow and automation
-- definitions.
--
-- HOW TO RUN IT
--   1. Run PART 1 alone. It changes nothing: it lists every table that would
--      be emptied and how many rows it has, and every table that stays.
--      Read the list.
--   2. In PART 2, change  'NO'  to  'YES-DELETE-ALL-BUSINESS-DATA'  and run
--      PART 2 alone. It is one transaction: it empties everything or nothing.
--      A SETTINGS table that points at data being emptied (a tax rule for one
--      product, say) is emptied with it — the preview marks those. If an
--      ACCOUNT table (users, businesses, plans, apps, site content) would be
--      touched, it stops, changes nothing, and names the tables.
--   3. Run PART 3 alone and check that every count is 0.
--
-- Not reset: number sequences (the next invoice continues after the last
-- number that was used).
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — PREVIEW (read-only)
-- ════════════════════════════════════════════════════════════════════════════
WITH keep (name) AS (
  SELECT unnest(ARRAY[
    -- who and which business
    'workspaces', 'workspace_members', 'workspace_invites', 'workspace_limit_overrides',
    'workspace_member_module_blocks', 'workspace_role_capabilities', 'profiles',
    'roles', 'role_permissions', 'permissions', 'user_roles', 'password_reset_tokens',
    -- the platform, plans and money owed to the platform
    'subscriptions', 'subscription_events', 'subscription_upgrade_requests',
    'billing_events', 'billing_plans', 'checkout_sessions', 'plan_limit_settings',
    'platform_settings', 'wallets', 'wallet_payment_methods', 'wallet_topup_requests',
    'wallet_transactions', 'referral_codes', 'referral_commissions', 'referral_payouts',
    'referrals', 'schema_migrations', 'metadata', 'currencies', 'units', 'event_types',
    -- developer platform
    'api_keys', 'oauth_apps', 'oauth_app_webhook_secrets', 'oauth_authorization_codes',
    'oauth_refresh_tokens', 'app_installations', 'app_publishers', 'app_releases',
    'app_reports', 'app_reviews', 'app_screenshots', 'app_versions',
    'webhook_endpoints', 'webhook_endpoint_secrets',
    -- each business's settings
    'accounts', 'accounting_dimensions', 'dimension_values', 'dimension_requirements',
    'tax_settings', 'tax_components', 'tax_rules', 'inventory_settings', 'sod_settings',
    'ai_provider_settings', 'ai_pipeline_settings', 'ai_workspace_quota',
    'late_fee_policies', 'storefront_settings', 'seller_profiles',
    'custom_field_definitions', 'custom_units', 'ui_visibility_profiles',
    'business_rules', 'workflows', 'workflow_steps', 'leave_types'
  ])
),
candidates AS (
  SELECT c.oid, c.relname AS name
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind = 'r'
     AND c.relname NOT LIKE 'blog\_%' AND c.relname NOT LIKE 'cms\_%'
     AND EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = c.oid AND a.attname = 'workspace_id' AND NOT a.attisdropped)
     AND c.relname NOT IN (SELECT name FROM keep)
),
closure AS (
  WITH RECURSIVE reach AS (
    SELECT oid FROM candidates
    UNION
    SELECT k.conrelid
      FROM pg_constraint k
      JOIN reach r ON k.confrelid = r.oid
     WHERE k.contype = 'f'
  )
  SELECT c.oid, c.relname AS name FROM reach r JOIN pg_class c ON c.oid = r.oid
)
SELECT CASE
         WHEN x.name IN (SELECT unnest(ARRAY[
    'accounts', 'accounting_dimensions', 'dimension_values', 'dimension_requirements',
    'tax_settings', 'tax_components', 'tax_rules', 'inventory_settings', 'sod_settings',
    'ai_provider_settings', 'ai_pipeline_settings', 'ai_workspace_quota',
    'late_fee_policies', 'storefront_settings', 'seller_profiles',
    'custom_field_definitions', 'custom_units', 'ui_visibility_profiles',
    'business_rules', 'workflows', 'workflow_steps', 'leave_types'
  ])) THEN 'will be emptied (a setting that points at wiped data)'
         WHEN x.name IN (SELECT name FROM keep) OR x.name LIKE 'blog\_%' OR x.name LIKE 'cms\_%'
           THEN '⚠️ ACCOUNT TABLE DEPENDS ON A WIPED TABLE — PART 2 WILL STOP'
         ELSE 'will be emptied'
       END AS what,
       x.name AS "table",
       (xpath('/row/n/text()',
              query_to_xml(format('SELECT count(*) AS n FROM public.%I', x.name), false, true, '')))[1]::text::bigint
         AS rows
  FROM closure x
UNION ALL
SELECT 'stays', c.relname,
       (xpath('/row/n/text()',
              query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text::bigint
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
   AND c.oid NOT IN (SELECT oid FROM closure)
 ORDER BY 1 DESC, 3 DESC, 2;


-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — THE WIPE (one transaction)
-- ════════════════════════════════════════════════════════════════════════════
DO $wipe$
DECLARE
  -- ⬇⬇⬇ Change NO to YES-DELETE-ALL-BUSINESS-DATA to run. ⬇⬇⬇
  v_confirm  constant text := 'NO';
  v_keep     constant text[] := ARRAY[
    'workspaces', 'workspace_members', 'workspace_invites', 'workspace_limit_overrides',
    'workspace_member_module_blocks', 'workspace_role_capabilities', 'profiles',
    'roles', 'role_permissions', 'permissions', 'user_roles', 'password_reset_tokens',
    'subscriptions', 'subscription_events', 'subscription_upgrade_requests',
    'billing_events', 'billing_plans', 'checkout_sessions', 'plan_limit_settings',
    'platform_settings', 'wallets', 'wallet_payment_methods', 'wallet_topup_requests',
    'wallet_transactions', 'referral_codes', 'referral_commissions', 'referral_payouts',
    'referrals', 'schema_migrations', 'metadata', 'currencies', 'units', 'event_types',
    'api_keys', 'oauth_apps', 'oauth_app_webhook_secrets', 'oauth_authorization_codes',
    'oauth_refresh_tokens', 'app_installations', 'app_publishers', 'app_releases',
    'app_reports', 'app_reviews', 'app_screenshots', 'app_versions',
    'webhook_endpoints', 'webhook_endpoint_secrets',
    'accounts', 'accounting_dimensions', 'dimension_values', 'dimension_requirements',
    'tax_settings', 'tax_components', 'tax_rules', 'inventory_settings', 'sod_settings',
    'ai_provider_settings', 'ai_pipeline_settings', 'ai_workspace_quota',
    'late_fee_policies', 'storefront_settings', 'seller_profiles',
    'custom_field_definitions', 'custom_units', 'ui_visibility_profiles',
    'business_rules', 'workflows', 'workflow_steps', 'leave_types'
  ];
  -- Settings: kept when they stand alone, emptied when they point at data
  -- that is going (a rule about a product that no longer exists is not a rule).
  v_settings constant text[] := ARRAY[
    'accounts', 'accounting_dimensions', 'dimension_values', 'dimension_requirements',
    'tax_settings', 'tax_components', 'tax_rules', 'inventory_settings', 'sod_settings',
    'ai_provider_settings', 'ai_pipeline_settings', 'ai_workspace_quota',
    'late_fee_policies', 'storefront_settings', 'seller_profiles',
    'custom_field_definitions', 'custom_units', 'ui_visibility_profiles',
    'business_rules', 'workflows', 'workflow_steps', 'leave_types'
  ];
  v_tables   text[];
  v_blocked  text[];
  v_list     text;
BEGIN
  IF v_confirm <> 'YES-DELETE-ALL-BUSINESS-DATA' THEN
    RAISE EXCEPTION 'Nothing was deleted. To run the wipe, change v_confirm to YES-DELETE-ALL-BUSINESS-DATA.';
  END IF;

  -- Every table that carries a workspace and is not kept, and every table
  -- that depends on one of those (TRUNCATE must take them together).
  WITH RECURSIVE reach AS (
    SELECT c.oid
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind = 'r'
       AND c.relname NOT LIKE 'blog\_%' AND c.relname NOT LIKE 'cms\_%'
       AND EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = c.oid AND a.attname = 'workspace_id' AND NOT a.attisdropped)
       AND c.relname <> ALL (v_keep)
    UNION
    SELECT k.conrelid
      FROM pg_constraint k
      JOIN reach r ON k.confrelid = r.oid
     WHERE k.contype = 'f'
  )
  SELECT array_agg(c.relname ORDER BY c.relname),
         array_agg(c.relname ORDER BY c.relname)
           FILTER (WHERE (c.relname = ANY (v_keep) AND c.relname <> ALL (v_settings))
                      OR c.relname LIKE 'blog\_%' OR c.relname LIKE 'cms\_%'
                      OR c.relnamespace <> 'public'::regnamespace)
    INTO v_tables, v_blocked
    FROM reach r
    JOIN pg_class c ON c.oid = r.oid;

  -- An account table (users, businesses, plans, apps, content) that depends
  -- on a wiped one would be emptied with it. Never: stop, change nothing, say which.
  IF v_blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Nothing was deleted. These account tables depend on tables that would be emptied: %', v_blocked;
  END IF;
  IF v_tables IS NULL THEN
    RAISE NOTICE 'Nothing to empty.';
    RETURN;
  END IF;

  SELECT string_agg(format('public.%I', t), ', ') INTO v_list FROM unnest(v_tables) AS t;
  -- TRUNCATE, not DELETE: the append-only tables (ledger, submissions, device
  -- events) refuse a DELETE by trigger, and this is the one sanctioned reset.
  EXECUTE 'TRUNCATE TABLE ' || v_list;

  RAISE NOTICE 'Emptied % tables: %', array_length(v_tables, 1), v_tables;
END
$wipe$;


-- ════════════════════════════════════════════════════════════════════════════
-- PART 3 — CHECK (read-only): every row should say 0
-- ════════════════════════════════════════════════════════════════════════════
SELECT t.name AS "table",
       CASE WHEN to_regclass('public.' || t.name) IS NULL THEN NULL
            ELSE (xpath('/row/n/text()',
                        query_to_xml(format('SELECT count(*) AS n FROM public.%I', t.name), false, true, '')))[1]::text::bigint
       END AS rows_left
  FROM (VALUES ('invoices'), ('invoice_items'), ('payments'), ('payment_allocations'),
               ('journal_entries'), ('journal_lines'), ('cost_layers'), ('cost_consumptions'),
               ('stock_movements'), ('warehouse_stock'), ('products'), ('warehouses'),
               ('customers'), ('suppliers'), ('employees'), ('payrolls'), ('attendance'),
               ('pos_sessions'), ('pos_cash_movements'), ('activities'), ('branches')) AS t(name)
 ORDER BY 1;
