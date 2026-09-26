-- ============================================================================
-- PLAN LIMITS SET BY THE PLATFORM ADMIN — additive, idempotent, re-runnable.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then the verification query at the
-- bottom. Status: PENDING HUMAN CONFIRMATION.
--
-- WHAT THIS ADDS
--   plan_limit_settings        per plan: { invoices, users, aiMonthly }
--   workspace_limit_overrides  per workspace: the same keys, winning over the plan
--
-- `limits` is jsonb. A key PRESENT replaces the layer below; its value null
-- means «unlimited»; an ABSENT key means «inherit». The built-in defaults live
-- in backend/src/services/plan-limit-defaults.ts. Before this runs, those
-- defaults apply — exactly what applied before.
--
-- Service role only: RLS on, no client policy, no grant to anon/authenticated.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_limit_settings (
  plan        text PRIMARY KEY CHECK (plan IN ('free', 'pro', 'enterprise')),
  limits      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(limits) = 'object'),
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_limit_overrides (
  workspace_id uuid PRIMARY KEY,
  limits       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(limits) = 'object'),
  note         text,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_limit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_limit_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_limit_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workspace_limit_overrides FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.plan_limit_settings TO service_role;
GRANT ALL ON public.workspace_limit_overrides TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
-- Dropping returns every workspace to the built-in defaults.
--   DROP TABLE IF EXISTS public.workspace_limit_overrides;
--   DROP TABLE IF EXISTS public.plan_limit_settings;
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately. Every row: ok = true.
-- ============================================================================
-- SELECT 'tables' AS check,
--        to_regclass('public.plan_limit_settings') IS NOT NULL
--        AND to_regclass('public.workspace_limit_overrides') IS NOT NULL AS ok
-- UNION ALL
-- SELECT 'rls on',
--        (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.plan_limit_settings'))
--        AND (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.workspace_limit_overrides'))
-- UNION ALL
-- SELECT 'clients cannot read or write',
--        NOT has_table_privilege('authenticated', 'public.plan_limit_settings', 'SELECT')
--        AND NOT has_table_privilege('authenticated', 'public.workspace_limit_overrides', 'INSERT')
--        AND NOT has_table_privilege('anon', 'public.plan_limit_settings', 'SELECT');
