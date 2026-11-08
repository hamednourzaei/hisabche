-- ============================================================================
-- docs/provider-commission-01-migration.sql
--
-- V54 — the commission rate of each service provider (owner decision N-7: a
-- percent of the service, as a REPORT; not posted, not wired to payroll).
--
--   public.provider_commission_rates   one row per (workspace, employee):
--                                      rate in basis points (2500 = 25%).
--
-- A provider with no row has NO rate — the report says «unknown», not 0.
-- Additive, idempotent, safe to re-run. Prerequisite: none.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-provider-commission-01.sql.
--    Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.provider_commission_rates (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL,
  rate_bp      integer NOT NULL CHECK (rate_bp BETWEEN 0 AND 10000),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  PRIMARY KEY (workspace_id, employee_id)
);

REVOKE ALL ON public.provider_commission_rates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.provider_commission_rates TO service_role;
ALTER TABLE public.provider_commission_rates ENABLE ROW LEVEL SECURITY;

-- ── ROLLBACK BLOCK (manual) ────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.provider_commission_rates;
