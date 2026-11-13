-- ============================================================================
-- docs/hr-org-appraisal-01-migration.sql
--
-- V61 B.2.17 — Employee file documents, org chart (`reports_to` cycle guard),
--              and immutable periodic appraisals
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS reports_to uuid REFERENCES public.employees(id);

CREATE OR REPLACE FUNCTION public.employees_org_cycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_curr uuid;
  v_depth int := 0;
BEGIN
  IF NEW.reports_to IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.reports_to = NEW.id THEN
    RAISE EXCEPTION 'ORG_CYCLE_DETECTED: employee cannot report to self';
  END IF;
  v_curr := NEW.reports_to;
  WHILE v_curr IS NOT NULL AND v_depth < 100 LOOP
    IF v_curr = NEW.id THEN
      RAISE EXCEPTION 'ORG_CYCLE_DETECTED: cycle in employees.reports_to';
    END IF;
    SELECT reports_to INTO v_curr
      FROM public.employees
     WHERE id = v_curr AND workspace_id = NEW.workspace_id;
    v_depth := v_depth + 1;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.employees_org_cycle_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_employees_org_cycle ON public.employees;
CREATE TRIGGER trg_employees_org_cycle
  BEFORE INSERT OR UPDATE OF reports_to ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_org_cycle_guard();

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'document',
  file_url text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  period text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.employee_appraisals_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'APPRAISALS_IMMUTABLE: employee_appraisals is append-only';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.employee_appraisals_immutable_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_employee_appraisals_immutable ON public.employee_appraisals;
CREATE TRIGGER trg_employee_appraisals_immutable
  BEFORE UPDATE OR DELETE ON public.employee_appraisals
  FOR EACH ROW EXECUTE FUNCTION public.employee_appraisals_immutable_guard();

REVOKE ALL ON public.employee_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.employee_appraisals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.employee_documents TO service_role;
GRANT SELECT, INSERT ON public.employee_appraisals TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_appraisals ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TRIGGER IF EXISTS trg_employees_org_cycle ON public.employees;
-- DROP TABLE IF EXISTS public.employee_appraisals;
-- DROP TABLE IF EXISTS public.employee_documents;


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
       AND tablename = ANY (ARRAY['employee_documents', 'employee_appraisals'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_documents FROM PUBLIC, anon, authenticated;
ALTER TABLE public.employee_appraisals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_appraisals FROM PUBLIC, anon, authenticated;
