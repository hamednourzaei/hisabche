-- VERIFY offline-licence-keys-01 — read-only. Every row must say ok = true.
SELECT 'table exists' AS check, to_regclass('public.offline_license_signing_keys') IS NOT NULL AS ok
UNION ALL
SELECT 'rls enabled', relrowsecurity FROM pg_class WHERE oid = 'public.offline_license_signing_keys'::regclass
UNION ALL
SELECT 'anon cannot read', NOT has_table_privilege('anon', 'public.offline_license_signing_keys', 'SELECT')
UNION ALL
SELECT 'authenticated cannot read', NOT has_table_privilege('authenticated', 'public.offline_license_signing_keys', 'SELECT')
UNION ALL
SELECT 'service_role cannot delete', NOT has_table_privilege('service_role', 'public.offline_license_signing_keys', 'DELETE')
UNION ALL
SELECT 'guard trigger', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'offline_license_signing_keys_guard_trg')
UNION ALL
SELECT 'at most one active key', (SELECT count(*) FROM public.offline_license_signing_keys WHERE retired_at IS NULL) <= 1;
