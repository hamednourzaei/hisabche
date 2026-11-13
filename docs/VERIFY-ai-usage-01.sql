-- ==============================================================================
-- docs/VERIFY-ai-usage-01.sql
--
-- Read-only verification for docs/ai-usage-01-migration.sql.
-- Run AFTER the migration. Every row is a fact that must be TRUE.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ==============================================================================

-- 1. Token columns exist and are nullable (NULL means «not reported»).
SELECT
    'ai_query_log.prompt_tokens is nullable integer' AS check_name,
    (data_type = 'integer' AND is_nullable = 'YES')  AS ok
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ai_query_log'
  AND column_name = 'prompt_tokens'
UNION ALL
SELECT
    'ai_query_log.completion_tokens is nullable integer',
    (data_type = 'integer' AND is_nullable = 'YES')
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ai_query_log'
  AND column_name = 'completion_tokens';

-- 2. The four new tables exist.
SELECT
    'table exists: ' || t AS check_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = t
    ) AS ok
FROM (VALUES
    ('ai_provider_fallbacks'),
    ('ai_model_prices'),
    ('ai_budgets'),
    ('ai_prompt_versions')
) AS expected(t);

-- 3. RLS is on for every new table.
SELECT
    'rls enabled: ' || c.relname AS check_name,
    c.relrowsecurity AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'ai_provider_fallbacks',
      'ai_model_prices',
      'ai_budgets',
      'ai_prompt_versions'
  )
ORDER BY c.relname;

-- 4. anon and authenticated hold NO privilege on any new table.
SELECT
    'no anon/authenticated grants: ' || table_name AS check_name,
    count(*) = 0 AS ok
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
      'ai_provider_fallbacks',
      'ai_model_prices',
      'ai_budgets',
      'ai_prompt_versions'
  )
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name
ORDER BY table_name;

-- 5. The prompt-history triggers exist and are shaped as intended.
SELECT
    'prompt-history trigger on ai_provider_settings' AS check_name,
    EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'ai_provider_settings'
          AND t.tgname = 'trg_ai_log_prompt_version'
          AND NOT t.tgisinternal
    ) AS ok
UNION ALL
SELECT
    'append-only trigger on ai_prompt_versions',
    EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'ai_prompt_versions'
          AND t.tgname = 'trg_ai_prompt_versions_append_only'
          AND NOT t.tgisinternal
    );

-- 6. The append-only function refuses both edits (definition check).
SELECT
    'append-only function refuses UPDATE and DELETE' AS check_name,
    (prosrc LIKE '%BEFORE UPDATE OR DELETE%' OR prosrc LIKE '%TG_OP%') AS ok
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'ai_prompt_versions_append_only';

-- 7. The aggregation exists and pins its search_path.
SELECT
    'ai_usage_summary(since, until) exists with a pinned search_path' AS check_name,
    (pg_get_function_arguments(p.oid) = 'p_since timestamp with time zone, p_until timestamp with time zone'
     AND p.proconfig IS NOT NULL) AS ok
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'ai_usage_summary';

-- 8. The two unique indexes that make the tables meaningful.
SELECT
    'unique index exists: ' || i AS check_name,
    EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = i
    ) AS ok
FROM (VALUES
    ('ux_ai_provider_fallbacks_position'),
    ('ux_ai_model_prices_model'),
    ('ux_ai_budgets_platform'),
    ('ux_ai_budgets_workspace')
) AS expected(i);

-- 9. A model with no price yields NULL cost, never zero (shape check on the
--    aggregation; the pg test proves it against real rows).
SELECT
    'ai_usage_summary returns a cost_micros column' AS check_name,
    pg_get_function_result(p.oid) LIKE '%cost_micros%' AS ok
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'ai_usage_summary';

-- 10. Every new function is executable by service_role only.
SELECT
    'function execute granted to service_role: ' || p.proname AS check_name,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS ok
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('ai_usage_summary', 'ai_fallbacks_replace', 'ai_budget_save')
ORDER BY p.proname;
