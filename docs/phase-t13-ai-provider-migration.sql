-- ============================================================================
-- T13 — connecting an AI provider to the Phase O infrastructure.
--
-- Phase O built the safe surface: four `reporting` views that take no
-- parameters, `auth_workspace_ids()` as the only isolation boundary,
-- `metadata.entity_catalog`, and `ai_query_log`. Nothing contacted a provider.
--
-- This migration adds the two things that were missing, and nothing else:
--
--   ai_provider_settings  what to call, with which key, and what to tell it
--   ai_workspace_quota    how many questions an account may ask
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE API KEY IS THE MOST DANGEROUS COLUMN IN THIS DATABASE
--
-- `ai_provider_settings` holds a provider secret that bills the OWNER of this
-- product, not the customer. A workspace member who reads it can spend the
-- owner's money without limit, and can do it from anywhere.
--
-- So the table has RLS ENABLED WITH NO POLICY AT ALL. That is not an
-- oversight — with RLS on and no policy, PostgreSQL denies every row to every
-- role that is subject to RLS. Only the service role, which bypasses RLS,
-- can read it, and the service role only ever exists inside the backend.
--
-- There is deliberately no «admins can read it» policy. An admin needs to SET
-- the key, which the backend does on their behalf; nobody needs to READ it
-- back, and a policy that let them would be a policy prompt injection could
-- eventually aim at.
--
-- ---------------------------------------------------------------------------
-- ⚠️ USAGE IS COUNTED FROM `ai_query_log`, NOT STORED IN A COUNTER
--
-- The obvious design is `ai_workspace_quota.used_this_month`, incremented per
-- question. It is the wrong one, and this codebase has spent a lot of this
-- release fixing exactly that shape: a derived number with its own writer
-- drifts from the rows it claims to summarise, and then nobody can tell which
-- is right (`invoices.paid_amount` was the last one — see T9).
--
-- `ai_query_log` already records every question with a `created_at` and has an
-- index on `(workspace_id, created_at DESC)`. Counting from it cannot drift,
-- because the thing being counted IS the thing that happened.
--
-- This table therefore stores the LIMIT only.
--
-- ---------------------------------------------------------------------------
-- ADDITIVE AND IDEMPOTENT. Creates two tables, drops nothing, changes no
-- existing row, and re-runs safely.
--
-- ROLLBACK / MITIGATION
--   DROP TABLE IF EXISTS ai_workspace_quota;
--   DROP TABLE IF EXISTS ai_provider_settings;
--
--   Nothing else references them. The product returns to Phase O's state:
--   the reporting views still work, `ai_query_log` still exists, and the chat
--   endpoint reports that no provider is configured — which is what it also
--   does before this migration is applied.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Provider settings — PLATFORM level, one row.
--
-- Not per-workspace: the key belongs to whoever runs this product, and every
-- customer's questions go through it. `singleton` exists so a second row is
-- impossible rather than merely discouraged — two rows would mean the backend
-- picks one arbitrarily and the admin panel edits the other.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_provider_settings (
  singleton      boolean PRIMARY KEY DEFAULT true CHECK (singleton),

  provider       text NOT NULL DEFAULT 'anthropic',

  /**
   * Base URL. Optional — each provider has a default the backend knows.
   *
   * ⚠️ Present so a self-hosted or proxied endpoint can be used. It is set by
   * a platform admin through the backend and is never taken from a request
   * body reaching a workspace user: a URL an untrusted party can set is where
   * the API key would be sent.
   */
  base_url       text,

  model          text NOT NULL DEFAULT 'claude-sonnet-4-5',

  /**
   * The provider secret.
   *
   * ⚠️ NEVER LEAVES THE BACKEND. No endpoint returns it, not even to an admin,
   * not masked, not partially. The admin panel shows whether a key is SET and
   * offers to replace it — that is the whole interaction a key needs.
   */
  api_key        text,

  /** The task definition — the owner's textarea in the admin panel. */
  system_prompt  text NOT NULL DEFAULT '',

  /** Shown to a customer who has run out, so they can ask for more. */
  topup_contact  text NOT NULL DEFAULT '',

  is_enabled     boolean NOT NULL DEFAULT false,

  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,

  CONSTRAINT ai_provider_check CHECK (provider IN ('anthropic', 'openai'))
);

