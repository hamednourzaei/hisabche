-- ============================================================================
-- docs/VERIFY-goods-marketplace-01.sql — run AFTER
-- docs/goods-marketplace-01-migration.sql. Every row must say true. Read-only.
-- ============================================================================

SELECT 'table ' || t || ' exists' AS check, to_regclass('public.' || t) IS NOT NULL AS ok
  FROM unnest(ARRAY['platform_settings', 'seller_profiles', 'marketplace_listings']) AS t
UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('platform_settings', 'seller_profiles', 'marketplace_listings')
UNION ALL
SELECT 'read policy ' || p, EXISTS (SELECT 1 FROM pg_policies WHERE policyname = p)
  FROM unnest(ARRAY['seller_profiles_workspace_read', 'marketplace_listings_workspace_read']) AS p
UNION ALL
SELECT 'platform_settings has NO client policy',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_settings')
UNION ALL
SELECT 'anon can read none of the three',
       NOT has_table_privilege('anon', 'public.platform_settings', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.seller_profiles', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.marketplace_listings', 'SELECT')
UNION ALL
SELECT 'the switch row exists (its value is the admin''s; default false)',
       EXISTS (SELECT 1 FROM public.platform_settings
                WHERE key = 'goods_marketplace_enabled' AND jsonb_typeof(value) = 'boolean')
UNION ALL
SELECT 'seller slug is unique',
       EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'seller_profiles' AND c.contype = 'u')
UNION ALL
SELECT 'listing slug and product are unique per seller',
       (SELECT count(*) FROM pg_constraint
         WHERE conname IN ('marketplace_listings_slug_key', 'marketplace_listings_product_key')) = 2
UNION ALL
SELECT 'listing price must be positive',
       EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'marketplace_listings' AND c.contype = 'c'
                  AND pg_get_constraintdef(c.oid) ILIKE '%price_minor > 0%')
UNION ALL
SELECT 'no cost or buy price column on listings',
       NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'marketplace_listings'
                      AND (column_name ILIKE '%cost%' OR column_name ILIKE '%buy%'))
UNION ALL
SELECT 'guard trigger on listings',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'marketplace_listings_guard' AND NOT tgisinternal)
UNION ALL
SELECT 'clients cannot execute the guard function',
       NOT has_function_privilege('authenticated', 'public.marketplace_listing_guard()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.marketplace_listing_guard()', 'EXECUTE')
UNION ALL
SELECT 'every listing''s product belongs to its seller',
       NOT EXISTS (SELECT 1 FROM public.marketplace_listings l
                     JOIN public.products p ON p.id = l.product_id
                    WHERE p.workspace_id <> l.workspace_id);
