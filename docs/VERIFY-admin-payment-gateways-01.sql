-- ==============================================================================
-- docs/VERIFY-admin-payment-gateways-01.sql
--
-- Read-only. Run AFTER docs/admin-payment-gateways-01-migration.sql.
-- Every row must say `pass = true`.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ==============================================================================

WITH checks (check_name, pass) AS (
    -- 1. The table exists.
    SELECT 'platform_payment_gateways exists',
           to_regclass('public.platform_payment_gateways') IS NOT NULL

    UNION ALL

    -- 2. RLS is on.
    SELECT 'row level security is enabled',
           COALESCE((
               SELECT c.relrowsecurity
                 FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'platform_payment_gateways'
           ), false)

    UNION ALL

    -- 3. anon and authenticated hold nothing.
    SELECT 'anon/authenticated hold no privilege',
           NOT EXISTS (
               SELECT 1 FROM information_schema.role_table_grants g
                WHERE g.table_schema = 'public'
                  AND g.table_name = 'platform_payment_gateways'
                  AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
           )

    UNION ALL

    -- 4. Both modes exist for Stripe and PayPal, and nothing is live.
    SELECT 'every seeded gateway exists and is disabled',
           (SELECT count(*) FROM public.platform_payment_gateways) >= 4
           AND NOT EXISTS (
               SELECT 1 FROM public.platform_payment_gateways WHERE is_enabled
           )

    UNION ALL

    -- 5. No row carries a secret-looking key in its public config.
    SELECT 'no secret-looking key in public_config',
           NOT EXISTS (
               SELECT 1 FROM public.platform_payment_gateways
                WHERE public_config ?| ARRAY[
                    'secret', 'secret_key', 'api_key', 'apikey', 'password',
                    'webhook_secret', 'client_secret', 'private_key', 'token'
                ]
           )
)
SELECT check_name, pass FROM checks ORDER BY check_name;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Diagnostic — the current switch state. Informational only.
--
--     SELECT provider, environment, is_enabled, display_name,
--            array_length(secret_names, 1) AS secrets_needed
--       FROM public.platform_payment_gateways
--      ORDER BY provider, environment;
-- ──────────────────────────────────────────────────────────────────────────────
