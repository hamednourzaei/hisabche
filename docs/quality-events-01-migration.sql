-- ============================================================================
-- docs/quality-events-01-migration.sql
--
-- V60 Slice 11 — Immutable Quality Event Log & Warranty Claims Chain (P9)
--
-- 1. `public.quality_events` — append-only event log attaching to any
--    `receipt`, `work_order`, `delivery`, `return`, or `repair` with
--    actor_id + occurred_at. UPDATE and DELETE are blocked at the DB trigger
--    layer (`QUALITY_EVENT_IMMUTABLE`) and never granted to `authenticated`.
-- 2. `public.warranty_claims` — warranty claim records linked to `warranties`.
--
-- Re-runnable, additive.
-- ⚠️ NOT run by the assistant. Status: PENDING HUMAN CONFIRMATION.
-- After running, run `docs/VERIFY-quality-events-01.sql`.
--
-- Rollback (manual only):
--   DROP TRIGGER IF EXISTS quality_events_no_update_delete ON public.quality_events;
--   DROP FUNCTION IF EXISTS public.quality_events_immutable_guard();
--   DROP TABLE IF EXISTS public.warranty_claims;
--   DROP TABLE IF EXISTS public.quality_events;
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quality_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  source_type             text NOT NULL CHECK (source_type IN ('receipt', 'work_order', 'delivery', 'return', 'repair')),
  source_id               uuid NOT NULL,
  event_kind              text NOT NULL CHECK (event_kind IN ('check', 'pass', 'fail', 'defect', 'rework')),
  product_id              uuid REFERENCES public.products (id) ON DELETE SET NULL,
  serial_number           text,
  quantity                numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  quarantine_warehouse_id uuid REFERENCES public.warehouses (id) ON DELETE SET NULL,
  notes                   text,
  actor_id                uuid NOT NULL,
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_events_ws_source_idx
  ON public.quality_events (workspace_id, source_type, source_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.quality_events_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'QUALITY_EVENT_IMMUTABLE: quality_events is append-only and cannot be modified or deleted'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.quality_events_immutable_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quality_events_immutable_guard() TO service_role;

DROP TRIGGER IF EXISTS quality_events_no_update_delete ON public.quality_events;
CREATE TRIGGER quality_events_no_update_delete
  BEFORE UPDATE OR DELETE ON public.quality_events
  FOR EACH ROW
  EXECUTE FUNCTION public.quality_events_immutable_guard();

CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  warranty_id       uuid NOT NULL REFERENCES public.warranties (id) ON DELETE RESTRICT,
  claim_date        date NOT NULL,
  issue_description text NOT NULL CHECK (length(btrim(issue_description)) > 0),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  disposition       text NOT NULL CHECK (disposition IN ('restock', 'repair', 'scrap', 'replace')),
  repair_ticket_id  uuid,
  resolution_notes  text,
  actor_id          uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS warranty_claims_ws_idx
  ON public.warranty_claims (workspace_id, warranty_id, claim_date DESC);

-- ─── RLS & Least-Privilege Grants (Supabase mandatory pattern) ────────────
ALTER TABLE quality_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.quality_events, public.warranty_claims
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.quality_events, public.warranty_claims TO service_role;
GRANT SELECT, INSERT ON TABLE public.quality_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.warranty_claims TO service_role;


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
       AND tablename = ANY (ARRAY['quality_events', 'warranty_claims'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.quality_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quality_events FROM PUBLIC, anon, authenticated;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.warranty_claims FROM PUBLIC, anon, authenticated;
