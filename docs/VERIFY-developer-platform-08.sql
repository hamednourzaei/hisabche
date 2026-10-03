-- ============================================================================
-- docs/VERIFY-developer-platform-08.sql — run AFTER
-- docs/developer-platform-08-migration.sql. Every row must say true. Read-only.
-- ============================================================================

SELECT 'table oauth_refresh_tokens exists' AS check,
       to_regclass('public.oauth_refresh_tokens') IS NOT NULL AS ok
UNION ALL
SELECT 'RLS enabled on oauth_refresh_tokens, with no client policy',
       coalesce((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.oauth_refresh_tokens')), false)
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'oauth_refresh_tokens')
UNION ALL
SELECT 'clients cannot read refresh tokens',
       NOT has_table_privilege('authenticated', 'public.oauth_refresh_tokens', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.oauth_refresh_tokens', 'SELECT')
UNION ALL
SELECT 'a refresh token is stored once (unique hash)',
       EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'oauth_refresh_tokens' AND c.contype = 'u')
UNION ALL
SELECT 'function ' || f || ' exists', to_regprocedure(f) IS NOT NULL
  FROM unnest(ARRAY[
    'public.install_oauth_app_with_refresh(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[], text, integer, integer)',
    'public.rotate_oauth_refresh_token(uuid, text, text, text, text, text[], integer, integer)',
    'public.revoke_oauth_refresh_token(uuid, text)',
    'public.reset_sandbox_workspace(uuid, uuid)'
  ]) AS f
UNION ALL
SELECT 'clients cannot execute ' || f,
       NOT has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')
       AND NOT has_function_privilege('anon', to_regprocedure(f), 'EXECUTE')
  FROM unnest(ARRAY[
    'public.install_oauth_app_with_refresh(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[], text, integer, integer)',
    'public.rotate_oauth_refresh_token(uuid, text, text, text, text, text[], integer, integer)',
    'public.revoke_oauth_refresh_token(uuid, text)',
    'public.reset_sandbox_workspace(uuid, uuid)'
  ]) AS f
UNION ALL
SELECT 'fixed search_path on ' || p.proname,
       coalesce(array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%', false)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('install_oauth_app_with_refresh', 'rotate_oauth_refresh_token',
                     'revoke_oauth_refresh_token', 'reset_sandbox_workspace')
UNION ALL
SELECT 'bucket app-images is public with the 1 MB image limit',
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'app-images' AND public
                AND file_size_limit = 1048576
                AND allowed_mime_types @> ARRAY['image/png', 'image/jpeg', 'image/webp'])
UNION ALL
SELECT 'no retired sandbox still has a member',
       NOT EXISTS (
         SELECT 1 FROM public.workspaces w
           JOIN public.workspace_members m ON m.workspace_id = w.id
          WHERE w.is_sandbox AND w.sandbox_of IS NULL AND w.name LIKE '% (retired %');
