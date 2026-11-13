-- ==============================================================================
-- docs/ai-usage-01-migration.sql
--
-- V63 · A — the AI surface the console was missing.
--
-- WHY
--   The AI tab could set one provider, one model, one key. Everything else an
--   owner needs in order to run a product that bills them per question was
--   absent: no ordered fallback, no timeout per provider, no token or cost
--   record, no budget, and no history of the system prompt. A question that
--   failed at the primary provider failed the user, and the monthly bill could
--   only be discovered on the provider's own dashboard.
--
-- WHAT
--   1. ai_query_log gains prompt_tokens / completion_tokens — NULL when the
--      provider did not report usage. They are NULL, never 0: «not reported»
--      and «zero tokens» are different facts and a total that conflates them
--      is a wrong number.
--   2. ai_provider_fallbacks — the ordered list tried after the primary
--      configuration, each with its own timeout.
--   3. ai_model_prices — one price per (provider, model), in the currency the
--      owner paid in. Cost is computed from this table, never hardcoded.
--   4. ai_budgets — a monthly ceiling per currency, platform-wide or for one
--      workspace, with the percentage at which the console warns.
--   5. ai_prompt_versions — APPEND-ONLY history of `ai_provider_settings.
--      system_prompt`. A trigger writes the row, so the application has ONE
--      write (the settings row) and the history cannot be forgotten, edited or
--      deleted — not by the app, not by an admin, not by a future migration
--      author who forgets why it is append-only.
--   6. ai_usage_summary(since, until) — the one aggregation the console reads.
--      It groups by day/provider/model, reports token totals only when EVERY
--      row in the group reported them, and reports cost only when the model
--      has a price. Otherwise the answer is NULL plus a count of unpriced
--      questions.
--
-- SAFETY
--   - additive and idempotent; every object is created only if absent;
--   - new tables are born locked: RLS on with no policy, REVOKE from
--     anon/authenticated/PUBLIC, GRANT to service_role only;
--   - every function pins `search_path = public, pg_temp`;
--   - nothing here reads, copies or stores a provider secret.
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-ai-usage-01.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.ai_budget_save(text, uuid, text, bigint, integer, text);
--   DROP FUNCTION IF EXISTS public.ai_fallbacks_replace(jsonb, text);
--   DROP FUNCTION IF EXISTS public.ai_usage_summary(timestamptz, timestamptz);
--   DROP FUNCTION IF EXISTS public.ai_prompt_versions_append_only();
--   DROP FUNCTION IF EXISTS public.ai_log_prompt_version();
--   DROP TABLE IF EXISTS public.ai_prompt_versions;
--   DROP TABLE IF EXISTS public.ai_budgets;
--   DROP TABLE IF EXISTS public.ai_model_prices;
--   DROP TABLE IF EXISTS public.ai_provider_fallbacks;
--   ALTER TABLE public.ai_query_log
--     DROP COLUMN IF EXISTS prompt_tokens,
--     DROP COLUMN IF EXISTS completion_tokens;
-- ==============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Token usage on the existing question log.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_query_log
    ADD COLUMN IF NOT EXISTS prompt_tokens     integer,
    ADD COLUMN IF NOT EXISTS completion_tokens integer;

COMMENT ON COLUMN public.ai_query_log.prompt_tokens IS
    'Tokens the provider reported for the question. NULL = the provider did not report usage; never 0.';
COMMENT ON COLUMN public.ai_query_log.completion_tokens IS
    'Tokens the provider reported for the answer. NULL = the provider did not report usage; never 0.';

-- ---------------------------------------------------------------------------
-- 2. Ordered fallback. The primary configuration stays in
--    ai_provider_settings; this table is what is tried after it, in `position`
--    order. The same stored key is used for every entry: the product keeps ONE
--    provider credential (docs/admin-secrets-01-migration.sql), so a fallback
--    is a different model or gateway, not a second account.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_provider_fallbacks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    position    integer NOT NULL CHECK (position BETWEEN 1 AND 9),
    provider    text NOT NULL CHECK (provider IN ('anthropic', 'openai')),
    model       text NOT NULL CHECK (length(btrim(model)) BETWEEN 1 AND 120),
    base_url    text CHECK (base_url IS NULL OR length(base_url) BETWEEN 8 AND 300),
    timeout_ms  integer NOT NULL DEFAULT 60000 CHECK (timeout_ms BETWEEN 1000 AND 300000),
    is_enabled  boolean NOT NULL DEFAULT true,
    updated_by  text,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One entry per position: two rows claiming position 2 would make the order
