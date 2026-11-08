-- ============================================================================
-- docs/VERIFY-email-otp-01.sql — run AFTER email-otp-01. Read-only, one row.
-- ============================================================================
SELECT
  to_regclass('public.email_otp_codes') IS NOT NULL AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.email_otp_codes')) AS rls_on,
  NOT has_table_privilege('anon', 'public.email_otp_codes', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.email_otp_codes', 'SELECT')
    AND NOT has_table_privilege('service_role', 'public.email_otp_codes', 'UPDATE')
    AND NOT has_table_privilege('service_role', 'public.email_otp_codes', 'DELETE') AS table_locked_down,
  has_function_privilege('service_role', 'public.email_otp_verify(uuid, text, text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.email_otp_verify(uuid, text, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.email_otp_verify(uuid, text, text)', 'EXECUTE')
    AS verifier_service_only,
  (
    to_regclass('public.email_otp_codes') IS NOT NULL
    AND (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.email_otp_codes'))
    AND NOT has_table_privilege('anon', 'public.email_otp_codes', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.email_otp_codes', 'SELECT')
    AND NOT has_table_privilege('service_role', 'public.email_otp_codes', 'UPDATE')
    AND has_function_privilege('service_role', 'public.email_otp_verify(uuid, text, text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.email_otp_verify(uuid, text, text)', 'EXECUTE')
  ) AS ok;
