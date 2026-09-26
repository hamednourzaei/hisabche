-- ============================================================================
-- VERIFY — docs/blog-migration.sql
--
-- Read-only. Run in the SQL Editor AFTER the migration. Every row must read
-- ok = true. Paste the result back; until then the status is
-- PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'tables' AS check,
       to_regclass('public.blog_categories') IS NOT NULL
       AND to_regclass('public.blog_tags') IS NOT NULL
       AND to_regclass('public.blog_posts') IS NOT NULL
       AND to_regclass('public.blog_post_tags') IS NOT NULL
       AND to_regclass('public.blog_comments') IS NOT NULL
       AND to_regclass('public.blog_reactions') IS NOT NULL
       AND to_regclass('public.blog_ratings') IS NOT NULL
       AND to_regclass('public.blog_post_view_days') IS NOT NULL AS ok
UNION ALL
SELECT 'rls on (8 tables)',
       (SELECT count(*) FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
          AND relname IN ('blog_categories', 'blog_tags', 'blog_posts', 'blog_post_tags',
                          'blog_comments', 'blog_reactions', 'blog_ratings', 'blog_post_view_days')) = 8
UNION ALL
SELECT 'slug unique per locale',
       EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'public.blog_posts'::regclass AND contype = 'u'
                 AND pg_get_constraintdef(oid) = 'UNIQUE (locale, slug)')
UNION ALL
SELECT 'one translation per locale',
       EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'public.blog_posts'::regclass AND contype = 'u'
                 AND pg_get_constraintdef(oid) = 'UNIQUE (translation_group_id, locale)')
UNION ALL
SELECT 'one reaction / one rating per user',
       (SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid = 'public.blog_reactions'::regclass AND contype = 'p') = 'PRIMARY KEY (post_id, user_id)'
       AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint
            WHERE conrelid = 'public.blog_ratings'::regclass AND contype = 'p') = 'PRIMARY KEY (post_id, user_id)'
UNION ALL
SELECT 'reply depth trigger',
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgrelid = 'public.blog_comments'::regclass AND tgname = 'blog_comments_one_level')
UNION ALL
SELECT 'functions present',
       to_regprocedure('public.blog_set_reaction(uuid, uuid, smallint)') IS NOT NULL
       AND to_regprocedure('public.blog_set_rating(uuid, uuid, smallint)') IS NOT NULL
       AND to_regprocedure('public.blog_record_view(uuid)') IS NOT NULL
       AND to_regprocedure('public.blog_post_stats(uuid[])') IS NOT NULL
       AND to_regprocedure('public.blog_post_is_public(text, timestamptz)') IS NOT NULL
       AND to_regprocedure('public.blog_save_post(uuid, jsonb, uuid[])') IS NOT NULL
UNION ALL
SELECT 'clients cannot write',
       NOT has_table_privilege('authenticated', 'public.blog_comments', 'INSERT')
       AND NOT has_table_privilege('authenticated', 'public.blog_reactions', 'INSERT')
       AND NOT has_table_privilege('authenticated', 'public.blog_ratings', 'UPDATE')
       AND NOT has_table_privilege('anon', 'public.blog_posts', 'INSERT')
       AND NOT has_table_privilege('authenticated', 'public.blog_posts', 'UPDATE')
UNION ALL
SELECT 'clients cannot call write functions',
       NOT has_function_privilege('authenticated', 'public.blog_set_reaction(uuid, uuid, smallint)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.blog_set_rating(uuid, uuid, smallint)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.blog_record_view(uuid)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.blog_save_post(uuid, jsonb, uuid[])', 'EXECUTE')
UNION ALL
SELECT 'anon is granted nothing',
       NOT has_table_privilege('anon', 'public.blog_posts', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.blog_comments', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.blog_categories', 'SELECT')
UNION ALL
SELECT 'view statistics not readable by clients',
       NOT has_table_privilege('anon', 'public.blog_post_view_days', 'SELECT')
       AND NOT has_table_privilege('authenticated', 'public.blog_post_view_days', 'SELECT')
UNION ALL
SELECT 'bucket blog-images: public, 2 MB, images only',
       EXISTS (SELECT 1 FROM storage.buckets
               WHERE id = 'blog-images' AND public = true AND file_size_limit = 2097152
                 AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
                 AND array_length(allowed_mime_types, 1) = 4);