COMMENT ON TABLE ai_provider_settings IS
  'T13 - platform-level AI provider configuration. RLS is ENABLED WITH NO POLICY on purpose: only the service role may read this, because api_key bills the product owner. Nothing returns api_key to any client.';

COMMENT ON COLUMN ai_provider_settings.api_key IS
  '⚠️ Provider secret. Never returned by any endpoint. The admin panel reports only whether it is set.';

-- ⚠️ RLS on, NO POLICY. Every role subject to RLS is denied every row.
ALTER TABLE ai_provider_settings ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even without RLS this would not be reachable.
REVOKE ALL ON ai_provider_settings FROM PUBLIC;
REVOKE ALL ON ai_provider_settings FROM anon;
REVOKE ALL ON ai_provider_settings FROM authenticated;


-- ---------------------------------------------------------------------------
-- 2. Per-workspace question allowance.
--
-- Stores the LIMIT. The USAGE is counted from ai_query_log — see the header.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_workspace_quota (
  workspace_id     uuid PRIMARY KEY,

  /**
   * Questions per calendar month.
   *
   * NULL means «whatever the plan allows» — the backend resolves it from the
   * subscription. A number here overrides the plan, which is the «دلخواه»
   * case the owner asked for.
   *
   * ⚠️ 0 is a real value and means «none». It is distinct from NULL, which
   * means «not overridden». Treating them the same would make setting a
   * customer to zero silently fall back to their plan's allowance.
   */
  monthly_limit    integer CHECK (monthly_limit IS NULL OR monthly_limit >= 0),

  note             text NOT NULL DEFAULT '',

  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid
);

COMMENT ON TABLE ai_workspace_quota IS
  'T13 - per-workspace AI question allowance. Stores the LIMIT only; usage is counted from ai_query_log so the two cannot drift. NULL monthly_limit means "use the plan allowance"; 0 means "none".';

-- Read-only to the workspace itself: a customer may see their own allowance
-- (the UI shows «۱۲ از ۵۰»), and may not change it.
ALTER TABLE ai_workspace_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_workspace_quota_read ON ai_workspace_quota;
CREATE POLICY ai_workspace_quota_read ON ai_workspace_quota
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = ai_workspace_quota.workspace_id));

-- No INSERT/UPDATE/DELETE policy: only the service role writes, on an admin's
-- behalf. A customer who could raise their own limit does not have a limit.

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. Both tables exist.  EXPECT: 2 rows
SELECT tablename
FROM   pg_tables
WHERE  tablename IN ('ai_provider_settings', 'ai_workspace_quota')
ORDER  BY tablename;

-- 2. ⚠️ The settings table has RLS ON and ZERO policies.
--    EXPECT: rls_enabled = true, policy_count = 0
SELECT c.relrowsecurity                                  AS rls_enabled,
       (SELECT COUNT(*) FROM pg_policies p
         WHERE p.tablename = 'ai_provider_settings')     AS policy_count
FROM   pg_class c
WHERE  c.relname = 'ai_provider_settings';

-- 3. ⚠️ No user-facing role can read the key.  EXPECT: 0
SELECT COUNT(*) AS user_grants
FROM   information_schema.role_table_grants
WHERE  table_name = 'ai_provider_settings'
  AND  grantee IN ('authenticated', 'anon', 'PUBLIC', 'public');

-- 4. The quota table is readable but not writable by a member.
--    EXPECT: 1 row, cmd = 'SELECT'
SELECT policyname, cmd
FROM   pg_policies
WHERE  tablename = 'ai_workspace_quota';

-- 5. Nothing was seeded — no key, no enabled provider.  EXPECT: 0
SELECT COUNT(*) AS settings_rows FROM ai_provider_settings;
