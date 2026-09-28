-- ============================================================================
-- DEVELOPER PLATFORM 07 — the app marketplace.
-- Additive, idempotent, re-runnable.
-- Requires docs/developer-platform-02-migration.sql (request log) and
-- docs/developer-platform-05-oauth-migration.sql (OAuth apps).
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-07.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- WHAT IT ADDS, ON TOP OF WHAT EXISTS (G2)
--
--   listing        oauth_apps gains slug, tagline, category, icon, links,
--                  pricing disclosure, and a DRAFT technical config
--                  (webhook url/events, API version) next to the draft
--                  redirect URIs / scopes it already had.
--   publisher      app_publishers — one profile per publishing workspace; the
--                  verified badge is set by a platform admin only, and is
--                  cleared by the database when the name or website changes.
--   screenshots    app_screenshots — at most 8 per app (position 0–7).
--   versions       app_versions — IMMUTABLE snapshots of the draft config
--                  with a changelog. Only a published version reaches other
--                  businesses; the publisher's own workspace tests the draft.
--   installations  app_installations — the lifecycle (active → uninstalled |
--                  replaced) of one app in one business, tying together its
--                  API key, its version and its webhook endpoint.
--   webhooks       an app's webhook subscription becomes an ordinary
--                  webhook_endpoints row in the installer's workspace, signed
--                  with the app's own webhook secret — the existing delivery
--                  worker, retries and replay apply unchanged.
--   reviews        app_reviews — one per installing business, 1–5 stars.
--   reports        app_reports — abuse / security reports, a platform queue.
--   analytics      exact counts from api_request_logs and webhook_deliveries.
--
-- ONE STATEMENT, NOT SEVERAL REQUESTS
--
--   Install, update, uninstall, submitting and publishing a version each
--   touch several tables: each is ONE function here (CLAUDE.md §1.4).
--   Uninstalling is revoking the app's key — a trigger on api_keys ends the
--   installation and removes its webhook endpoint, whichever path revoked it.
--
-- NOT HERE: charging for apps or sharing revenue. Pricing is DISCLOSED only
-- (the publisher bills its customers itself). See the gap analysis.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.oauth_apps') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-05-oauth-migration.sql first.';
  END IF;
  IF to_regclass('public.api_request_logs') IS NULL THEN
    RAISE EXCEPTION 'Run docs/developer-platform-02-migration.sql first.';
  END IF;
END $$;

