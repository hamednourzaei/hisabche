-- ============================================================================
-- DEVELOPER PLATFORM 05 — OAuth apps and the marketplace.
-- Additive, idempotent, re-runnable. Requires docs/developer-platform-migration.sql.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-05.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- THE MODEL — no second token system (G2)
--
--   An app is registered by a workspace (its publisher). Another business
--   INSTALLS it through the OAuth 2 authorization-code flow with PKCE; the
--   access token it receives IS an api_keys row with app_id set — so every
--   rule of API keys applies unchanged: the route allowlist, scopes narrowed
--   to what the installer holds, the per-key rate limit, the request log,
--   revocation. Uninstalling an app is revoking that key.
--
-- THE REVIEW POLICY (G4 — an explicit default)
--
--   A new app is PRIVATE: only its own publisher's workspace can install it.
--   It appears in the marketplace for everyone only when a platform admin
--   sets it to 'published'. Nothing is public by default.
--
-- CODES
--
--   An authorization code is 256 random bits, stored as SHA-256, valid for
--   ten minutes, redeemable ONCE — the single use is enforced here, in one
--   statement (redeem_oauth_code), not by the backend reading then writing.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-migration.sql first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.oauth_apps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by          uuid NOT NULL,
  name                text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description         text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  homepage_url        text CHECK (homepage_url IS NULL OR homepage_url ~ '^https://'),
  redirect_uris       text[] NOT NULL CHECK (cardinality(redirect_uris) BETWEEN 1 AND 10),
  requested_scopes    text[] NOT NULL CHECK (cardinality(requested_scopes) > 0),
  client_id           text NOT NULL UNIQUE CHECK (client_id ~ '^hk_app_[0-9a-f]{32}$'),
  client_secret_hash  text NOT NULL CHECK (client_secret_hash ~ '^[0-9a-f]{64}$'),
  status              text NOT NULL DEFAULT 'private'
                      CHECK (status IN ('private', 'in_review', 'published', 'rejected', 'suspended')),
  review_note         text,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_apps_owner_idx ON public.oauth_apps (owner_workspace_id);
CREATE INDEX IF NOT EXISTS oauth_apps_published_idx ON public.oauth_apps (name) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  code_hash       text PRIMARY KEY CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  app_id          uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  scopes          text[] NOT NULL CHECK (cardinality(scopes) > 0),
  redirect_uri    text NOT NULL,
  code_challenge  text NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- An installed app's token is an API key that names its app.
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS app_id uuid REFERENCES public.oauth_apps(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS api_keys_app_idx ON public.api_keys (workspace_id, app_id) WHERE app_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE oauth_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oauth_apps, public.oauth_authorization_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.oauth_apps TO authenticated;
GRANT ALL ON public.oauth_apps, public.oauth_authorization_codes TO service_role;

-- The publisher's owners and managers read their own apps. The marketplace
-- and the consent screen are served by the backend, not read directly.
DROP POLICY IF EXISTS oauth_apps_publisher_read ON oauth_apps;
CREATE POLICY oauth_apps_publisher_read ON oauth_apps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = oauth_apps.owner_workspace_id
       AND m.user_id = auth.uid()
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

-- oauth_authorization_codes: RLS on, NO policy — no client ever reads a code.

-- ─── Redeem a code: once, in one statement ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_oauth_code(
  p_code_hash    text,
  p_app_id       uuid,
  p_redirect_uri text
)
RETURNS TABLE (workspace_id uuid, user_id uuid, scopes text[], code_challenge text)
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.oauth_authorization_codes c
     SET used_at = now()
   WHERE c.code_hash = p_code_hash
     AND c.app_id = p_app_id
     AND c.redirect_uri = p_redirect_uri
     AND c.used_at IS NULL
     AND c.expires_at > now()
  RETURNING c.workspace_id, c.user_id, c.scopes, c.code_challenge;
$$;

REVOKE ALL ON FUNCTION public.redeem_oauth_code(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_oauth_code(text, uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Take every app out of the marketplace, keep installations:
--   UPDATE public.oauth_apps SET status = 'suspended' WHERE status = 'published';
-- Uninstall every app everywhere:
--   UPDATE public.api_keys SET revoked_at = now() WHERE app_id IS NOT NULL AND revoked_at IS NULL;
--
-- Remove entirely (destroys apps and their installations):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.redeem_oauth_code(text, uuid, text);
--   ALTER TABLE public.api_keys DROP COLUMN IF EXISTS app_id;
--   DROP TABLE IF EXISTS public.oauth_authorization_codes;
--   DROP TABLE IF EXISTS public.oauth_apps;
--   COMMIT;
-- ============================================================================
