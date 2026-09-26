-- ============================================================================
-- BLOG — posts, categories, tags, comments, reactions, ratings, views.
-- Additive, idempotent (safe to run twice).
--
-- ✅ RUN on production Supabase 2026-09-26; docs/VERIFY-blog.sql returned
-- 12/12 rows ok = true (reported by a human).
--
-- WHAT THIS ADDS
--
--   blog_categories / blog_tags     per-locale (fa | af | en), slug unique per locale
--   blog_posts                      one row per locale; the three translations of
--                                   one article share `translation_group_id`
--                                   (hreflang). `content_html` is written only by
--                                   the backend after sanitising (allowlist).
--   blog_post_tags                  post ↔ tag
--   blog_comments                   signed-in users only; ONE level of replies
--                                   (trigger); public sees `approved` only, the
--                                   author also sees their own pending comment
--   blog_reactions                  one row per (post, user): 1 = like, -1 = dislike
--   blog_ratings                    one row per (post, user): 1..5 stars
--   blog_post_view_days             views per post per day (admin statistics)
--   blog_save_post(…)               a post AND its tags in one transaction
--   blog_post_stats(uuid[])         EXACT counts (count(*)), never a stored
--                                   counter a client could write (§۷٫۴)
--   blog_set_reaction / blog_set_rating / blog_record_view
--                                   atomic upserts; two simultaneous likes by one
--                                   user are ONE row (primary key + ON CONFLICT)
--   storage bucket `blog-images`    public read; jpeg/png/webp/avif; 2 MB
--
-- WHO MAY READ AND WRITE
--
--   The public site reads the blog THROUGH THE BACKEND (service_role), which
--   applies the publication rule itself — no client talks to Supabase directly
--   (USER-REQUESTS #112). So `anon` is granted nothing, as everywhere in this
--   repo; `authenticated` may SELECT exactly what the policies below allow.
--   Nobody but the backend writes.
--   «A user writes only their own row» is enforced where the token is verified:
--   the backend takes user_id from the verified JWT, never from the body, and
--   every write is keyed by (post_id, user_id). A direct PostgREST write with a
--   user's JWT is refused outright — letting it through would bypass the
--   backend's rate limit and honeypot on comments.
--   Administration (posts, moderation) = backend + platformAdminGuard.
--
-- VISIBILITY
--
--   A post is public when status = 'published', or status = 'scheduled' and
--   published_at has passed — scheduling needs no cron; the web's ISR picks the
--   post up on its next revalidation (≤ 1 hour) or immediately on a
--   revalidate call.
--
-- NOT A TENANT TABLE. Blog rows belong to the platform, not to a workspace; the
-- rls-coverage guard lists them by name with SELECT-only assertions.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────── categories and tags

CREATE TABLE IF NOT EXISTS public.blog_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale       text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  slug         text NOT NULL CHECK (slug ~ '^[^[:space:]/?#%]+$' AND char_length(slug) <= 120),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description  text CHECK (description IS NULL OR char_length(description) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.blog_tags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale       text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  slug         text NOT NULL CHECK (slug ~ '^[^[:space:]/?#%]+$' AND char_length(slug) <= 120),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

-- ─────────────────────────────────────────────── posts

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale                text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  slug                  text NOT NULL CHECK (slug ~ '^[^[:space:]/?#%]+$' AND char_length(slug) <= 120),
  title                 text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  excerpt               text CHECK (excerpt IS NULL OR char_length(excerpt) <= 500),
  -- Tiptap document (the editor's source of truth) and the HTML the web
  -- renders. The HTML is produced by the backend's sanitiser; nothing else
  -- writes it.
  content_json          jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_html          text NOT NULL DEFAULT '',
  -- Real questions and answers shown at the end of the article. FAQPage
  -- JSON-LD is emitted from THIS column only, so it always matches the page.
  faq                   jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(faq) = 'array'),
  cover_url             text,
  -- A cover without alt text is refused (accessibility + image search).
  cover_alt             text,
  meta_title            text CHECK (meta_title IS NULL OR char_length(meta_title) <= 120),
  meta_description      text CHECK (meta_description IS NULL OR char_length(meta_description) <= 320),
  focus_keyword         text CHECK (focus_keyword IS NULL OR char_length(focus_keyword) <= 120),
  keywords              text[] NOT NULL DEFAULT '{}',
  -- NULL = self-canonical (the normal case).
  canonical_url         text,
  og_image_url          text,
  noindex               boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'scheduled', 'published')),
  published_at          timestamptz,
  author_id             uuid,
  reading_minutes       integer NOT NULL DEFAULT 1 CHECK (reading_minutes BETWEEN 1 AND 600),
  category_id           uuid REFERENCES public.blog_categories (id) ON DELETE SET NULL,
  translation_group_id  uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug),
  -- One translation per language inside a group.
  UNIQUE (translation_group_id, locale),
  CONSTRAINT blog_posts_publish_date CHECK (status = 'draft' OR published_at IS NOT NULL),
  CONSTRAINT blog_posts_cover_alt CHECK (
    cover_url IS NULL OR (cover_alt IS NOT NULL AND char_length(btrim(cover_alt)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS blog_posts_public_list
  ON public.blog_posts (locale, published_at DESC)
  WHERE status IN ('published', 'scheduled');
CREATE INDEX IF NOT EXISTS blog_posts_category ON public.blog_posts (category_id);

CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  post_id  uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES public.blog_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS blog_post_tags_tag ON public.blog_post_tags (tag_id);

-- Whether a post is on the public site right now. One definition, used by the
-- policies and the write functions alike.
CREATE OR REPLACE FUNCTION public.blog_post_is_public(p_status text, p_published_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_status = 'published'
      OR (p_status = 'scheduled' AND p_published_at IS NOT NULL AND p_published_at <= now())
$$;

-- ─────────────────────────────────────────────── comments

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  parent_id   uuid REFERENCES public.blog_comments (id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  moderated_by uuid,
  moderated_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_comments_post ON public.blog_comments (post_id, status, created_at);
CREATE INDEX IF NOT EXISTS blog_comments_queue ON public.blog_comments (status, created_at)
  WHERE status = 'pending';

-- One level of replies: a reply's parent must be a top-level comment on the
-- same post.
CREATE OR REPLACE FUNCTION public.blog_comments_one_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent record;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT post_id, parent_id INTO v_parent FROM public.blog_comments WHERE id = NEW.parent_id;
  IF NOT FOUND OR v_parent.post_id <> NEW.post_id OR v_parent.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'BLOG_COMMENT_REPLY_DEPTH' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS blog_comments_one_level ON public.blog_comments;
CREATE TRIGGER blog_comments_one_level
  BEFORE INSERT OR UPDATE OF parent_id, post_id ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.blog_comments_one_level();

-- ─────────────────────────────────────────────── reactions and ratings

CREATE TABLE IF NOT EXISTS public.blog_reactions (
  post_id     uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  value       smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.blog_ratings (
  post_id     uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ─────────────────────────────────────────────── views (admin statistics)

CREATE TABLE IF NOT EXISTS public.blog_post_view_days (
  post_id  uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  day      date NOT NULL,
  views    bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (post_id, day)
);

-- ─────────────────────────────────────────────── updated_at

CREATE OR REPLACE FUNCTION public.blog_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['blog_categories', 'blog_tags', 'blog_posts', 'blog_comments',
                           'blog_reactions', 'blog_ratings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.blog_touch_updated_at()',
      t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────── write functions (backend only)

-- p_value: 1 like, -1 dislike, 0 = take my reaction back. Returns the stored
-- value (0 after a removal). Raises BLOG_POST_NOT_PUBLIC for a draft.
CREATE OR REPLACE FUNCTION public.blog_set_reaction(p_post_id uuid, p_user_id uuid, p_value smallint)
RETURNS smallint
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_value NOT IN (-1, 0, 1) THEN
    RAISE EXCEPTION 'BLOG_REACTION_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.blog_posts
    WHERE id = p_post_id AND public.blog_post_is_public(status, published_at);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOG_POST_NOT_PUBLIC' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_value = 0 THEN
    DELETE FROM public.blog_reactions WHERE post_id = p_post_id AND user_id = p_user_id;
    RETURN 0;
  END IF;

  INSERT INTO public.blog_reactions (post_id, user_id, value)
  VALUES (p_post_id, p_user_id, p_value)
  ON CONFLICT (post_id, user_id) DO UPDATE SET value = EXCLUDED.value;
  RETURN p_value;
END
$$;

CREATE OR REPLACE FUNCTION public.blog_set_rating(p_post_id uuid, p_user_id uuid, p_stars smallint)
RETURNS smallint
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_stars NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'BLOG_RATING_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.blog_posts
    WHERE id = p_post_id AND public.blog_post_is_public(status, published_at);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOG_POST_NOT_PUBLIC' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.blog_ratings (post_id, user_id, stars)
  VALUES (p_post_id, p_user_id, p_stars)
  ON CONFLICT (post_id, user_id) DO UPDATE SET stars = EXCLUDED.stars;
  RETURN p_stars;
END
$$;

-- One view. A draft is not counted (and not an error: the page may have been
-- unpublished between render and beacon).
CREATE OR REPLACE FUNCTION public.blog_record_view(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.blog_posts
    WHERE id = p_post_id AND public.blog_post_is_public(status, published_at);
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO public.blog_post_view_days (post_id, day, views)
  VALUES (p_post_id, (now() AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (post_id, day) DO UPDATE SET views = public.blog_post_view_days.views + 1;
END
$$;

-- A post and its tags in ONE transaction (supabase-js has no transactions:
-- راهنمای سشن §۱٫۴). p_post_id NULL creates; otherwise updates that post.
-- p_fields holds the columns by name; absent keys keep their current value on
-- update. Returns the post id. A unique violation surfaces as 23505 with the
-- constraint name, which the backend maps to «slug taken» / «translation taken».
CREATE OR REPLACE FUNCTION public.blog_save_post(p_post_id uuid, p_fields jsonb, p_tag_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_post_id IS NULL THEN
    INSERT INTO blog_posts (
      locale, slug, title, excerpt, content_json, content_html, faq, cover_url, cover_alt,
      meta_title, meta_description, focus_keyword, keywords, canonical_url, og_image_url,
      noindex, status, published_at, reading_minutes, category_id, translation_group_id, author_id
    ) VALUES (
      p_fields->>'locale', p_fields->>'slug', p_fields->>'title', p_fields->>'excerpt',
      coalesce(p_fields->'content_json', '{"type":"doc","content":[]}'::jsonb),
      coalesce(p_fields->>'content_html', ''),
      coalesce(p_fields->'faq', '[]'::jsonb),
      p_fields->>'cover_url', p_fields->>'cover_alt',
      p_fields->>'meta_title', p_fields->>'meta_description', p_fields->>'focus_keyword',
      coalesce(ARRAY(SELECT jsonb_array_elements_text(p_fields->'keywords')), '{}'),
      p_fields->>'canonical_url', p_fields->>'og_image_url',
      coalesce((p_fields->>'noindex')::boolean, false),
      coalesce(p_fields->>'status', 'draft'),
      (p_fields->>'published_at')::timestamptz,
      coalesce((p_fields->>'reading_minutes')::integer, 1),
      (p_fields->>'category_id')::uuid,
      coalesce((p_fields->>'translation_group_id')::uuid, gen_random_uuid()),
      (p_fields->>'author_id')::uuid
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE blog_posts SET
      locale           = CASE WHEN p_fields ? 'locale' THEN p_fields->>'locale' ELSE locale END,
      slug             = CASE WHEN p_fields ? 'slug' THEN p_fields->>'slug' ELSE slug END,
      title            = CASE WHEN p_fields ? 'title' THEN p_fields->>'title' ELSE title END,
      excerpt          = CASE WHEN p_fields ? 'excerpt' THEN p_fields->>'excerpt' ELSE excerpt END,
      content_json     = CASE WHEN p_fields ? 'content_json' THEN p_fields->'content_json' ELSE content_json END,
      content_html     = CASE WHEN p_fields ? 'content_html' THEN p_fields->>'content_html' ELSE content_html END,
      faq              = CASE WHEN p_fields ? 'faq' THEN p_fields->'faq' ELSE faq END,
      cover_url        = CASE WHEN p_fields ? 'cover_url' THEN p_fields->>'cover_url' ELSE cover_url END,
      cover_alt        = CASE WHEN p_fields ? 'cover_alt' THEN p_fields->>'cover_alt' ELSE cover_alt END,
      meta_title       = CASE WHEN p_fields ? 'meta_title' THEN p_fields->>'meta_title' ELSE meta_title END,
      meta_description = CASE WHEN p_fields ? 'meta_description' THEN p_fields->>'meta_description' ELSE meta_description END,
      focus_keyword    = CASE WHEN p_fields ? 'focus_keyword' THEN p_fields->>'focus_keyword' ELSE focus_keyword END,
      keywords         = CASE WHEN p_fields ? 'keywords'
                              THEN coalesce(ARRAY(SELECT jsonb_array_elements_text(p_fields->'keywords')), '{}')
                              ELSE keywords END,
      canonical_url    = CASE WHEN p_fields ? 'canonical_url' THEN p_fields->>'canonical_url' ELSE canonical_url END,
      og_image_url     = CASE WHEN p_fields ? 'og_image_url' THEN p_fields->>'og_image_url' ELSE og_image_url END,
      noindex          = CASE WHEN p_fields ? 'noindex' THEN (p_fields->>'noindex')::boolean ELSE noindex END,
      status           = CASE WHEN p_fields ? 'status' THEN p_fields->>'status' ELSE status END,
      published_at     = CASE WHEN p_fields ? 'published_at' THEN (p_fields->>'published_at')::timestamptz ELSE published_at END,
      reading_minutes  = CASE WHEN p_fields ? 'reading_minutes' THEN (p_fields->>'reading_minutes')::integer ELSE reading_minutes END,
      category_id      = CASE WHEN p_fields ? 'category_id' THEN (p_fields->>'category_id')::uuid ELSE category_id END,
      translation_group_id = CASE WHEN p_fields ? 'translation_group_id' AND p_fields->>'translation_group_id' IS NOT NULL
                                  THEN (p_fields->>'translation_group_id')::uuid ELSE translation_group_id END
    WHERE id = p_post_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'BLOG_POST_NOT_FOUND' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  IF p_tag_ids IS NOT NULL THEN
    DELETE FROM blog_post_tags WHERE post_id = v_id AND NOT (tag_id = ANY (p_tag_ids));
    INSERT INTO blog_post_tags (post_id, tag_id)
    SELECT v_id, t FROM unnest(p_tag_ids) AS t
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_id;
END
$$;

-- ─────────────────────────────────────────────── exact statistics

-- One row per requested post, zeros included. Every number is a count(*) or an
-- avg over the real rows at the moment of the call.
CREATE OR REPLACE FUNCTION public.blog_post_stats(p_post_ids uuid[])
RETURNS TABLE (
  post_id            uuid,
  likes              bigint,
  dislikes           bigint,
  rating_count       bigint,
  rating_avg         numeric,
  approved_comments  bigint,
  pending_comments   bigint,
  views              bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id,
         (SELECT count(*) FROM blog_reactions r WHERE r.post_id = p.id AND r.value = 1),
         (SELECT count(*) FROM blog_reactions r WHERE r.post_id = p.id AND r.value = -1),
         (SELECT count(*) FROM blog_ratings g WHERE g.post_id = p.id),
         (SELECT round(avg(g.stars)::numeric, 2) FROM blog_ratings g WHERE g.post_id = p.id),
         (SELECT count(*) FROM blog_comments c WHERE c.post_id = p.id AND c.status = 'approved'),
         (SELECT count(*) FROM blog_comments c WHERE c.post_id = p.id AND c.status = 'pending'),
         (SELECT coalesce(sum(v.views), 0)::bigint FROM blog_post_view_days v WHERE v.post_id = p.id)
  FROM blog_posts p
  WHERE p.id = ANY (p_post_ids)
$$;

-- ─────────────────────────────────────────────── row level security

ALTER TABLE public.blog_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_reactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_view_days  ENABLE ROW LEVEL SECURITY;

-- Published content: readable by a signed-in client, writable by nobody but
-- the service role. (Anonymous readers go through the backend.)
DROP POLICY IF EXISTS blog_categories_public_read ON public.blog_categories;
CREATE POLICY blog_categories_public_read ON blog_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS blog_tags_public_read ON public.blog_tags;
CREATE POLICY blog_tags_public_read ON blog_tags
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS blog_posts_public_read ON public.blog_posts;
CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT TO authenticated
  USING (public.blog_post_is_public(status, published_at));

DROP POLICY IF EXISTS blog_post_tags_public_read ON public.blog_post_tags;
CREATE POLICY blog_post_tags_public_read ON blog_post_tags
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.blog_posts p
    WHERE p.id = post_id AND public.blog_post_is_public(p.status, p.published_at)
  ));

-- Person-scoped. Approved comments on public posts; the author also sees
-- their own, whatever the status («در انتظار تأیید»).
DROP POLICY IF EXISTS blog_comments_read ON public.blog_comments;
CREATE POLICY blog_comments_read ON blog_comments
  FOR SELECT TO authenticated
  USING (
    (status = 'approved' AND EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = post_id AND public.blog_post_is_public(p.status, p.published_at)
    ))
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS blog_reactions_own_read ON public.blog_reactions;
CREATE POLICY blog_reactions_own_read ON blog_reactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS blog_ratings_own_read ON public.blog_ratings;
CREATE POLICY blog_ratings_own_read ON blog_ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- blog_post_view_days: no policy at all — clients read nothing; admin
-- statistics come from blog_post_stats() through the backend.

REVOKE ALL ON public.blog_categories, public.blog_tags, public.blog_posts, public.blog_post_tags,
              public.blog_comments, public.blog_reactions, public.blog_ratings,
              public.blog_post_view_days FROM anon, authenticated;
GRANT SELECT ON public.blog_categories, public.blog_tags, public.blog_posts, public.blog_post_tags,
                public.blog_comments TO authenticated;
GRANT SELECT ON public.blog_reactions, public.blog_ratings TO authenticated;
GRANT ALL ON public.blog_categories, public.blog_tags, public.blog_posts, public.blog_post_tags,
             public.blog_comments, public.blog_reactions, public.blog_ratings,
             public.blog_post_view_days TO service_role;

REVOKE ALL ON FUNCTION public.blog_set_reaction(uuid, uuid, smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_set_rating(uuid, uuid, smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_record_view(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_post_stats(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blog_save_post(uuid, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blog_set_reaction(uuid, uuid, smallint) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_set_rating(uuid, uuid, smallint) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_record_view(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_post_stats(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.blog_save_post(uuid, jsonb, uuid[]) TO service_role;

-- ─────────────────────────────────────────────── storage bucket (public images)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-images', 'blog-images', true, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION (run only if needed)
--
-- The backend answers «blog not configured» (503) without these tables and the
-- web shows an explicit empty state — nothing else depends on them.
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.blog_post_stats(uuid[]);
--   DROP FUNCTION IF EXISTS public.blog_save_post(uuid, jsonb, uuid[]);
--   DROP FUNCTION IF EXISTS public.blog_record_view(uuid);
--   DROP FUNCTION IF EXISTS public.blog_set_rating(uuid, uuid, smallint);
--   DROP FUNCTION IF EXISTS public.blog_set_reaction(uuid, uuid, smallint);
--   -- ⚠️ The tables hold articles, comments and votes. Check before dropping:
--   --   SELECT status, count(*) FROM public.blog_posts GROUP BY 1;
--   --   SELECT count(*) FROM public.blog_comments;
--   DROP TABLE IF EXISTS public.blog_post_view_days;
--   DROP TABLE IF EXISTS public.blog_ratings;
--   DROP TABLE IF EXISTS public.blog_reactions;
--   DROP TABLE IF EXISTS public.blog_comments;
--   DROP TABLE IF EXISTS public.blog_post_tags;
--   DROP TABLE IF EXISTS public.blog_posts;
--   DROP TABLE IF EXISTS public.blog_tags;
--   DROP TABLE IF EXISTS public.blog_categories;
--   DROP FUNCTION IF EXISTS public.blog_comments_one_level();
--   DROP FUNCTION IF EXISTS public.blog_touch_updated_at();
--   DROP FUNCTION IF EXISTS public.blog_post_is_public(text, timestamptz);
--   -- Images: empty the bucket in the Storage UI first, then
--   --   DELETE FROM storage.buckets WHERE id = 'blog-images';
--   COMMIT;
-- ============================================================================