-- ─── Listing and draft config on the app ────────────────────────────────────

ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '';
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS privacy_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS terms_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS install_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'free';
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS price_minor bigint;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS price_currency text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS price_interval text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS webhook_events text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS api_version text NOT NULL DEFAULT 'v1';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_apps_listing_shape') THEN
    ALTER TABLE public.oauth_apps ADD CONSTRAINT oauth_apps_listing_shape CHECK (
          (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$')
      AND char_length(tagline) <= 120
      AND (category IS NULL OR category IN ('accounting', 'sales', 'inventory', 'ecommerce', 'payments',
                                            'crm', 'hr', 'reporting', 'communication', 'productivity', 'other'))
      AND (icon_url IS NULL OR (icon_url ~ '^https://' AND char_length(icon_url) <= 1000))
      AND (privacy_url IS NULL OR (privacy_url ~ '^https://' AND char_length(privacy_url) <= 1000))
      AND (terms_url IS NULL OR (terms_url ~ '^https://' AND char_length(terms_url) <= 1000))
      AND (install_url IS NULL OR (install_url ~ '^https://' AND char_length(install_url) <= 1000))
      AND (webhook_url IS NULL OR (webhook_url ~ '^https://' AND char_length(webhook_url) <= 2000))
      AND api_version IN ('v1')
    );
  END IF;
  -- Money in minor units, never a float; free has no price, paid has all of it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_apps_pricing_shape') THEN
    ALTER TABLE public.oauth_apps ADD CONSTRAINT oauth_apps_pricing_shape CHECK (
         (pricing_model = 'free' AND price_minor IS NULL AND price_currency IS NULL AND price_interval IS NULL)
      OR (pricing_model = 'paid' AND price_minor IS NOT NULL AND price_minor > 0
          AND price_currency ~ '^[A-Z]{3}$' AND price_interval IN ('month', 'year', 'one_time'))
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS oauth_apps_slug_idx ON public.oauth_apps (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS oauth_apps_category_idx ON public.oauth_apps (category) WHERE status = 'published';

-- ─── Publisher profile ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_publishers (
  workspace_id  uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  website_url   text CHECK (website_url IS NULL OR (website_url ~ '^https://' AND char_length(website_url) <= 1000)),
  support_email text CHECK (support_email IS NULL OR (support_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                                                      AND char_length(support_email) <= 200)),
  bio           text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  verified_at   timestamptz,
  verified_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- A badge vouches for a name and a website. Change either, and it is gone
-- until an admin looks again — unless the same statement sets it (the admin).
CREATE OR REPLACE FUNCTION public.app_publishers_badge_follows_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.display_name IS DISTINCT FROM OLD.display_name OR NEW.website_url IS DISTINCT FROM OLD.website_url)
     AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at THEN
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_publishers_badge_trg ON public.app_publishers;
CREATE TRIGGER app_publishers_badge_trg
  BEFORE UPDATE ON public.app_publishers
  FOR EACH ROW EXECUTE FUNCTION public.app_publishers_badge_follows_identity();

-- ─── Screenshots ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_screenshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id     uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  url        text NOT NULL CHECK (url ~ '^https://' AND char_length(url) <= 1000),
  caption    text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 200),
  position   smallint NOT NULL CHECK (position BETWEEN 0 AND 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_screenshots_position_once UNIQUE (app_id, position)
);

-- ─── The app's webhook signing secret ───────────────────────────────────────
-- Every endpoint an installation creates is signed with it, so the app
-- verifies one secret for every business that installed it.

CREATE TABLE IF NOT EXISTS public.oauth_app_webhook_secrets (
  app_id     uuid PRIMARY KEY REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  secret     text NOT NULL CHECK (char_length(secret) >= 32),
  rotated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Versions ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  version          text NOT NULL CHECK (version ~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'),
  changelog        text NOT NULL CHECK (char_length(changelog) BETWEEN 1 AND 5000),
  redirect_uris    text[] NOT NULL,
  requested_scopes text[] NOT NULL CHECK (cardinality(requested_scopes) > 0),
  webhook_url      text,
  webhook_events   text[] NOT NULL DEFAULT '{}',
  api_version      text NOT NULL,
  status           text NOT NULL DEFAULT 'in_review'
                   CHECK (status IN ('in_review', 'published', 'rejected', 'superseded')),
  review_note      text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  created_by       uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  published_at     timestamptz,
  CONSTRAINT app_versions_once UNIQUE (app_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_versions_one_in_review ON public.app_versions (app_id) WHERE status = 'in_review';
CREATE UNIQUE INDEX IF NOT EXISTS app_versions_one_published ON public.app_versions (app_id) WHERE status = 'published';

ALTER TABLE public.oauth_apps ADD COLUMN IF NOT EXISTS published_version_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_apps_published_version_fkey') THEN
    ALTER TABLE public.oauth_apps
      ADD CONSTRAINT oauth_apps_published_version_fkey
      FOREIGN KEY (published_version_id) REFERENCES public.app_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Installations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_installations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id       uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_id       uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  -- NULL = the publisher's own test install of the draft.
  version_id   uuid REFERENCES public.app_versions(id) ON DELETE SET NULL,
  endpoint_id  uuid REFERENCES public.webhook_endpoints(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'uninstalled', 'replaced')),
  installed_by uuid NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  ended_by     uuid,
  CONSTRAINT app_installations_end_shape CHECK ((status = 'active') = (ended_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS app_installations_one_active
  ON public.app_installations (app_id, workspace_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS app_installations_workspace_idx ON public.app_installations (workspace_id, installed_at DESC);
CREATE INDEX IF NOT EXISTS app_installations_key_idx ON public.app_installations (key_id) WHERE status = 'active';

-- ─── Reviews and reports ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  hidden_at     timestamptz,
  hidden_by     uuid,
  hidden_reason text CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_reviews_one_per_business UNIQUE (app_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS app_reviews_app_idx ON public.app_reviews (app_id, created_at DESC) WHERE hidden_at IS NULL;

CREATE TABLE IF NOT EXISTS public.app_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          uuid NOT NULL REFERENCES public.oauth_apps(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  reason          text NOT NULL CHECK (reason IN ('security', 'data_misuse', 'misleading', 'broken', 'spam', 'other')),
  details         text NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000),
  resolved_by     uuid,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One open report per business and app: a second click is the same report.
CREATE UNIQUE INDEX IF NOT EXISTS app_reports_one_open
  ON public.app_reports (app_id, workspace_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS app_reports_queue_idx ON public.app_reports (created_at) WHERE status = 'open';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Every read and write goes through the backend. Tables with a workspace
-- column get a members-read policy (defence in depth); the rest none.

ALTER TABLE app_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_app_webhook_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_publishers, public.app_screenshots, public.oauth_app_webhook_secrets,
              public.app_versions, public.app_installations, public.app_reviews, public.app_reports
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.app_publishers, public.app_installations, public.app_reviews, public.app_reports
  TO authenticated;
GRANT ALL ON public.app_publishers, public.app_screenshots, public.oauth_app_webhook_secrets,
             public.app_versions, public.app_installations, public.app_reviews, public.app_reports
  TO service_role;

DROP POLICY IF EXISTS app_publishers_member_read ON app_publishers;
CREATE POLICY app_publishers_member_read ON app_publishers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_publishers.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS app_installations_member_read ON app_installations;
CREATE POLICY app_installations_member_read ON app_installations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_installations.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL
                    AND m.role IN ('owner', 'admin', 'manager')));

DROP POLICY IF EXISTS app_reviews_member_read ON app_reviews;
CREATE POLICY app_reviews_member_read ON app_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_reviews.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

DROP POLICY IF EXISTS app_reports_member_read ON app_reports;
CREATE POLICY app_reports_member_read ON app_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = app_reports.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

-- ─── Versions: submit, publish, reject ──────────────────────────────────────

-- Snapshot the app's draft as a new version, for review. The draft is read
-- HERE, so what is reviewed is exactly what was stored.
CREATE OR REPLACE FUNCTION public.submit_app_version(p_app uuid, p_user uuid, p_version text, p_changelog text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  a    public.oauth_apps%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO a FROM public.oauth_apps WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APP_NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  IF a.status = 'suspended' THEN RAISE EXCEPTION 'APP_SUSPENDED' USING ERRCODE = 'check_violation'; END IF;
  IF a.slug IS NULL OR a.category IS NULL OR a.tagline = '' THEN
    RAISE EXCEPTION 'LISTING_INCOMPLETE' USING ERRCODE = 'check_violation';
  END IF;
  IF cardinality(a.webhook_events) > 0 AND (a.webhook_url IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.oauth_app_webhook_secrets s WHERE s.app_id = p_app)) THEN
    RAISE EXCEPTION 'WEBHOOK_INCOMPLETE' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_versions v WHERE v.app_id = p_app AND v.status = 'in_review') THEN
    RAISE EXCEPTION 'VERSION_IN_REVIEW' USING ERRCODE = 'unique_violation';
  END IF;
  IF p_version !~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$' THEN
    RAISE EXCEPTION 'VERSION_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_versions v
              WHERE v.app_id = p_app
                AND string_to_array(v.version, '.')::int[] >= string_to_array(p_version, '.')::int[]) THEN
    RAISE EXCEPTION 'VERSION_NOT_NEWER' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.app_versions
    (app_id, version, changelog, redirect_uris, requested_scopes, webhook_url, webhook_events, api_version, created_by)
  VALUES
    (p_app, p_version, p_changelog, a.redirect_uris, a.requested_scopes,
     CASE WHEN cardinality(a.webhook_events) > 0 THEN a.webhook_url END, a.webhook_events, a.api_version, p_user)
  RETURNING id INTO v_id;

  IF a.status IN ('private', 'rejected') THEN
    UPDATE public.oauth_apps SET status = 'in_review', updated_at = now() WHERE id = p_app;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_app_version(p_version uuid, p_admin uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v public.app_versions%ROWTYPE;
  a public.oauth_apps%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.app_versions WHERE id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  SELECT * INTO a FROM public.oauth_apps WHERE id = v.app_id FOR UPDATE;
  IF v.status <> 'in_review' THEN RAISE EXCEPTION 'VERSION_NOT_IN_REVIEW' USING ERRCODE = 'check_violation'; END IF;
  IF a.status = 'suspended' THEN RAISE EXCEPTION 'APP_SUSPENDED' USING ERRCODE = 'check_violation'; END IF;
  -- http://localhost is for the publisher's own testing; never for everyone.
  IF EXISTS (SELECT 1 FROM unnest(v.redirect_uris) u WHERE u !~ '^https://') THEN
    RAISE EXCEPTION 'VERSION_HAS_LOCALHOST' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.app_versions SET status = 'superseded'
   WHERE app_id = v.app_id AND status = 'published';
  UPDATE public.app_versions
     SET status = 'published', published_at = now(), reviewed_by = p_admin, reviewed_at = now(), review_note = p_note
   WHERE id = p_version;
  UPDATE public.oauth_apps
     SET published_version_id = p_version, status = 'published', review_note = p_note,
         reviewed_by = p_admin, reviewed_at = now(), updated_at = now()
   WHERE id = v.app_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_app_version(p_version uuid, p_admin uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v public.app_versions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.app_versions WHERE id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  IF v.status <> 'in_review' THEN RAISE EXCEPTION 'VERSION_NOT_IN_REVIEW' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.app_versions
     SET status = 'rejected', reviewed_by = p_admin, reviewed_at = now(), review_note = p_note
   WHERE id = p_version;
  -- An app with a live version stays live; only a never-published one is «rejected».
  UPDATE public.oauth_apps
     SET status = CASE WHEN published_version_id IS NULL AND status <> 'suspended' THEN 'rejected' ELSE status END,
         review_note = p_note, updated_at = now()
   WHERE id = v.app_id;
END;
$$;

-- ─── Installations: install, update, uninstall ──────────────────────────────

-- The app's webhook endpoint in the installer's workspace, signed with the
-- app's secret. Internal: called by install and update only.
CREATE OR REPLACE FUNCTION public.app_installation_endpoint(
  p_app uuid, p_workspace uuid, p_user uuid, p_url text, p_events text[]
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_endpoint uuid;
  v_secret   text;
  v_name     text;
BEGIN
  SELECT s.secret INTO v_secret FROM public.oauth_app_webhook_secrets s WHERE s.app_id = p_app;
  IF v_secret IS NULL THEN RAISE EXCEPTION 'WEBHOOK_INCOMPLETE' USING ERRCODE = 'check_violation'; END IF;
  SELECT left(a.name, 190) INTO v_name FROM public.oauth_apps a WHERE a.id = p_app;
  INSERT INTO public.webhook_endpoints (workspace_id, created_by, url, description, events)
  VALUES (p_workspace, p_user, p_url, 'App: ' || v_name, p_events)
  RETURNING id INTO v_endpoint;
  INSERT INTO public.webhook_endpoint_secrets (endpoint_id, secret) VALUES (v_endpoint, v_secret);
  RETURN v_endpoint;
END;
$$;

CREATE OR REPLACE FUNCTION public.install_oauth_app(
  p_app uuid, p_workspace uuid, p_user uuid, p_version uuid,
  p_key_name text, p_prefix text, p_key_hash text, p_scopes text[],
  p_webhook_url text, p_events text[]
)
RETURNS TABLE (installation_id uuid, key_id uuid)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old        public.app_installations%ROWTYPE;
  v_key      uuid;
  v_endpoint uuid;
  v_inst     uuid;
BEGIN
  -- Installing again (the app asked for a fresh token) replaces the old
  -- installation: its token stops working and its endpoint goes.
  SELECT * INTO old FROM public.app_installations i
   WHERE i.app_id = p_app AND i.workspace_id = p_workspace AND i.status = 'active'
   FOR UPDATE;
  IF FOUND THEN
    UPDATE public.app_installations
       SET status = 'replaced', ended_at = now(), ended_by = p_user, updated_at = now()
     WHERE id = old.id;
    IF old.endpoint_id IS NOT NULL THEN DELETE FROM public.webhook_endpoints WHERE id = old.endpoint_id; END IF;
    IF old.key_id IS NOT NULL THEN
      UPDATE public.api_keys SET revoked_at = now(), revoked_by = p_user
       WHERE id = old.key_id AND revoked_at IS NULL;
    END IF;
  END IF;

  INSERT INTO public.api_keys (workspace_id, created_by, name, prefix, key_hash, scopes, expires_at, app_id)
  VALUES (p_workspace, p_user, p_key_name, p_prefix, p_key_hash, p_scopes, NULL, p_app)
  RETURNING id INTO v_key;

  IF p_webhook_url IS NOT NULL AND cardinality(p_events) > 0 THEN
    v_endpoint := public.app_installation_endpoint(p_app, p_workspace, p_user, p_webhook_url, p_events);
  END IF;

  INSERT INTO public.app_installations (app_id, workspace_id, key_id, version_id, endpoint_id, installed_by)
  VALUES (p_app, p_workspace, v_key, p_version, v_endpoint, p_user)
  RETURNING id INTO v_inst;

  RETURN QUERY SELECT v_inst, v_key;
END;
$$;

-- Move an installation to a newer version, with the scopes the installer
-- approved (already narrowed to what they hold, by the backend).
CREATE OR REPLACE FUNCTION public.update_app_installation(
  p_installation uuid, p_user uuid, p_version uuid, p_scopes text[], p_webhook_url text, p_events text[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  i public.app_installations%ROWTYPE;
  v_endpoint uuid;
BEGIN
  SELECT * INTO i FROM public.app_installations WHERE id = p_installation FOR UPDATE;
  IF NOT FOUND OR i.status <> 'active' THEN
    RAISE EXCEPTION 'INSTALLATION_NOT_ACTIVE' USING ERRCODE = 'no_data_found';
  END IF;
  IF cardinality(p_scopes) = 0 THEN RAISE EXCEPTION 'NO_SCOPE_GRANTED' USING ERRCODE = 'check_violation'; END IF;

  UPDATE public.api_keys SET scopes = p_scopes WHERE id = i.key_id AND revoked_at IS NULL;

  v_endpoint := i.endpoint_id;
  IF p_webhook_url IS NULL OR cardinality(p_events) = 0 THEN
    IF v_endpoint IS NOT NULL THEN DELETE FROM public.webhook_endpoints WHERE id = v_endpoint; END IF;
    v_endpoint := NULL;
  ELSIF v_endpoint IS NULL THEN
    v_endpoint := public.app_installation_endpoint(i.app_id, i.workspace_id, p_user, p_webhook_url, p_events);
  ELSE
    UPDATE public.webhook_endpoints SET url = p_webhook_url, events = p_events, updated_at = now()
     WHERE id = v_endpoint;
  END IF;

  UPDATE public.app_installations
     SET version_id = p_version, endpoint_id = v_endpoint, updated_at = now()
   WHERE id = p_installation;
END;
$$;

-- Uninstall = revoke the app's key, from ANY path (the installed-apps list,
-- the API keys list, an admin revoking every installation of an app).
CREATE OR REPLACE FUNCTION public.app_installations_end_on_revoke()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_endpoint uuid;
BEGIN
  IF NEW.app_id IS NOT NULL AND NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    UPDATE public.app_installations
       SET status = 'uninstalled', ended_at = now(), ended_by = NEW.revoked_by, updated_at = now()
     WHERE key_id = NEW.id AND status = 'active'
    RETURNING endpoint_id INTO v_endpoint;
    IF v_endpoint IS NOT NULL THEN DELETE FROM public.webhook_endpoints WHERE id = v_endpoint; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_keys_end_app_installation_trg ON public.api_keys;
CREATE TRIGGER api_keys_end_app_installation_trg
  AFTER UPDATE OF revoked_at ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.app_installations_end_on_revoke();

-- New app webhook secret: every active installation's endpoint follows at once.
CREATE OR REPLACE FUNCTION public.rotate_app_webhook_secret(p_app uuid, p_secret text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.oauth_app_webhook_secrets (app_id, secret) VALUES (p_app, p_secret)
  ON CONFLICT (app_id) DO UPDATE SET secret = EXCLUDED.secret, rotated_at = now();
  UPDATE public.webhook_endpoint_secrets s
     SET secret = p_secret, rotated_at = now()
    FROM public.app_installations i
   WHERE i.app_id = p_app AND i.status = 'active' AND s.endpoint_id = i.endpoint_id;
END;
$$;

-- ─── Numbers: exact counts, never a sample or an estimate ───────────────────

CREATE OR REPLACE FUNCTION public.oauth_app_usage(p_app uuid, p_days integer)
RETURNS TABLE (day date, requests bigint, client_errors bigint, server_errors bigint, avg_ms integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (l.created_at AT TIME ZONE 'UTC')::date AS day,
         count(*),
         count(*) FILTER (WHERE l.status BETWEEN 400 AND 499),
         count(*) FILTER (WHERE l.status >= 500),
         round(avg(l.duration_ms))::integer
    FROM public.api_request_logs l
    JOIN public.api_keys k ON k.id = l.key_id
   WHERE k.app_id = p_app
     AND l.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 30))
   GROUP BY 1
   ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.oauth_app_stats(p_app uuid, p_days integer)
RETURNS TABLE (
  active_installs bigint, installs_in_period bigint, uninstalls_in_period bigint,
  requests_24h bigint, server_errors_24h bigint,
  deliveries_24h bigint, failed_deliveries_24h bigint, last_request_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.app_installations i WHERE i.app_id = p_app AND i.status = 'active'),
    (SELECT count(*) FROM public.app_installations i
      WHERE i.app_id = p_app AND i.installed_at >= now() - make_interval(days => least(greatest(p_days, 1), 365))),
    (SELECT count(*) FROM public.app_installations i
      WHERE i.app_id = p_app AND i.status = 'uninstalled'
        AND i.ended_at >= now() - make_interval(days => least(greatest(p_days, 1), 365))),
    (SELECT count(*) FROM public.api_request_logs l JOIN public.api_keys k ON k.id = l.key_id
      WHERE k.app_id = p_app AND l.created_at >= now() - interval '24 hours'),
    (SELECT count(*) FROM public.api_request_logs l JOIN public.api_keys k ON k.id = l.key_id
      WHERE k.app_id = p_app AND l.status >= 500 AND l.created_at >= now() - interval '24 hours'),
    (SELECT count(*) FROM public.webhook_deliveries d JOIN public.app_installations i ON i.endpoint_id = d.endpoint_id
      WHERE i.app_id = p_app AND d.status IN ('succeeded', 'failed') AND d.created_at >= now() - interval '24 hours'),
    (SELECT count(*) FROM public.webhook_deliveries d JOIN public.app_installations i ON i.endpoint_id = d.endpoint_id
      WHERE i.app_id = p_app AND d.status = 'failed' AND d.created_at >= now() - interval '24 hours'),
    (SELECT max(k.last_used_at) FROM public.api_keys k WHERE k.app_id = p_app);
$$;

-- For the marketplace list: visible reviews and active installs, per app.
CREATE OR REPLACE FUNCTION public.oauth_app_listing_stats(p_apps uuid[])
RETURNS TABLE (app_id uuid, reviews bigint, average numeric, stars bigint[], active_installs bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id,
         count(r.id),
         round(avg(r.rating), 2),
         ARRAY[count(*) FILTER (WHERE r.rating = 1), count(*) FILTER (WHERE r.rating = 2),
               count(*) FILTER (WHERE r.rating = 3), count(*) FILTER (WHERE r.rating = 4),
               count(*) FILTER (WHERE r.rating = 5)],
         (SELECT count(*) FROM public.app_installations i WHERE i.app_id = a.id AND i.status = 'active')
    FROM unnest(p_apps) AS a(id)
    LEFT JOIN public.app_reviews r ON r.app_id = a.id AND r.hidden_at IS NULL
   GROUP BY a.id;
$$;

REVOKE ALL ON FUNCTION public.submit_app_version(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_app_version(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_app_version(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_installation_endpoint(uuid, uuid, uuid, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.install_oauth_app(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_app_installation(uuid, uuid, uuid, text[], text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_app_webhook_secret(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oauth_app_usage(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oauth_app_stats(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oauth_app_listing_stats(uuid[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_app_version(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_app_version(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_app_version(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_installation_endpoint(uuid, uuid, uuid, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.install_oauth_app(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_app_installation(uuid, uuid, uuid, text[], text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_app_webhook_secret(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oauth_app_usage(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oauth_app_stats(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oauth_app_listing_stats(uuid[]) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Take the marketplace down without touching installations:
--   UPDATE public.oauth_apps SET status = 'suspended' WHERE status = 'published';
-- Uninstall one app everywhere (the trigger ends installations, removes endpoints):
--   UPDATE public.api_keys SET revoked_at = now() WHERE app_id = '<app id>' AND revoked_at IS NULL;
--
-- Remove entirely (destroys listings, versions, reviews, reports and the
-- installation history; app tokens keep working as plain app keys):
--   BEGIN;
--   DROP TRIGGER IF EXISTS api_keys_end_app_installation_trg ON public.api_keys;
--   DROP FUNCTION IF EXISTS public.app_installations_end_on_revoke();
--   DROP FUNCTION IF EXISTS public.oauth_app_listing_stats(uuid[]);
--   DROP FUNCTION IF EXISTS public.oauth_app_stats(uuid, integer);
--   DROP FUNCTION IF EXISTS public.oauth_app_usage(uuid, integer);
--   DROP FUNCTION IF EXISTS public.rotate_app_webhook_secret(uuid, text);
--   DROP FUNCTION IF EXISTS public.update_app_installation(uuid, uuid, uuid, text[], text, text[]);
--   DROP FUNCTION IF EXISTS public.install_oauth_app(uuid, uuid, uuid, uuid, text, text, text, text[], text, text[]);
--   DROP FUNCTION IF EXISTS public.app_installation_endpoint(uuid, uuid, uuid, text, text[]);
--   DROP FUNCTION IF EXISTS public.reject_app_version(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.publish_app_version(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.submit_app_version(uuid, uuid, text, text);
--   ALTER TABLE public.oauth_apps DROP CONSTRAINT IF EXISTS oauth_apps_published_version_fkey;
--   DROP TABLE IF EXISTS public.app_reports, public.app_reviews, public.app_installations,
--                        public.app_versions, public.oauth_app_webhook_secrets,
--                        public.app_screenshots, public.app_publishers;
--   DROP FUNCTION IF EXISTS public.app_publishers_badge_follows_identity();
--   ALTER TABLE public.oauth_apps DROP CONSTRAINT IF EXISTS oauth_apps_listing_shape,
--                                  DROP CONSTRAINT IF EXISTS oauth_apps_pricing_shape;
--   ALTER TABLE public.oauth_apps DROP COLUMN IF EXISTS published_version_id, DROP COLUMN IF EXISTS slug,
--     DROP COLUMN IF EXISTS tagline, DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS icon_url,
--     DROP COLUMN IF EXISTS privacy_url, DROP COLUMN IF EXISTS terms_url, DROP COLUMN IF EXISTS install_url,
--     DROP COLUMN IF EXISTS pricing_model, DROP COLUMN IF EXISTS price_minor, DROP COLUMN IF EXISTS price_currency,
--     DROP COLUMN IF EXISTS price_interval, DROP COLUMN IF EXISTS webhook_url, DROP COLUMN IF EXISTS webhook_events,
--     DROP COLUMN IF EXISTS api_version;
--   COMMIT;
-- ============================================================================
