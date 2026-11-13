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


REVOKE ALL ON public.repair_ticket_parts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.repair_ticket_parts TO service_role;


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
       AND tablename = ANY (ARRAY['repair_ticket_parts'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.repair_ticket_parts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repair_ticket_parts FROM PUBLIC, anon, authenticated;

COMMIT;
