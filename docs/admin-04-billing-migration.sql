-- ==============================================================================
-- docs/admin-04-billing-migration.sql
--
-- Agent A — Step A4: Monetization & Billing Infrastructure
-- 1. plan_prices (versioned pricing, effective_from/until, IRR stored)
-- 2. billing_ledger_entries (immutable platform accounting entries)
-- 3. admin_action_requests (maker-checker: proposer != approver)
-- 4. subscription_history (lifecycle state transitions)
-- 5. dunning_logs (communication audit trail)
--
-- Security:
-- - REVOKE ALL FROM PUBLIC, anon, authenticated
-- - GRANT ALL TO service_role
-- - RLS enabled
-- - Additive, idempotent
-- ==============================================================================

-- 1. plan_prices
CREATE TABLE IF NOT EXISTS public.plan_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan TEXT NOT NULL,
    amount_irr BIGINT NOT NULL CHECK (amount_irr >= 0),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_prices_lookup 
    ON public.plan_prices(plan, effective_from, effective_until);

-- 2. billing_ledger_entries
CREATE TABLE IF NOT EXISTS public.billing_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('CHARGE', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'CREDIT', 'UPGRADE_CREDIT')),
    amount_irr BIGINT NOT NULL,
    description TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_ledger_workspace 
    ON public.billing_ledger_entries(workspace_id, created_at DESC);

-- 3. admin_action_requests (Maker-Checker pattern)
CREATE TABLE IF NOT EXISTS public.admin_action_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL CHECK (action_type IN ('REFUND', 'LEDGER_ADJUSTMENT', 'PRICE_CHANGE', 'DOWNGRADE', 'LICENSE_TRANSFER')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    diff_preview JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    proposed_by TEXT NOT NULL,
    approved_by TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    CONSTRAINT chk_maker_checker_proposer_ne_approver 
        CHECK (approved_by IS NULL OR approved_by <> proposed_by)
);

CREATE INDEX IF NOT EXISTS idx_admin_action_requests_status 
    ON public.admin_action_requests(status, created_at DESC);

-- 4. subscription_history
CREATE TABLE IF NOT EXISTS public.subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_workspace 
    ON public.subscription_history(workspace_id, created_at DESC);

-- 5. dunning_logs
CREATE TABLE IF NOT EXISTS public.dunning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL', 'IN_APP')),
    status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED', 'DELIVERED')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dunning_logs_workspace 
    ON public.dunning_logs(workspace_id, sent_at DESC);

-- Security: Enable RLS
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dunning_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.plan_prices FROM anon;
        REVOKE ALL ON public.billing_ledger_entries FROM anon;
        REVOKE ALL ON public.admin_action_requests FROM anon;
        REVOKE ALL ON public.subscription_history FROM anon;
        REVOKE ALL ON public.dunning_logs FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.plan_prices FROM authenticated;
        REVOKE ALL ON public.billing_ledger_entries FROM authenticated;
        REVOKE ALL ON public.admin_action_requests FROM authenticated;
        REVOKE ALL ON public.subscription_history FROM authenticated;
        REVOKE ALL ON public.dunning_logs FROM authenticated;
    END IF;
    REVOKE ALL ON public.plan_prices FROM PUBLIC;
    REVOKE ALL ON public.billing_ledger_entries FROM PUBLIC;
    REVOKE ALL ON public.admin_action_requests FROM PUBLIC;
    REVOKE ALL ON public.subscription_history FROM PUBLIC;
    REVOKE ALL ON public.dunning_logs FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.plan_prices TO service_role;
        GRANT ALL ON public.billing_ledger_entries TO service_role;
        GRANT ALL ON public.admin_action_requests TO service_role;
        GRANT ALL ON public.subscription_history TO service_role;
        GRANT ALL ON public.dunning_logs TO service_role;
    END IF;
END $$;
