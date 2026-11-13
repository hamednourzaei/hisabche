-- ==============================================================================
-- docs/admin-secrets-01-migration.sql
--
-- V63 · S-3 — platform secrets move from plaintext/env into Supabase Vault.
--
-- WHAT THIS CREATES
--   1. platform_secrets  — the INDEX of a secret (name, purpose, last4,
--      rotation metadata, the Vault row id). It never holds the value.
--   2. platform_secret_set(name, value, purpose, actor_id, actor_email)
--      SECURITY DEFINER — creates or rotates the Vault secret, updates the
--      index, and writes one audit_logs row.
--   3. platform_secret_get(name) SECURITY DEFINER — returns the value to
--      service_role ONLY.
--   4. platform_secrets_list() — metadata only; what the console may render.
--
-- WHY
--   `ai_provider_settings.api_key` was plain text in a Postgres column and the
--   Stripe webhook secret lived in the environment. A database read (or a
--   Render env dump) was a full compromise of the owner's money and the AI
--   bill. The console now writes through `set` and reads only `last4`.
--
-- SAFETY
--   - additive and idempotent (safe to run twice);
--   - RLS on, no policy (service role only);
--   - REVOKE ALL from PUBLIC/anon/authenticated, then GRANT to service_role;
--   - functions are SECURITY DEFINER with a pinned search_path;
--   - EXECUTE revoked from PUBLIC/anon/authenticated; `get` is service_role only;
--   - the Vault extension is NOT required at migration time (a vanilla
--     Postgres, e.g. the pg test, must still apply this file). Calls fail with
--     a clear SQLSTATE when Vault is absent — they never silently return a
--     wrong value.
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-admin-secrets-01.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.platform_secret_promote(text, uuid, text);
--   DROP FUNCTION IF EXISTS public.platform_secret_stage(text, text, text, uuid, text);
--   DROP FUNCTION IF EXISTS public.platform_secret_discard(text);
--   DROP FUNCTION IF EXISTS public.platform_secret_get(text);
--   DROP FUNCTION IF EXISTS public.platform_secret_set(text, text, text, uuid, text);
--   DROP FUNCTION IF EXISTS public.platform_secrets_list();
--   DROP TABLE IF EXISTS public.platform_secrets;
--   (Vault secrets created through `set` are NOT dropped by this rollback;
--    rotate/remove them explicitly with `vault.delete_secret` if needed.)
-- ==============================================================================

-- 1. The index of secrets — never the value.
CREATE TABLE IF NOT EXISTS public.platform_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT '',
    vault_secret_id UUID,
    last4 TEXT,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_secrets_name_shape CHECK (name ~ '^[a-z0-9][a-z0-9._-]{1,63}$')
);

CREATE INDEX IF NOT EXISTS idx_platform_secrets_purpose
    ON public.platform_secrets(purpose);

-- 1b. A rotation in flight. The staged VALUE lives in Vault under
--     `staged/<name>`; these columns are only what a reviewer may see.
ALTER TABLE public.platform_secrets
    ADD COLUMN IF NOT EXISTS pending_last4 TEXT,
    ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pending_by TEXT;

