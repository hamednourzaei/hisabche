-- ==============================================================================
-- docs/VERIFY-admin-secrets-01.sql
--
-- Read-only. Run AFTER docs/admin-secrets-01-migration.sql.
-- Every row must say `pass = true`. Anything else is a finding, not a pass.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ==============================================================================

WITH checks (check_name, pass) AS (
    -- 1. The table exists.
    SELECT 'platform_secrets exists' AS check_name,
           to_regclass('public.platform_secrets') IS NOT NULL AS pass

    UNION ALL

    -- 2. RLS is enabled.
    SELECT 'platform_secrets has RLS',
           COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.platform_secrets')), false)

    UNION ALL

    -- 3. There is no policy (service role only).
    SELECT 'platform_secrets has no policy',
           COALESCE((SELECT count(*) FROM pg_policies
                      WHERE schemaname = 'public' AND tablename = 'platform_secrets'), 0) = 0

    UNION ALL

    -- 4. The index carries no secret material.
    SELECT 'platform_secrets has no value/value_enc column',
           NOT EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'platform_secrets'
                  AND column_name IN ('value', 'secret', 'value_encrypted', 'api_key')
           )

    UNION ALL

    -- 5. All six functions exist and are SECURITY DEFINER.
    SELECT 'six functions exist as SECURITY DEFINER',
           (SELECT count(*) FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('platform_secret_get', 'platform_secret_set',
                                 'platform_secret_stage', 'platform_secret_promote',
                                 'platform_secret_discard', 'platform_secrets_list')
               AND p.prosecdef) = 6

    UNION ALL

    -- 6. anon cannot execute the reader.
    SELECT 'anon cannot execute platform_secret_get',
           NOT COALESCE(has_function_privilege('anon', 'public.platform_secret_get(text)', 'EXECUTE'), false)

    UNION ALL

    -- 7. authenticated cannot execute the reader.
    SELECT 'authenticated cannot execute platform_secret_get',
           NOT COALESCE(has_function_privilege('authenticated', 'public.platform_secret_get(text)', 'EXECUTE'), false)

    UNION ALL

    -- 8. PUBLIC has no execute on the writer (a NULL grantee row means PUBLIC).
    SELECT 'PUBLIC has no execute on platform_secret_set',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p
                CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                WHERE p.oid = 'public.platform_secret_set(text,text,text,uuid,text)'::regprocedure
                  AND a.grantee = 0
                  AND a.privilege_type = 'EXECUTE'
           )

    UNION ALL

    -- 9. service_role CAN execute the reader.
    SELECT 'service_role can execute platform_secret_get',
           COALESCE(has_function_privilege('service_role', 'public.platform_secret_get(text)', 'EXECUTE'), false)

    UNION ALL

    -- 10. Vault exists (informational: the console cannot store a secret without it).
    SELECT 'Supabase Vault installed',
           to_regclass('vault.secrets') IS NOT NULL
)
SELECT check_name, pass FROM checks ORDER BY check_name;

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. Plaintext AI key — run this separately, only where the AI feature exists.
--
--     SELECT count(*) AS plaintext_ai_keys_remaining
--       FROM public.ai_provider_settings
--      WHERE api_key IS NOT NULL AND api_key <> '';
--
--     Expected: 0. A non-zero count means the copy block of the migration has
--     not run and the key is still readable by anyone who can read that table.
-- ──────────────────────────────────────────────────────────────────────────────
