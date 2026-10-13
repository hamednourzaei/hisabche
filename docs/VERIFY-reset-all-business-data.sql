-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/WIPE-ALL-BUSINESS-DATA.sql (the reset of all business data)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement. Run it AFTER the wipe and send the output.
--
-- PART 3 of the wipe counts 21 named tables. This asks the wider question: of
-- EVERY table the wipe targets (the same rule, the same KEEP list — a test
-- holds the two lists equal), is anything left?
--
--   · 'business rows left'      ok = true when no targeted table has a row
--   · 'left in: <table>'        one row per table that still has rows (none expected)
--   · 'kept: <table>'           what was NOT to be touched, with its count —
--                               these should be what they were before the wipe
--
-- Running it BEFORE the wipe is harmless and shows what the wipe would empty.
-- ═══════════════════════════════════════════════════════════════════════════

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
),
counted AS (
  SELECT x.name,
         (xpath('/row/n/text()',
                query_to_xml(format('SELECT count(*) AS n FROM public.%I', x.name), false, true, '')))[1]::text::bigint
           AS n
    FROM closure x
)
SELECT 'business rows left' AS name,
       COALESCE(SUM(n), 0) = 0 AS ok,
       COALESCE(SUM(n), 0)::text || ' rows in ' || COUNT(*) FILTER (WHERE n > 0)::text
         || ' of ' || COUNT(*)::text || ' targeted tables' AS detail
  FROM counted
UNION ALL
SELECT 'left in: ' || name, false, n::text || ' rows'
  FROM counted
 WHERE n > 0
UNION ALL
SELECT 'kept: ' || k.name, NULL,
       CASE WHEN to_regclass('public.' || quote_ident(k.name)) IS NULL THEN 'no such table here'
            ELSE (xpath('/row/n/text()',
                        query_to_xml(format('SELECT count(*) AS n FROM public.%I', k.name), false, true, '')))[1]::text
                 || ' rows'
       END
  FROM (VALUES ('workspaces'), ('workspace_members'), ('profiles'), ('roles'),
               ('subscriptions'), ('accounts'), ('api_keys')) AS k (name);
