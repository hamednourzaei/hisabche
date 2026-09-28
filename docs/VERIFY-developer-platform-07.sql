-- ============================================================================
-- VERIFY — docs/developer-platform-07-marketplace-migration.sql
-- Read-only. Every row must read ok = true. Until a human reports the result:
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'tables' AS check,
       to_regclass('public.app_publishers') IS NOT NULL
   AND to_regclass('public.app_screenshots') IS NOT NULL
   AND to_regclass('public.oauth_app_webhook_secrets') IS NOT NULL
   AND to_regclass('public.app_versions') IS NOT NULL
   AND to_regclass('public.app_installations') IS NOT NULL
   AND to_regclass('public.app_reviews') IS NOT NULL
   AND to_regclass('public.app_reports') IS NOT NULL AS ok
UNION ALL
SELECT 'listing and draft columns on oauth_apps',
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'oauth_apps'
           AND column_name IN ('slug', 'tagline', 'category', 'icon_url', 'privacy_url', 'terms_url', 'install_url',
                               'pricing_model', 'price_minor', 'price_currency', 'price_interval',
                               'webhook_url', 'webhook_events', 'api_version', 'published_version_id')) = 15
UNION ALL
SELECT 'pricing is minor units, never a float',
       (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'oauth_apps' AND column_name = 'price_minor') = 'bigint'
UNION ALL
SELECT 'rls on every new table',
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relrowsecurity
           AND c.relname IN ('app_publishers', 'app_screenshots', 'oauth_app_webhook_secrets', 'app_versions',
                             'app_installations', 'app_reviews', 'app_reports')) = 7
UNION ALL
SELECT 'clients cannot read secrets or versions, nor write anything',
       NOT has_table_privilege('authenticated', 'public.oauth_app_webhook_secrets', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.oauth_app_webhook_secrets', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.app_versions', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.app_reviews', 'INSERT')
   AND NOT has_table_privilege('authenticated', 'public.app_publishers', 'UPDATE')
   AND NOT has_table_privilege('authenticated', 'public.app_installations', 'INSERT')
UNION ALL
SELECT 'one active installation per business, one open report, one review',
       to_regclass('public.app_installations_one_active') IS NOT NULL
   AND to_regclass('public.app_reports_one_open') IS NOT NULL
   AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_reviews_one_per_business')
UNION ALL
SELECT 'uninstall follows any key revocation; badge follows identity',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'api_keys_end_app_installation_trg' AND NOT tgisinternal)
   AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_publishers_badge_trg' AND NOT tgisinternal)
UNION ALL
SELECT 'every function present and not callable by clients',
       -- CASE, not AND: a missing function must read false, not raise.
       (SELECT bool_and(CASE WHEN to_regprocedure(f) IS NULL THEN false
                             ELSE NOT has_function_privilege('authenticated', f, 'EXECUTE')
                              AND NOT has_function_privilege('anon', f, 'EXECUTE') END)
          FROM unnest(ARRAY[
            'public.submit_app_version(uuid, uuid, text, text)',
            'public.publish_app_version(uuid, uuid, text)',
            'public.reject_app_version(uuid, uuid, text)',
            'public.app_installation_endpoint(uuid, uuid, uuid, text, text[])',
            'public.install_oauth_app(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[])',
            'public.update_app_installation(uuid, uuid, uuid, text[], text, text[])',
            'public.rotate_app_webhook_secret(uuid, text)',
            'public.oauth_app_usage(uuid, integer)',
            'public.oauth_app_stats(uuid, integer)',
            'public.oauth_app_listing_stats(uuid[])'
          ]) AS f);
