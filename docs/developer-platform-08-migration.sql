-- ============================================================================
-- docs/developer-platform-08-migration.sql                 (3 Oct 2026)
--
-- ⚠️ RUN AFTER developer-platform 01 … 07 (it extends oauth_apps,
--    app_installations, api_keys and the sandbox columns of workspaces).
--
-- THREE THINGS THE DEVELOPER PLATFORM STILL LACKED
--
-- 1. OAUTH REFRESH TOKENS, ROTATED.
--    Until now an app's access token never expired: a token leaked once was
--    valid until someone noticed. From here, an install issues
--       access token   — the same `api_keys` row as before, now with expires_at
--       refresh token  — one row in oauth_refresh_tokens (only its hash)
--    and `grant_type=refresh_token` ROTATES both: the access token's hash is
--    replaced in the SAME api_keys row (so the installation, its scopes and
--    its webhook endpoint are untouched), the presented refresh token is
--    marked used, and a new one in the same family is issued.
--    REUSE = THEFT: a refresh token presented a second time revokes its whole
--    family and the access token (which ends the installation, through the
--    existing api_keys_end_app_installation_trg). RFC 6819 §5.2.2.3.
--    Installs made before this migration keep their non-expiring token.
--
-- 2. A SAFE SANDBOX RESET — «RETIRE AND REPLACE», NOT DELETE.
--    Emptying a workspace means deleting from every tenant table, through
--    append-only ledgers and foreign keys with no cascade: exactly the kind
--    of statement this project forbids. Instead the old sandbox is RETIRED —
--    its keys revoked (which ends its app installations), its webhook
--    endpoints switched off, its members removed, its link to the business
--    cut — and a NEW empty sandbox takes its place. Nothing is deleted; the
--    retired sandbox is simply unreachable. It can only ever be applied to a
--    workspace with is_sandbox = true.
--
-- 3. THE BUCKET for app icons and screenshots (public: the marketplace shows
--    them). png/jpeg/webp, 1 MB. The backend sniffs the bytes and names the
--    object at random; the URL is then stored by the existing columns.
--
-- SAFETY: additive and idempotent. Existing objects touched: none are
-- altered — api_keys rows of NEW installs get an expires_at, by function.
-- Every function: SECURITY INVOKER, fixed search_path, service_role only.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.reset_sandbox_workspace(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.revoke_oauth_refresh_token(uuid, text);
--   DROP FUNCTION IF EXISTS public.rotate_oauth_refresh_token(uuid, text, text, text, text, text[], integer, integer);
--   DROP FUNCTION IF EXISTS public.install_oauth_app_with_refresh(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[], text, integer, integer);
--   DROP TABLE IF EXISTS public.oauth_refresh_tokens;
--   -- then, so tokens already issued do not expire with nothing to renew them:
--   --   UPDATE public.api_keys SET expires_at = NULL WHERE app_id IS NOT NULL AND revoked_at IS NULL;
--   -- Images: empty the bucket in the Storage UI first, then
--   --   DELETE FROM storage.buckets WHERE id = 'app-images';
--   The backend falls back to install_oauth_app (non-expiring token, no
--   refresh token) when the wrapper is absent.
-- ============================================================================

BEGIN;

-- ─── 1. Refresh tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oauth_refresh_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES public.app_installations(id) ON DELETE CASCADE,
  app_id          uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL,
  -- Only the SHA-256 of the token is kept; the token itself is shown once.
  token_hash      text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- Every token descended from one install shares a family.
  family_id       uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  revoked_at      timestamptz
);

CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_family_idx ON public.oauth_refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_installation_idx
  ON public.oauth_refresh_tokens (installation_id);

ALTER TABLE oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
-- No policy: a token hash is nobody's to read from a client.
REVOKE ALL ON public.oauth_refresh_tokens FROM anon, authenticated;
GRANT ALL ON public.oauth_refresh_tokens TO service_role;

