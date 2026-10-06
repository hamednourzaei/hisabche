-- ============================================
-- docs/cms-foundation-migration.sql
--
-- CMS Foundation: Media Library, Pages, Versions, Navigation, Globals
-- Platform-scoped (no workspace_id) — CMS is the public website's content layer.
--
-- ⚠️ Additive, idempotent, re-runnable. Human executes in SQL Editor.
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- MEDIA LIBRARY
-- Central asset registry for all visual content.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cms_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes BIGINT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  focal_x REAL NOT NULL DEFAULT 0.5,
  focal_y REAL NOT NULL DEFAULT 0.5,
  uploaded_by UUID REFERENCES auth.users(id),
  bucket TEXT NOT NULL DEFAULT 'cms-media',
  storage_path TEXT NOT NULL,
  variants JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- CMS PAGES
-- Each row is a locale+slug combination — one URL maps to one page.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  theme TEXT NOT NULL DEFAULT 'default'
    CHECK (theme IN ('default', 'marketing', 'product', 'editorial', 'campaign', 'dark')),
  seo_title TEXT,
  seo_description TEXT,
  seo_canonical TEXT,
  seo_og_image_id UUID REFERENCES cms_media(id),
  seo_noindex BOOLEAN NOT NULL DEFAULT false,
  seo_schema JSONB NOT NULL DEFAULT '{}',
  sections JSONB NOT NULL DEFAULT '[]',
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

-- ═══════════════════════════════════════════════════════════════
-- PAGE VERSIONS
-- Immutable snapshots. Forward-only: no UPDATE, no DELETE.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cms_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'default',
  sections JSONB NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  seo_canonical TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

-- Forward-only: no updates, no deletes on versions.
CREATE OR REPLACE FUNCTION cms_page_versions_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'cms_page_versions is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cms_page_versions_no_update ON cms_page_versions;
CREATE TRIGGER trg_cms_page_versions_no_update
  BEFORE UPDATE OR DELETE ON cms_page_versions
  FOR EACH ROW EXECUTE FUNCTION cms_page_versions_immutable();

-- ═══════════════════════════════════════════════════════════════
-- NAVIGATION
-- One row per (locale, position). Admin overwrites the items array.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cms_navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  position TEXT NOT NULL CHECK (position IN ('header', 'footer', 'sidebar')),
  items JSONB NOT NULL DEFAULT '[]',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (locale, position)
);

-- ═══════════════════════════════════════════════════════════════
-- GLOBAL CONTENT
-- Key-value store for site-wide editorial content.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cms_globals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  key TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (locale, key)
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cms_pages_locale_status
  ON cms_pages (locale, slug)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_cms_pages_status
  ON cms_pages (status);

CREATE INDEX IF NOT EXISTS idx_cms_media_mime
  ON cms_media (mime_type);

CREATE INDEX IF NOT EXISTS idx_cms_page_versions_page
  ON cms_page_versions (page_id, version DESC);

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- CMS is platform-admin-scoped. Public reads published pages only.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE cms_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_navigation ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_globals ENABLE ROW LEVEL SECURITY;

-- Published pages and media are publicly readable (for ISR/SSG).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cms_pages_public_read') THEN
    CREATE POLICY cms_pages_public_read ON cms_pages
      FOR SELECT USING (status = 'published');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cms_media_public_read') THEN
    CREATE POLICY cms_media_public_read ON cms_media
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cms_navigation_public_read') THEN
    CREATE POLICY cms_navigation_public_read ON cms_navigation
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cms_globals_public_read') THEN
    CREATE POLICY cms_globals_public_read ON cms_globals
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cms_page_versions_public_read') THEN
    CREATE POLICY cms_page_versions_public_read ON cms_page_versions
      FOR SELECT USING (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Supabase Storage bucket for CMS media
-- ═══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-media',
  'cms-media',
  true,
  10485760,  -- 10 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'image/svg+xml', 'image/gif',
    'video/mp4', 'video/webm',
    'application/pdf',
    'font/woff', 'font/woff2'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Public read for the bucket.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'cms_media_bucket_public_read'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY cms_media_bucket_public_read
      ON storage.objects FOR SELECT
      USING (bucket_id = 'cms-media');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERY (run separately)
-- ═══════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'cms_%'
-- ORDER BY table_name;
--
-- Expected:
-- cms_globals
-- cms_media
-- cms_navigation
-- cms_page_versions
-- cms_pages

-- ═══════════════════════════════════════════════════════════════
-- ROLLBACK (if needed)
-- ═══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS cms_page_versions CASCADE;
-- DROP TABLE IF EXISTS cms_pages CASCADE;
-- DROP TABLE IF EXISTS cms_navigation CASCADE;
-- DROP TABLE IF EXISTS cms_globals CASCADE;
-- DROP TABLE IF EXISTS cms_media CASCADE;
-- DROP FUNCTION IF EXISTS cms_page_versions_immutable();
-- DELETE FROM storage.buckets WHERE id = 'cms-media';
