-- VERIFY offline-licence-keys-02 rev2 — read-only. Every row must say ok = true.
-- The private signing key stays in the database and cannot be cleared
-- (owner decision, 9 Nov 2026).
SELECT 'private_key_hex NOT NULL' AS check,
       (SELECT is_nullable = 'NO' FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'offline_license_signing_keys'
           AND column_name = 'private_key_hex') AS ok
UNION ALL
SELECT 'guard revision is rev2',
       obj_description('public.offline_license_signing_keys_guard()'::regprocedure, 'pg_proc') = 'offline-licence-keys-02:rev2'
UNION ALL
SELECT 'guard has no allowance for clearing the private half',
       position('NEW.private_key_hex IS NOT NULL' IN pg_get_functiondef('public.offline_license_signing_keys_guard()'::regprocedure)) = 0
UNION ALL
SELECT 'guard forbids any private_key_hex change',
       position('NEW.private_key_hex IS DISTINCT FROM OLD.private_key_hex' IN pg_get_functiondef('public.offline_license_signing_keys_guard()'::regprocedure)) > 0
UNION ALL
SELECT 'guard trigger present', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'offline_license_signing_keys_guard_trg')
UNION ALL
SELECT 'anon cannot read', NOT has_table_privilege('anon', 'public.offline_license_signing_keys', 'SELECT')
UNION ALL
SELECT 'no row without its private half', NOT EXISTS (SELECT 1 FROM public.offline_license_signing_keys WHERE private_key_hex IS NULL)
UNION ALL
SELECT 'at most one active key', (SELECT count(*) FROM public.offline_license_signing_keys WHERE retired_at IS NULL) <= 1;