-- ─── 2. Install, with an expiring access token and a refresh token ─────────
CREATE OR REPLACE FUNCTION public.install_oauth_app_with_refresh(
  p_app uuid, p_workspace uuid, p_user uuid, p_version uuid,
  p_key_name text, p_prefix text, p_key_hash text, p_scopes text[],
  p_webhook_url text, p_events text[],
  p_refresh_hash text, p_access_seconds integer, p_refresh_seconds integer
)
RETURNS TABLE (installation_id uuid, key_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inst uuid;
  v_key  uuid;
BEGIN
  IF p_access_seconds < 60 OR p_refresh_seconds <= p_access_seconds THEN
    RAISE EXCEPTION 'OAUTH_TOKEN_LIFETIME_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT i.installation_id, i.key_id INTO v_inst, v_key
    FROM public.install_oauth_app(p_app, p_workspace, p_user, p_version, p_key_name, p_prefix,
                                  p_key_hash, p_scopes, p_webhook_url, p_events) AS i;

  UPDATE api_keys SET expires_at = now() + make_interval(secs => p_access_seconds) WHERE id = v_key;

  INSERT INTO oauth_refresh_tokens (installation_id, app_id, workspace_id, token_hash, family_id, expires_at)
  VALUES (v_inst, p_app, p_workspace, p_refresh_hash, gen_random_uuid(),
          now() + make_interval(secs => p_refresh_seconds));

  RETURN QUERY SELECT v_inst, v_key;
END
$$;

-- ─── 3. Rotate ──────────────────────────────────────────────────────────────
-- Returns the workspace and the OLD access-token hash (so the backend can drop
-- it from its cache). Raises:
--   OAUTH_REFRESH_INVALID   unknown, expired, revoked, another app's, or its
--                           installation has ended
--   OAUTH_REFRESH_REUSED    presented a second time — the family is revoked
--                           and the access token with it. The function
--                           RETURNS reused = true rather than raising, so that
--                           revocation is COMMITTED (a raise would undo it).
CREATE OR REPLACE FUNCTION public.rotate_oauth_refresh_token(
  p_app uuid, p_refresh_hash text, p_new_refresh_hash text,
  p_new_prefix text, p_new_key_hash text, p_scopes text[],
  p_access_seconds integer, p_refresh_seconds integer
)
RETURNS TABLE (workspace_id uuid, old_key_hash text, reused boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  t        oauth_refresh_tokens%ROWTYPE;
  i        app_installations%ROWTYPE;
  v_old    text;
BEGIN
  IF p_access_seconds < 60 OR p_refresh_seconds <= p_access_seconds THEN
    RAISE EXCEPTION 'OAUTH_TOKEN_LIFETIME_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO t FROM oauth_refresh_tokens r
   WHERE r.token_hash = p_refresh_hash AND r.app_id = p_app
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OAUTH_REFRESH_INVALID' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO i FROM app_installations a WHERE a.id = t.installation_id FOR UPDATE;

  -- Reuse: someone else holds a copy. Kill the family and the access token.
  IF t.used_at IS NOT NULL THEN
    UPDATE oauth_refresh_tokens SET revoked_at = now()
     WHERE family_id = t.family_id AND revoked_at IS NULL;
    IF i.key_id IS NOT NULL THEN
      -- Ends the installation too (api_keys_end_app_installation_trg).
      UPDATE api_keys SET revoked_at = now() WHERE id = i.key_id AND revoked_at IS NULL
      RETURNING key_hash INTO v_old;
    END IF;
    RETURN QUERY SELECT t.workspace_id, v_old, true;
    RETURN;
  END IF;

  IF t.revoked_at IS NOT NULL OR t.expires_at <= now()
     OR i.status IS DISTINCT FROM 'active' OR i.key_id IS NULL THEN
    RAISE EXCEPTION 'OAUTH_REFRESH_INVALID' USING ERRCODE = 'P0002';
  END IF;
  IF cardinality(p_scopes) = 0 THEN
    RAISE EXCEPTION 'NO_SCOPE_GRANTED' USING ERRCODE = 'check_violation';
  END IF;

  SELECT k.key_hash INTO v_old FROM api_keys k WHERE k.id = i.key_id AND k.revoked_at IS NULL FOR UPDATE;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'OAUTH_REFRESH_INVALID' USING ERRCODE = 'P0002';
  END IF;

  -- The SAME row: the installation, its endpoint and its history stay put.
  UPDATE api_keys
     SET key_hash = p_new_key_hash, prefix = p_new_prefix, scopes = p_scopes,
         expires_at = now() + make_interval(secs => p_access_seconds)
   WHERE id = i.key_id;

  UPDATE oauth_refresh_tokens SET used_at = now() WHERE id = t.id;
  INSERT INTO oauth_refresh_tokens (installation_id, app_id, workspace_id, token_hash, family_id, expires_at)
  VALUES (t.installation_id, t.app_id, t.workspace_id, p_new_refresh_hash, t.family_id,
          now() + make_interval(secs => p_refresh_seconds));

  RETURN QUERY SELECT t.workspace_id, v_old, false;
END
$$;

-- ─── 4. Revoke (RFC 7009) ───────────────────────────────────────────────────
-- The app says «I am done»: the family and the access token go, which ends
-- the installation. Unknown token → nothing happens and nothing is said
-- (the RFC: a revoke of an unknown token still answers 200). Returns the old
-- access-token hash, or NULL.
CREATE OR REPLACE FUNCTION public.revoke_oauth_refresh_token(p_app uuid, p_refresh_hash text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  t     oauth_refresh_tokens%ROWTYPE;
  v_key uuid;
  v_old text;
BEGIN
  SELECT * INTO t FROM oauth_refresh_tokens r
   WHERE r.token_hash = p_refresh_hash AND r.app_id = p_app
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE oauth_refresh_tokens SET revoked_at = now()
   WHERE family_id = t.family_id AND revoked_at IS NULL;

  SELECT a.key_id INTO v_key FROM app_installations a WHERE a.id = t.installation_id;
  IF v_key IS NOT NULL THEN
    UPDATE api_keys SET revoked_at = now() WHERE id = v_key AND revoked_at IS NULL
    RETURNING key_hash INTO v_old;
  END IF;
  RETURN v_old;
END
$$;

-- ─── 5. Sandbox reset: retire and replace ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_sandbox_workspace(p_sandbox uuid, p_user uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old    workspaces%ROWTYPE;
  v_parent workspaces%ROWTYPE;
  v_id     uuid;
  v_name   text;
BEGIN
  SELECT * INTO v_old FROM workspaces w WHERE w.id = p_sandbox FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SANDBOX_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  -- The one rule that makes this safe: never a real business.
  IF v_old.is_sandbox IS NOT TRUE OR v_old.sandbox_of IS NULL THEN
    RAISE EXCEPTION 'SANDBOX_RESET_NOT_A_SANDBOX' USING ERRCODE = 'check_violation';
  END IF;
  IF v_old.owner_id IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'SANDBOX_NOT_MEMBER' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_parent FROM workspaces w WHERE w.id = v_old.sandbox_of FOR UPDATE;

  -- Retire. Revoking the keys ends their app installations (trigger) and so
  -- every refresh token's installation; nothing can call into it afterwards.
  UPDATE api_keys SET revoked_at = now(), revoked_by = p_user
   WHERE workspace_id = p_sandbox AND revoked_at IS NULL;
  UPDATE webhook_endpoints SET is_active = false, disabled_reason = 'sandbox reset', updated_at = now()
   WHERE workspace_id = p_sandbox AND is_active;
  DELETE FROM workspace_members WHERE workspace_id = p_sandbox;
  UPDATE workspaces
     SET sandbox_of = NULL, name = left(v_old.name, 60) || ' (retired ' || to_char(now(), 'YYYY-MM-DD') || ')'
   WHERE workspaces.id = p_sandbox;

  -- Replace: an empty sandbox of the same business, owned by the same person.
  v_name := left(v_parent.name, 80) || ' (sandbox)';
  INSERT INTO workspaces (name, slug, owner_id, is_sandbox, sandbox_of)
  VALUES (v_name,
          v_parent.slug || '-sandbox-' || left(replace(gen_random_uuid()::text, '-', ''), 8),
          p_user, true, v_parent.id)
  RETURNING workspaces.id INTO v_id;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (v_id, p_user, 'owner');

  RETURN QUERY SELECT v_id, v_name;
END
$$;

-- ─── 6. Grants ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.install_oauth_app_with_refresh(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[], text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.install_oauth_app_with_refresh(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[], text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.install_oauth_app_with_refresh(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[], text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.rotate_oauth_refresh_token(uuid, text, text, text, text, text[], integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_oauth_refresh_token(uuid, text, text, text, text, text[], integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_oauth_refresh_token(uuid, text, text, text, text, text[], integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.revoke_oauth_refresh_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_oauth_refresh_token(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_oauth_refresh_token(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.reset_sandbox_workspace(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_sandbox_workspace(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_sandbox_workspace(uuid, uuid) TO service_role;

-- ─── 7. Public bucket for app icons and screenshots ────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app-images', 'app-images', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 1048576,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

COMMIT;

NOTIFY pgrst, 'reload schema';
