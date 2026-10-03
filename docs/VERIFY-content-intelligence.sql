-- ============================================================================
-- docs/VERIFY-content-intelligence.sql — run AFTER content-intelligence 01 … 05.
-- Every row must say true. Read-only.
--
-- These tables are INTERNAL: the backend (service_role, behind the
-- platform-admin guard) is the only reader and writer. So the checks are: the
-- table exists, RLS is on, and no client role can read it.
-- ============================================================================

SELECT 'table ' || t || ' exists' AS check, to_regclass('public.' || t) IS NOT NULL AS ok
  FROM unnest(ARRAY[
    'blog_content_briefs', 'blog_research_runs', 'blog_sources', 'blog_article_sources',
    'blog_article_versions', 'blog_quality_reports', 'blog_internal_links', 'blog_prompt_settings'
  ]) AS t
UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN (
    'blog_content_briefs', 'blog_research_runs', 'blog_sources', 'blog_article_sources',
    'blog_article_versions', 'blog_quality_reports', 'blog_internal_links', 'blog_prompt_settings')
UNION ALL
SELECT 'clients cannot read ' || c.relname,
       NOT has_table_privilege('anon', c.oid, 'SELECT')
       AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN (
    'blog_content_briefs', 'blog_research_runs', 'blog_sources', 'blog_article_sources',
    'blog_article_versions', 'blog_quality_reports', 'blog_internal_links', 'blog_prompt_settings')
UNION ALL
SELECT 'no client policy on any content-intelligence table',
       NOT EXISTS (
         SELECT 1 FROM pg_policies
          WHERE tablename IN (
            'blog_content_briefs', 'blog_research_runs', 'blog_sources', 'blog_article_sources',
            'blog_article_versions', 'blog_quality_reports', 'blog_internal_links',
            'blog_prompt_settings')
            AND roles && ARRAY['anon', 'authenticated', 'public']::name[])
UNION ALL
SELECT 'the writer prompt table accepts only the known key',
       EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'blog_prompt_settings' AND c.contype = 'c'
                  AND pg_get_constraintdef(c.oid) ILIKE '%writer%')
UNION ALL
SELECT 'a stored prompt, if any, is within its length bounds',
       NOT EXISTS (SELECT 1 FROM public.blog_prompt_settings
                    WHERE char_length(btrim(prompt)) NOT BETWEEN 50 AND 20000);
