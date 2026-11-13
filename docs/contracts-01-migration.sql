-- ============================================================================
-- docs/contracts-01-migration.sql
--
-- V60 Slice 9 — Contracts, Recurring Obligations, Lease Complements & SLAs
-- Built ON the existing invoice, automation, deposit liability, serial & resource
-- booking cores:
--   - `UNIQUE (contract_id, kind, period_key)` enforces max ONE billing obligation
--     per period per contract.
--   - Deposits remain customer liability (`order_deposits`), never early revenue.
--   - Leases compose optionally with `resource_bookings` (Slice 7) and `stock_serials`.
--
-- Re-runnable, additive.
-- ⚠️ NOT run by the assistant. Status: PENDING HUMAN CONFIRMATION.
-- After running, run `docs/VERIFY-contracts-01.sql`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  contract_type       text NOT NULL CHECK (contract_type IN ('service', 'subscription', 'lease', 'maintenance')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'terminated', 'expired')),
  title               text NOT NULL CHECK (length(btrim(title)) > 0),
  currency            text NOT NULL CHECK (length(btrim(currency)) BETWEEN 3 AND 8),
  amount_minor        bigint NOT NULL CHECK (amount_minor >= 0),
  deposit_minor       bigint NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0),
  billing_cadence     text NOT NULL CHECK (billing_cadence IN ('weekly', 'monthly', 'quarterly', 'annual', 'one_off')),
  start_date          date NOT NULL,
  end_date            date,
  terminated_at       timestamptz,
  sla_response_hours  integer CHECK (sla_response_hours IS NULL OR sla_response_hours > 0),
  sla_breached_at     timestamptz,
  sla_breach_reason   text,
  resource_booking_id uuid REFERENCES public.resource_bookings (id) ON DELETE SET NULL,
  serial_id           uuid REFERENCES public.stock_serials (id) ON DELETE SET NULL,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_ws_status_idx
  ON public.contracts (workspace_id, status, customer_id);

CREATE TABLE IF NOT EXISTS public.contract_obligations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  contract_id     uuid NOT NULL REFERENCES public.contracts (id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('bill', 'deliver', 'inspect', 'renew')),
  period_key      text NOT NULL CHECK (length(btrim(period_key)) > 0),
  due_date        date NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'breached')),
  invoice_id      uuid,
  idempotency_key text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  CONSTRAINT contract_obligations_unique_period UNIQUE (contract_id, kind, period_key)
);

CREATE INDEX IF NOT EXISTS contract_obligations_ws_idx
  ON public.contract_obligations (workspace_id, contract_id, status, due_date);

-- ─── RLS & Least-Privilege Grants (Supabase mandatory pattern) ────────────
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_obligations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.contracts, public.contract_obligations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.contracts, public.contract_obligations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.contracts, public.contract_obligations TO service_role;


-- ─── ROLLBACK BLOCK ──────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.contract_obligations, public.contracts;


-- ---------------------------------------------------------------------------
-- CLIENT LOCKDOWN (V61 audit, 12 Nov 2026).
--
-- These tables are reached ONLY through the backend (service_role), which
-- checks the capability of the person asking. A policy "FOR ALL TO
-- authenticated USING (workspace member)" let ANY member of the workspace —
-- a seller included — write these rows straight through the Supabase API and
-- skip every capability check (e.g. approve their own request, overwrite
-- another member's 2FA enrollment). RLS stays ON with NO policy; clients get
-- nothing. Idempotent: on a database where the earlier version of this file
-- already ran, it drops whatever policies exist on these tables.
-- ---------------------------------------------------------------------------
DO $lockdown$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY (ARRAY['contracts', 'contract_obligations'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contracts FROM PUBLIC, anon, authenticated;
ALTER TABLE public.contract_obligations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_obligations FROM PUBLIC, anon, authenticated;
