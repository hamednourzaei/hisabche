-- docs/VERIFY-user-state-01.sql — read-only. Every row must be ok = true.
SELECT 'invoice_drafts exists' AS "check",
       to_regclass('public.invoice_drafts') IS NOT NULL AS ok
UNION ALL
SELECT 'user_preferences exists',
       to_regclass('public.user_preferences') IS NOT NULL
UNION ALL
SELECT 'rls on both',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.invoice_drafts')), false)
       AND COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.user_preferences')), false)
UNION ALL
SELECT 'clients locked out',
       NOT has_table_privilege('anon', 'public.invoice_drafts', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.invoice_drafts', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.user_preferences', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.user_preferences', 'UPDATE')
UNION ALL
SELECT 'backend may manage drafts',
       has_table_privilege('service_role', 'public.invoice_drafts', 'SELECT')
       AND has_table_privilege('service_role', 'public.invoice_drafts', 'INSERT')
       AND has_table_privilege('service_role', 'public.invoice_drafts', 'UPDATE')
       AND has_table_privilege('service_role', 'public.invoice_drafts', 'DELETE')
UNION ALL
SELECT 'backend may set preferences, never delete',
       has_table_privilege('service_role', 'public.user_preferences', 'SELECT')
       AND has_table_privilege('service_role', 'public.user_preferences', 'UPDATE')
       AND NOT has_table_privilege('service_role', 'public.user_preferences', 'DELETE')
UNION ALL
SELECT 'shape checks present',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_drafts_shape')
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_theme');
