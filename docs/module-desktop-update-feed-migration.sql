-- ============================================================================
-- DESKTOP UPDATE FEED — the table `GET /api/updates/:platform/latest.yml` reads
--
-- WHAT THIS IS FOR
--
-- The desktop application checks this backend for a newer version. The route
-- builds electron-updater's manifest from the newest published row here; the
-- binary itself lives wherever it was uploaded and `download_url` points at it.
--
-- ----------------------------------------------------------------------------
-- ⚠️ THIS TABLE HAS NO `workspace_id`, AND THAT IS CORRECT
--
-- Every other table in this database is tenant data and `workspace_id` is the
-- only security boundary. A RELEASE is not tenant data: it is the same file for
-- every customer, and its version number is on the download page. Adding a
-- workspace column would imply per-customer builds, which do not exist.
--
-- Reading is therefore public — the updater runs before anyone signs in.
-- WRITING is not: RLS below denies it to every ordinary client, so a release
-- can only be published by the service role.
--
-- ----------------------------------------------------------------------------
-- ⚠️ sha512 IS THE SECURITY BOUNDARY
--
-- electron-updater verifies the downloaded file against this hash before it
-- will run it. A compromised file host therefore cannot ship a binary this
-- database did not vouch for — but only if the hash is the one from the
-- artifact that was actually built. It is NOT NULL for that reason: a release
-- row without it would be refused by every client anyway, and a row that
-- cannot work should not be insertable.
--
-- Get it from the `latest.yml` electron-builder writes beside the installer.
--
-- ----------------------------------------------------------------------------
-- ADDITIVE AND RE-RUNNABLE
--
-- Creates one table and its policies. Touches nothing that exists. Running it
-- twice changes nothing.
--
-- ----------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- The application is schema-tolerant: `latestRelease()` treats a missing table
-- (42P01 / PGRST205) as «no releases yet» and the updater reports no update.
-- So the code is safe to deploy before this runs, and safe after it is undone.
--
-- To undo:
--     DROP TABLE IF EXISTS public.app_releases;
--
-- To withdraw a bad release without deleting its history:
--     UPDATE public.app_releases SET is_published = false
--      WHERE platform = 'win' AND version = '<version>';
--
-- Clients that already downloaded it are unaffected — this only stops it being
-- offered. There is no rollback of an installed update; ship a higher version.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_releases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'win' | 'mac' | 'linux'. Checked by the route as well; the constraint is
  -- here so a typo cannot become a release nobody can find.
  platform      text        NOT NULL CHECK (platform IN ('win', 'mac', 'linux')),

  -- Semver, exactly as `package.json` carried it at build time. electron-updater
  -- compares it against the running version, so two releases sharing a version
  -- are invisible to it.
  version       text        NOT NULL,

  -- The installer's file name, e.g. 'Hisabche-1.2.0-setup.exe'. The download
  -- route refuses any other name, so this must match what was uploaded.
  file_name     text        NOT NULL,
  file_size     bigint      NOT NULL CHECK (file_size > 0),

  -- Base64 sha512 from the generated `latest.yml`. See above.
  sha512        text        NOT NULL CHECK (length(sha512) > 0),

  -- Where the binary actually is. Any static host.
  download_url  text        NOT NULL CHECK (download_url ~ '^https://'),

  release_notes text,

  -- ⚠️ FALSE BY DEFAULT. A row is uploaded, checked, and then published — so a
  -- half-finished upload is never offered to every desktop in the field.
  is_published  boolean     NOT NULL DEFAULT false,

  -- What the feed orders by. NOT the version: a text sort puts '0.9.0' after
  -- '0.10.0' and would serve an older build as the newest.
  released_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- One row per version per platform. Re-publishing a version is an update to
  -- the existing row, never a second row that the ordering might disagree about.
  CONSTRAINT app_releases_platform_version_key UNIQUE (platform, version)
);

-- The feed's only query: newest published row for a platform.
CREATE INDEX IF NOT EXISTS app_releases_feed_idx
  ON public.app_releases (platform, released_at DESC)
  WHERE is_published;

COMMENT ON TABLE public.app_releases IS
  'Desktop application releases. Not tenant data — no workspace_id. Read publicly by the update feed; written only by the service role.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- ⚠️ ENABLED WITH A READ-ONLY POLICY AND NO WRITE POLICY.
--
-- Enabling RLS without any policy denies everything, including reads — and the
-- updater must be able to read before anyone signs in. So there is exactly one
-- policy, for SELECT, on published rows.
--
-- There is deliberately NO insert/update/delete policy. The service role
-- bypasses RLS, so publishing still works from the backend; every other client,
-- authenticated or not, is denied. That is the whole access model for this
-- table, and it is enforced here rather than in application code.
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_releases_public_read ON public.app_releases;
CREATE POLICY app_releases_public_read
  ON public.app_releases
  FOR SELECT
  USING (is_published);

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION — run AFTER the statements above and report the output.
--
-- Expected on a fresh install:
--   table_exists      : true
--   rls_enabled       : true
--   select_policies   : 1
--   write_policies    : 0        ← anything else means someone can publish
--   published_releases: 0
-- ============================================================================

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'app_releases'
  )                                                                AS table_exists,
  (SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.app_releases'::regclass)                    AS rls_enabled,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_releases'
      AND cmd = 'SELECT')                                           AS select_policies,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_releases'
      AND cmd <> 'SELECT')                                          AS write_policies,
  (SELECT count(*) FROM public.app_releases WHERE is_published)     AS published_releases;


-- ============================================================================
-- PUBLISHING A RELEASE — the shape of the insert, for when you have one.
--
-- `version`, `file_name`, `size` and `sha512` all come from the `latest.yml`
-- electron-builder writes into `apps/desktop/dist/`. Do not retype the hash.
--
--   INSERT INTO public.app_releases
--     (platform, version, file_name, file_size, sha512, download_url, release_notes, is_published)
--   VALUES
--     ('win', '1.2.0', 'Hisabche-1.2.0-setup.exe', 78134616,
--      '<sha512 from latest.yml>',
--      'https://<your-host>/releases/Hisabche-1.2.0-setup.exe',
--      'چه چیزی عوض شد',
--      false);
--
-- Upload the file, confirm it downloads, THEN:
--   UPDATE public.app_releases SET is_published = true
--    WHERE platform = 'win' AND version = '1.2.0';
-- ============================================================================
