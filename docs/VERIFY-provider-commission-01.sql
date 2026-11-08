-- ============================================================================
-- docs/VERIFY-provider-commission-01.sql — run AFTER provider-commission-01.
-- Read-only, one row.
-- ============================================================================
SELECT
  to_regclass('public.provider_commission_rates') IS NOT NULL AS table_exists,
  NOT has_table_privilege('anon', 'public.provider_commission_rates', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.provider_commission_rates', 'SELECT')
    AND NOT has_table_privilege('service_role', 'public.provider_commission_rates', 'DELETE')
    AS locked_down,
  (SELECT count(*) FROM public.provider_commission_rates
    WHERE rate_bp NOT BETWEEN 0 AND 10000) = 0 AS rates_in_range,
  (
    to_regclass('public.provider_commission_rates') IS NOT NULL
    AND NOT has_table_privilege('anon', 'public.provider_commission_rates', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.provider_commission_rates', 'SELECT')
    AND NOT has_table_privilege('service_role', 'public.provider_commission_rates', 'DELETE')
  ) AS ok;
