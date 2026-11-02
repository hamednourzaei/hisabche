-- ============================================================================
-- Hisabche Migration: Service Delivery & Attendance Core (M4)
-- File: docs/service-delivery-01-migration.sql
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- Description:
-- Adds public.service_delivery_sessions table for tracking service sessions,
-- practitioner attendance connections, and package credit redemptions.
--
-- Invariants:
-- 1. Tenancy boundary: workspace_id strictly enforced.
-- 2. RLS enabled: tenant isolation by workspace MEMBERSHIP (workspace_members), like every other tenant table.
-- 3. Security: REVOKE ALL from PUBLIC, anon.
-- ============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.service_delivery_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    service_offering_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    practitioner_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    settlement_method VARCHAR(30) NOT NULL DEFAULT 'package_credit',
    package_credit_id UUID REFERENCES public.package_credit_ledger(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    client_notes TEXT,
    internal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ,
    origin VARCHAR(30) NOT NULL DEFAULT 'cloud',
    sync_state VARCHAR(30) NOT NULL DEFAULT 'synced',
    CONSTRAINT chk_service_delivery_status CHECK (
        status IN ('scheduled', 'in_progress', 'delivered', 'cancelled', 'no_show')
    ),
    CONSTRAINT chk_service_delivery_settlement CHECK (
        settlement_method IN ('package_credit', 'invoice', 'complementary')
    )
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_service_delivery_workspace_date
    ON public.service_delivery_sessions (workspace_id, session_date);

CREATE INDEX IF NOT EXISTS idx_service_delivery_customer
    ON public.service_delivery_sessions (workspace_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_service_delivery_practitioner
    ON public.service_delivery_sessions (workspace_id, practitioner_id)
    WHERE practitioner_id IS NOT NULL;

-- 3. Enable Row Level Security
ALTER TABLE public.service_delivery_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Revoke and Grant Permissions
REVOKE ALL ON public.service_delivery_sessions FROM PUBLIC;
REVOKE ALL ON public.service_delivery_sessions FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.service_delivery_sessions TO authenticated;
GRANT ALL ON public.service_delivery_sessions TO service_role;

-- 5. RLS Policies
DROP POLICY IF EXISTS service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions;
CREATE POLICY service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions
    FOR ALL
    TO authenticated
    USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    )
    WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    );

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.trg_service_delivery_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_delivery_sessions_timestamp ON public.service_delivery_sessions;
CREATE TRIGGER trg_service_delivery_sessions_timestamp
    BEFORE UPDATE ON public.service_delivery_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_service_delivery_sessions_updated_at();

-- ============================================================================
-- Rollback block
-- ============================================================================
/*
DROP TRIGGER IF EXISTS trg_service_delivery_sessions_timestamp ON public.service_delivery_sessions;
DROP FUNCTION IF EXISTS public.trg_service_delivery_sessions_updated_at();
DROP POLICY IF EXISTS service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions;
DROP TABLE IF EXISTS public.service_delivery_sessions;
*/
