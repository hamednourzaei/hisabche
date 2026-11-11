-- ============================================
-- docs/repair-parts-01-migration.sql
--
-- V59.1 Repair Tickets & Spare Parts:
--   1. Add customer_approved (+ actor/timestamp) on public.repair_tickets so
--      canConsumePartsOnRepair gates consumption until diagnosis & approval.
--   2. Add public.repair_ticket_parts tracking ATP reservation -> real-use
--      inventory consumption -> final billing on each repair slip.
--   3. RLS + REVOKE ALL on repair_ticket_parts.
--
-- Depends on: retail-ops-01-migration.sql, stock-reservations-01-migration.sql.
-- Additive and idempotent. Status: PENDING HUMAN CONFIRMATION.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.repair_ticket_parts;
--   ALTER TABLE public.repair_tickets
--     DROP COLUMN IF EXISTS customer_approved,
--     DROP COLUMN IF EXISTS customer_approved_at,
--     DROP COLUMN IF EXISTS customer_approved_by;
-- ============================================

BEGIN;

ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS customer_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_approved_by uuid;

CREATE TABLE IF NOT EXISTS public.repair_ticket_parts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  ticket_id        uuid NOT NULL REFERENCES public.repair_tickets (id) ON DELETE CASCADE,
  warehouse_id     uuid NOT NULL,
  product_id       uuid NOT NULL,
  quantity         numeric NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  unit_cost_minor  bigint,
  currency         text NOT NULL,
  reservation_id   uuid,
  status           text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'consumed', 'released')),
  consumed_at      timestamptz,
  consumed_by      uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repair_ticket_parts_ticket_idx
  ON public.repair_ticket_parts (workspace_id, ticket_id, status, created_at);

ALTER TABLE repair_ticket_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repair_ticket_parts_tenant ON repair_ticket_parts;
CREATE POLICY repair_ticket_parts_tenant ON repair_ticket_parts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = repair_ticket_parts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = repair_ticket_parts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  );

REVOKE ALL ON public.repair_ticket_parts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.repair_ticket_parts TO service_role;

COMMIT;