-- 2. Write / rotate. One row in audit_logs, never the value.
CREATE OR REPLACE FUNCTION public.platform_secret_set(
    p_name TEXT,
    p_value TEXT,
    p_purpose TEXT DEFAULT '',
    p_actor_id UUID DEFAULT NULL,
    p_actor_email TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_vault_id UUID;
    v_row_id UUID;
    v_last4 TEXT;
BEGIN
    IF p_value IS NULL OR length(p_value) < 4 THEN
        RAISE EXCEPTION 'PLATFORM_SECRET_TOO_SHORT' USING ERRCODE = '22023';
    END IF;

    IF to_regclass('vault.secrets') IS NULL THEN
        RAISE EXCEPTION 'PLATFORM_VAULT_NOT_INSTALLED' USING ERRCODE = '0A000';
    END IF;

    SELECT vault_secret_id INTO v_vault_id
      FROM public.platform_secrets
     WHERE name = p_name;

    IF v_vault_id IS NULL THEN
        EXECUTE 'SELECT vault.create_secret($1, $2, $3)'
           INTO v_vault_id
          USING p_value, p_name, p_purpose;
    ELSE
        EXECUTE 'SELECT vault.update_secret($1, $2)'
           INTO v_vault_id
          USING v_vault_id, p_value;
    END IF;

    v_last4 := right(p_value, 4);

    INSERT INTO public.platform_secrets (name, purpose, vault_secret_id, last4, rotated_at, rotated_by)
    VALUES (p_name, p_purpose, v_vault_id, v_last4, NOW(), p_actor_email)
    ON CONFLICT (name) DO UPDATE
       SET purpose = EXCLUDED.purpose,
           vault_secret_id = EXCLUDED.vault_secret_id,
           last4 = EXCLUDED.last4,
           rotated_at = NOW(),
           rotated_by = EXCLUDED.rotated_by
    RETURNING id INTO v_row_id;

    IF to_regclass('public.audit_logs') IS NOT NULL AND p_actor_id IS NOT NULL THEN
        BEGIN
            INSERT INTO public.audit_logs
                (user_id, action, entity_type, entity_id, new_data)
            VALUES
                (p_actor_id, 'PLATFORM_SECRET_SET', 'platform_secret', v_row_id,
                 jsonb_build_object('name', p_name, 'purpose', p_purpose, 'last4', v_last4));
        EXCEPTION WHEN OTHERS THEN
            -- Audit must not make a rotation fail; the platform log records it too.
            NULL;
        END;
    END IF;

    RETURN v_row_id;
END;
$$;

-- 3. Read one value. service_role only.
CREATE OR REPLACE FUNCTION public.platform_secret_get(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_vault_id UUID;
    v_value TEXT;
BEGIN
    SELECT vault_secret_id INTO v_vault_id
      FROM public.platform_secrets
     WHERE name = p_name;

    IF v_vault_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF to_regclass('vault.decrypted_secrets') IS NULL THEN
        RAISE EXCEPTION 'PLATFORM_VAULT_NOT_INSTALLED' USING ERRCODE = '0A000';
    END IF;

    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $1'
       INTO v_value
      USING v_vault_id;

    RETURN v_value;
END;
$$;

-- 3b. Stage a rotation. The value goes to Vault under `staged/<name>`; the
--     index records only what a reviewer needs, and the maker files a
--     maker-checker request from the application (action_type SECRET_ROTATE).
CREATE OR REPLACE FUNCTION public.platform_secret_stage(
    p_name TEXT,
    p_value TEXT,
    p_purpose TEXT DEFAULT '',
    p_actor_id UUID DEFAULT NULL,
    p_actor_email TEXT DEFAULT NULL
) RETURNS TABLE (staged_name TEXT, last4 TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staged_name TEXT := 'staged/' || p_name;
    v_secret_name TEXT;
    v_last4 TEXT;
BEGIN
    IF p_value IS NULL OR length(p_value) < 4 THEN
        RAISE EXCEPTION 'PLATFORM_SECRET_TOO_SHORT' USING ERRCODE = '22023';
    END IF;

    IF to_regclass('vault.secrets') IS NULL THEN
        RAISE EXCEPTION 'PLATFORM_VAULT_NOT_INSTALLED' USING ERRCODE = '0A000';
    END IF;

    SELECT s.name INTO v_secret_name FROM vault.secrets s WHERE s.name = v_staged_name;

    IF v_secret_name IS NULL THEN
        EXECUTE 'SELECT vault.create_secret($1, $2, $3)'
           INTO STRICT v_secret_name
          USING p_value, v_staged_name, p_purpose;
    ELSE
        EXECUTE 'SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name = $2), $1)'
           INTO STRICT v_secret_name
          USING p_value, v_staged_name;
    END IF;

    v_last4 := right(p_value, 4);

    INSERT INTO public.platform_secrets
        (name, purpose, last4, pending_last4, pending_at, pending_by)
    VALUES
        (p_name, p_purpose, NULL, v_last4, NOW(), p_actor_email)
    ON CONFLICT (name) DO UPDATE
       SET purpose = EXCLUDED.purpose,
           pending_last4 = EXCLUDED.pending_last4,
           pending_at = NOW(),
           pending_by = EXCLUDED.pending_by;

    IF to_regclass('public.audit_logs') IS NOT NULL AND p_actor_id IS NOT NULL THEN
        BEGIN
            INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
            VALUES (p_actor_id, 'PLATFORM_SECRET_STAGED', 'platform_secret',
                    (SELECT id FROM public.platform_secrets WHERE name = p_name),
                    jsonb_build_object('name', p_name, 'last4', v_last4));
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN QUERY SELECT v_staged_name, v_last4;
END;
$$;

-- 3c. Promote a staged rotation. APPROVER PATH ONLY — the route and the
--     maker-checker service are the only callers, and they refuse a proposer
--     approving their own request before this runs. The VALUE moves inside
--     Postgres: read from Vault, written to Vault, never to a client.
CREATE OR REPLACE FUNCTION public.platform_secret_promote(
    p_name TEXT,
    p_actor_id UUID DEFAULT NULL,
    p_actor_email TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_value TEXT;
    v_purpose TEXT;
    v_staged_id UUID;
BEGIN
    IF to_regclass('vault.decrypted_secrets') IS NULL THEN
        RAISE EXCEPTION 'PLATFORM_VAULT_NOT_INSTALLED' USING ERRCODE = '0A000';
    END IF;

    SELECT ds.id, ds.decrypted_secret, COALESCE(s.description, '')
      INTO v_staged_id, v_value, v_purpose
      FROM vault.decrypted_secrets ds
      JOIN vault.secrets s ON s.id = ds.id
     WHERE s.name = 'staged/' || p_name;

    IF v_value IS NULL THEN
        RAISE EXCEPTION 'PLATFORM_SECRET_NOT_STAGED' USING ERRCODE = 'P0002';
    END IF;

    PERFORM public.platform_secret_set(p_name, v_value, v_purpose, p_actor_id, p_actor_email);

    EXECUTE 'SELECT vault.delete_secret($1)' USING v_staged_id;

    UPDATE public.platform_secrets
       SET pending_last4 = NULL, pending_at = NULL, pending_by = NULL
     WHERE name = p_name;
END;
$$;

-- 3d. Drop a staged rotation (a rejected request, or a failed insert).
CREATE OR REPLACE FUNCTION public.platform_secret_discard(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staged_id UUID;
BEGIN
    IF to_regclass('vault.secrets') IS NOT NULL THEN
        SELECT id INTO v_staged_id FROM vault.secrets WHERE name = 'staged/' || p_name;
        IF v_staged_id IS NOT NULL THEN
            EXECUTE 'SELECT vault.delete_secret($1)' USING v_staged_id;
        END IF;
    END IF;

    UPDATE public.platform_secrets
       SET pending_last4 = NULL, pending_at = NULL, pending_by = NULL
     WHERE name = p_name;
END;
$$;

-- 4. Metadata for the console: no value, no vault id.
DROP FUNCTION IF EXISTS public.platform_secrets_list();
CREATE OR REPLACE FUNCTION public.platform_secrets_list()
RETURNS TABLE (
    name TEXT,
    purpose TEXT,
    last4 TEXT,
    rotated_at TIMESTAMPTZ,
    rotated_by TEXT,
    pending_last4 TEXT,
    pending_at TIMESTAMPTZ,
    pending_by TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT name, purpose, last4, rotated_at, rotated_by,
           pending_last4, pending_at, pending_by
      FROM public.platform_secrets
     ORDER BY name;
$$;

-- 5. Privileges.
ALTER TABLE public.platform_secrets ENABLE ROW LEVEL SECURITY;
-- No policy: only the service role (which bypasses RLS) may touch it.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.platform_secrets FROM anon;
        REVOKE ALL ON FUNCTION public.platform_secret_set(text, text, text, uuid, text) FROM anon;
        REVOKE ALL ON FUNCTION public.platform_secret_get(text) FROM anon;
        REVOKE ALL ON FUNCTION public.platform_secret_stage(text, text, text, uuid, text) FROM anon;
        REVOKE ALL ON FUNCTION public.platform_secret_promote(text, uuid, text) FROM anon;
        REVOKE ALL ON FUNCTION public.platform_secret_discard(text) FROM anon;
        REVOKE ALL ON FUNCTION public.platform_secrets_list() FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.platform_secrets FROM authenticated;
        REVOKE ALL ON FUNCTION public.platform_secret_set(text, text, text, uuid, text) FROM authenticated;
        REVOKE ALL ON FUNCTION public.platform_secret_get(text) FROM authenticated;
        REVOKE ALL ON FUNCTION public.platform_secret_stage(text, text, text, uuid, text) FROM authenticated;
        REVOKE ALL ON FUNCTION public.platform_secret_promote(text, uuid, text) FROM authenticated;
        REVOKE ALL ON FUNCTION public.platform_secret_discard(text) FROM authenticated;
        REVOKE ALL ON FUNCTION public.platform_secrets_list() FROM authenticated;
    END IF;

    REVOKE ALL ON public.platform_secrets FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.platform_secret_set(text, text, text, uuid, text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.platform_secret_get(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.platform_secret_stage(text, text, text, uuid, text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.platform_secret_promote(text, uuid, text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.platform_secret_discard(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.platform_secrets_list() FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.platform_secrets TO service_role;
        GRANT EXECUTE ON FUNCTION public.platform_secret_set(text, text, text, uuid, text) TO service_role;
        GRANT EXECUTE ON FUNCTION public.platform_secret_get(text) TO service_role;
        GRANT EXECUTE ON FUNCTION public.platform_secret_stage(text, text, text, uuid, text) TO service_role;
        GRANT EXECUTE ON FUNCTION public.platform_secret_promote(text, uuid, text) TO service_role;
        GRANT EXECUTE ON FUNCTION public.platform_secret_discard(text) TO service_role;
        GRANT EXECUTE ON FUNCTION public.platform_secrets_list() TO service_role;
    END IF;
END $$;

-- 6. One-time copy of the AI key that used to sit in plain text.
--    Runs only when both tables exist and turns into a no-op as soon as the
--    column is empty, so re-running the migration is safe. The value moves
--    Postgres → Vault inside the database; it is never printed.
DO $$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.ai_provider_settings') IS NULL
       OR to_regclass('vault.secrets') IS NULL THEN
        RETURN;
    END IF;

    FOR r IN
        SELECT api_key FROM public.ai_provider_settings
         WHERE api_key IS NOT NULL AND api_key <> ''
    LOOP
        PERFORM public.platform_secret_set(
            'ai.api_key', r.api_key, 'AI provider API key (copied from plaintext)', NULL, 'migration'
        );
        UPDATE public.ai_provider_settings SET api_key = NULL;
    END LOOP;
END $$;
