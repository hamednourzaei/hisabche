-- ============================================================================
-- docs/repair-quality-01-migration.sql
--
-- V71 — a repaired unit is handed over only after a PASSING quality check.
--
-- No new table. The check is a row in the ONE quality log that already exists
-- (`public.quality_events`, source_type 'repair', event_kind 'pass' / 'fail' /
-- 'rework', docs/quality-events-01-migration.sql). The LATEST of the three
-- decides; 'rework' (what the repair panel recorded before V71) counts as a fail.
--
-- This adds one guard: a trigger on `public.repair_tickets` that refuses the
-- move to 'delivered' unless that latest verdict is 'pass'. The server checks
-- the same rule first (`repairMoveRefusal` in @hisabche/validation); the
-- trigger is what makes it impossible from any other path (a direct UPDATE,
-- an old client, a sync push).
--
-- ⚠️ Effect on the live database: a ticket that is 'ready' today can no longer
-- be delivered until someone records the check on it (one click in the
-- repair panel). Tickets already 'delivered' are untouched.
--
-- Prerequisites: retail-ops-01 (repair_tickets) and quality-events-01
-- (quality_events). The preflight stops before any change if one is missing.
--
-- Additive, idempotent, re-runnable.
-- ⚠️ NOT run by the assistant. Status: PENDING HUMAN CONFIRMATION.
-- After running, run docs/VERIFY-repair-quality-01.sql.
--
-- Rollback / mitigation (manual only):
--   DROP TRIGGER IF EXISTS repair_tickets_quality_guard_trg ON public.repair_tickets;
--   DROP FUNCTION IF EXISTS public.repair_tickets_quality_guard();
-- ============================================================================

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.repair_tickets') IS NULL THEN
    v_missing := array_append(v_missing, 'table repair_tickets -> docs/retail-ops-01-migration.sql'::text);
  END IF;
  IF to_regclass('public.quality_events') IS NULL THEN
    v_missing := array_append(v_missing, 'table quality_events -> docs/quality-events-01-migration.sql'::text);
  END IF;
  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'repair-quality-01: prerequisites missing, nothing was changed. Run first: %',
      array_to_string(v_missing, ' | ')
      USING ERRCODE = 'P0001';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.repair_tickets_quality_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_latest text;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    SELECT q.event_kind
      INTO v_latest
      FROM public.quality_events q
     WHERE q.workspace_id = NEW.workspace_id
       AND q.source_type = 'repair'
       AND q.source_id = NEW.id
       AND q.event_kind IN ('pass', 'fail', 'rework')
     ORDER BY q.occurred_at DESC, q.created_at DESC
     LIMIT 1;
    IF v_latest IS DISTINCT FROM 'pass' THEN
      RAISE EXCEPTION 'REPAIR_QA_REQUIRED: ticket % has no passing quality check', NEW.id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- An internal trigger function: nobody calls it directly, service_role included.
REVOKE ALL ON FUNCTION public.repair_tickets_quality_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS repair_tickets_quality_guard_trg ON public.repair_tickets;
CREATE TRIGGER repair_tickets_quality_guard_trg
  BEFORE UPDATE OF status ON public.repair_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.repair_tickets_quality_guard();