-- depend on row order, which is not an order.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_provider_fallbacks_position
    ON public.ai_provider_fallbacks(position);

COMMENT ON TABLE public.ai_provider_fallbacks IS
    'V63 · A — ordered providers tried after the primary AI configuration. Same stored key; a different model or gateway.';

-- ---------------------------------------------------------------------------
-- 3. Model prices, integer micros per ONE MILLION tokens.
--
--    ⚠️ No default currency and no guessed price. A model without a row here
--    produces NO cost in the console — «قیمت ثبت نشده» — because a made-up
--    rate is indistinguishable from a real one on a bill.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_model_prices (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider                    text NOT NULL CHECK (provider IN ('anthropic', 'openai')),
    model                       text NOT NULL CHECK (length(btrim(model)) BETWEEN 1 AND 120),
    currency                    text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    input_micros_per_million    bigint NOT NULL CHECK (input_micros_per_million >= 0),
    output_micros_per_million   bigint NOT NULL CHECK (output_micros_per_million >= 0),
    updated_by                  text,
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_model_prices_model
    ON public.ai_model_prices(provider, model);

COMMENT ON TABLE public.ai_model_prices IS
    'V63 · A — one price per (provider, model) in integer micros per million tokens. Cost is NULL for a model with no row; it is never defaulted.';

-- ---------------------------------------------------------------------------
-- 4. Monthly budget per currency.
--
--    ⚠️ Per CURRENCY, not one number: adding AFN to USD produces a number that
--    means nothing. A platform budget is one row per currency; a workspace
--    budget is one row per (workspace, currency).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_budgets (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope                 text NOT NULL CHECK (scope IN ('platform', 'workspace')),
    workspace_id          uuid,
    currency              text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    monthly_limit_micros  bigint NOT NULL CHECK (monthly_limit_micros > 0),
    alert_percent         integer NOT NULL DEFAULT 80 CHECK (alert_percent BETWEEN 1 AND 100),
    updated_by            text,
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_budgets_scope_workspace CHECK (
        (scope = 'workspace' AND workspace_id IS NOT NULL)
        OR (scope = 'platform' AND workspace_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_budgets_platform
    ON public.ai_budgets(currency)
    WHERE scope = 'platform';

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_budgets_workspace
    ON public.ai_budgets(workspace_id, currency)
    WHERE scope = 'workspace';

COMMENT ON TABLE public.ai_budgets IS
    'V63 · A — monthly AI ceiling per currency. Money is integer micros; two currencies are never added together.';

-- ---------------------------------------------------------------------------
-- 5. Append-only prompt history.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version     bigint GENERATED ALWAYS AS IDENTITY,
    content     text NOT NULL,
    created_by  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_prompt_versions_version
    ON public.ai_prompt_versions(version);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_created_at
    ON public.ai_prompt_versions(created_at DESC);

-- The application writes the settings row; this trigger writes the history, so
-- there is one write and it cannot be skipped.
CREATE OR REPLACE FUNCTION public.ai_log_prompt_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF btrim(COALESCE(NEW.system_prompt, '')) <> '' THEN
            INSERT INTO public.ai_prompt_versions (content, created_by)
            VALUES (
                NEW.system_prompt,
                CASE WHEN NEW.updated_by IS NULL THEN NULL ELSE NEW.updated_by::text END
            );
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.system_prompt IS DISTINCT FROM OLD.system_prompt THEN
        INSERT INTO public.ai_prompt_versions (content, created_by)
        VALUES (
            NEW.system_prompt,
            CASE WHEN NEW.updated_by IS NULL THEN NULL ELSE NEW.updated_by::text END
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_log_prompt_version ON public.ai_provider_settings;
CREATE TRIGGER trg_ai_log_prompt_version
    AFTER INSERT OR UPDATE OF system_prompt ON public.ai_provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.ai_log_prompt_version();

-- Refuse every edit. A history that can be edited is not a history.
CREATE OR REPLACE FUNCTION public.ai_prompt_versions_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'ai_prompt_versions is append-only: % is refused', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_prompt_versions_append_only ON public.ai_prompt_versions;
CREATE TRIGGER trg_ai_prompt_versions_append_only
    BEFORE UPDATE OR DELETE ON public.ai_prompt_versions
    FOR EACH ROW
    EXECUTE FUNCTION public.ai_prompt_versions_append_only();

COMMENT ON TABLE public.ai_prompt_versions IS
    'V63 · A — append-only history of ai_provider_settings.system_prompt, written by trg_ai_log_prompt_version. UPDATE and DELETE are refused by trigger.';

-- ---------------------------------------------------------------------------
-- 5b. Replacing the whole fallback list is ONE write.
--
--     The console edits an ordered list, so a save is «delete all, insert the
--     new rows». supabase-js has no transaction, and a compensating delete is
--     forbidden (AGENTS.md §1.4), so the list is replaced inside this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_fallbacks_replace(
    p_entries jsonb,
    p_actor_email text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    inserted integer;
BEGIN
    IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
        RAISE EXCEPTION 'AI_FALLBACKS_INVALID: expected a JSON array'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    DELETE FROM public.ai_provider_fallbacks;

    INSERT INTO public.ai_provider_fallbacks
        (position, provider, model, base_url, timeout_ms, is_enabled, updated_by, updated_at)
    SELECT
        (entry->>'position')::integer,
        entry->>'provider',
        btrim(entry->>'model'),
        NULLIF(btrim(COALESCE(entry->>'baseUrl', '')), ''),
        COALESCE((entry->>'timeoutMs')::integer, 60000),
        COALESCE((entry->>'isEnabled')::boolean, true),
        p_actor_email,
        now()
    FROM jsonb_array_elements(p_entries) AS entry;

    GET DIAGNOSTICS inserted = ROW_COUNT;
    RETURN inserted;
END;
$$;

COMMENT ON FUNCTION public.ai_fallbacks_replace(jsonb, text) IS
    'V63 · A — replaces the ordered AI fallback list in one transaction. The only writer of ai_provider_fallbacks.';

-- ---------------------------------------------------------------------------
-- 5c. Upserting a budget relies on a PARTIAL unique index (one platform row
--     per currency, one workspace row per workspace+currency). PostgREST's
--     `on_conflict` cannot infer a partial index, so the write is this
--     function — one statement, correct on a race.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_budget_save(
    p_scope text,
    p_workspace_id uuid,
    p_currency text,
    p_limit_micros bigint,
    p_alert_percent integer,
    p_actor text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    saved_id uuid;
BEGIN
    IF p_scope = 'platform' THEN
        INSERT INTO public.ai_budgets
            (scope, workspace_id, currency, monthly_limit_micros, alert_percent, updated_by, updated_at)
        VALUES
            ('platform', NULL, p_currency, p_limit_micros, p_alert_percent, p_actor, now())
        ON CONFLICT (currency) WHERE scope = 'platform'
        DO UPDATE SET
            monthly_limit_micros = EXCLUDED.monthly_limit_micros,
            alert_percent        = EXCLUDED.alert_percent,
            updated_by           = EXCLUDED.updated_by,
            updated_at           = now()
        RETURNING id INTO saved_id;
    ELSE
        INSERT INTO public.ai_budgets
            (scope, workspace_id, currency, monthly_limit_micros, alert_percent, updated_by, updated_at)
        VALUES
            ('workspace', p_workspace_id, p_currency, p_limit_micros, p_alert_percent, p_actor, now())
        ON CONFLICT (workspace_id, currency) WHERE scope = 'workspace'
        DO UPDATE SET
            monthly_limit_micros = EXCLUDED.monthly_limit_micros,
            alert_percent        = EXCLUDED.alert_percent,
            updated_by           = EXCLUDED.updated_by,
            updated_at           = now()
        RETURNING id INTO saved_id;
    END IF;

    RETURN saved_id;
END;
$$;

COMMENT ON FUNCTION public.ai_budget_save(text, uuid, text, bigint, integer, text) IS
    'V63 · A — upserts one AI budget per (scope/workspace, currency). The only writer of ai_budgets.';

-- ---------------------------------------------------------------------------
-- 6. The one aggregation the console reads.
--    Token totals are reported only when every row in the group reported them;
--    cost only when the model has a price. An unknown total is NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_usage_summary(
    p_since timestamptz,
    p_until timestamptz
)
RETURNS TABLE (
    day                date,
    provider           text,
    model              text,
    queries            bigint,
    prompt_tokens      bigint,
    completion_tokens  bigint,
    currency           text,
    cost_micros        bigint,
    unpriced_queries   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH grouped AS (
        SELECT
            (q.created_at AT TIME ZONE 'UTC')::date AS day,
            COALESCE(q.model_provider, '') AS provider,
            COALESCE(q.model_name, '') AS model,
            count(*) AS queries,
            CASE
                WHEN count(*) = count(q.prompt_tokens) THEN sum(q.prompt_tokens)
                ELSE NULL
            END AS prompt_tokens,
            CASE
                WHEN count(*) = count(q.completion_tokens) THEN sum(q.completion_tokens)
                ELSE NULL
            END AS completion_tokens
        FROM public.ai_query_log q
        WHERE q.created_at >= p_since
          AND q.created_at <  p_until
        GROUP BY 1, 2, 3
    )
    SELECT
        g.day,
        g.provider,
        g.model,
        g.queries,
        g.prompt_tokens,
        g.completion_tokens,
        p.currency,
        CASE
            WHEN p.id IS NULL THEN NULL
            WHEN g.prompt_tokens IS NULL OR g.completion_tokens IS NULL THEN NULL
            ELSE (
                (g.prompt_tokens  * p.input_micros_per_million) / 1000000
                + (g.completion_tokens * p.output_micros_per_million) / 1000000
            )
        END AS cost_micros,
        CASE WHEN p.id IS NULL THEN g.queries ELSE 0 END AS unpriced_queries
    FROM grouped g
    LEFT JOIN public.ai_model_prices p
           ON p.provider = g.provider
          AND p.model    = g.model
    ORDER BY g.day ASC, g.provider ASC, g.model ASC;
$$;

COMMENT ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz) IS
    'V63 · A — per day/provider/model AI usage. Tokens are NULL unless every row reported them; cost is NULL when the model has no price.';

-- ---------------------------------------------------------------------------
-- 7. Lock every new table. Supabase grants ALL to anon/authenticated at birth;
--    these are platform tables and only the service role may touch them.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_provider_fallbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_versions    ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.ai_provider_fallbacks FROM anon;
        REVOKE ALL ON public.ai_model_prices      FROM anon;
        REVOKE ALL ON public.ai_budgets           FROM anon;
        REVOKE ALL ON public.ai_prompt_versions   FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.ai_provider_fallbacks FROM authenticated;
        REVOKE ALL ON public.ai_model_prices      FROM authenticated;
        REVOKE ALL ON public.ai_budgets           FROM authenticated;
        REVOKE ALL ON public.ai_prompt_versions   FROM authenticated;
    END IF;

    REVOKE ALL ON public.ai_provider_fallbacks FROM PUBLIC;
    REVOKE ALL ON public.ai_model_prices      FROM PUBLIC;
    REVOKE ALL ON public.ai_budgets           FROM PUBLIC;
    REVOKE ALL ON public.ai_prompt_versions   FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.ai_provider_fallbacks TO service_role;
        GRANT ALL ON public.ai_model_prices      TO service_role;
        GRANT ALL ON public.ai_budgets           TO service_role;
        GRANT ALL ON public.ai_prompt_versions   TO service_role;
    END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_prompt_versions_append_only()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_log_prompt_version()                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_fallbacks_replace(jsonb, text)                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_budget_save(text, uuid, text, bigint, integer, text) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz) FROM anon;
        REVOKE EXECUTE ON FUNCTION public.ai_prompt_versions_append_only()           FROM anon;
        REVOKE EXECUTE ON FUNCTION public.ai_log_prompt_version()                    FROM anon;
        REVOKE EXECUTE ON FUNCTION public.ai_fallbacks_replace(jsonb, text)          FROM anon;
        REVOKE EXECUTE ON FUNCTION public.ai_budget_save(text, uuid, text, bigint, integer, text) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz) FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.ai_prompt_versions_append_only()           FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.ai_log_prompt_version()                    FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.ai_fallbacks_replace(jsonb, text)          FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.ai_budget_save(text, uuid, text, bigint, integer, text) FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz) TO service_role;
        GRANT EXECUTE ON FUNCTION public.ai_fallbacks_replace(jsonb, text)          TO service_role;
        GRANT EXECUTE ON FUNCTION public.ai_budget_save(text, uuid, text, bigint, integer, text) TO service_role;
    END IF;
END $$;

COMMIT;
