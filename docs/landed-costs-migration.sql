-- ============================================================================
-- docs/landed-costs-migration.sql
--
-- Option 13: Landed Cost Tracking
-- Tenant-isolated, additive, idempotent.
--
-- RUN ORDER: this file, then docs/VERIFY-landed-costs.sql.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.landed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  purchase_invoice_id uuid NOT NULL,
  total_landed_cost_minor bigint NOT NULL CHECK (total_landed_cost_minor > 0),
  allocation_basis text NOT NULL DEFAULT 'value' CHECK (allocation_basis IN ('value', 'quantity')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landed_cost_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  landed_cost_id uuid NOT NULL REFERENCES public.landed_costs(id) ON DELETE CASCADE,
  invoice_line_id uuid NOT NULL,
  allocated_cost_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landed_costs_workspace
  ON public.landed_costs (workspace_id);

CREATE INDEX IF NOT EXISTS idx_landed_cost_lines_cost
  ON public.landed_cost_lines (landed_cost_id);

REVOKE ALL ON public.landed_costs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.landed_cost_lines FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.landed_costs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landed_cost_lines TO service_role;

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TABLE IF EXISTS public.landed_cost_lines CASCADE;
-- DROP TABLE IF EXISTS public.landed_costs CASCADE;
