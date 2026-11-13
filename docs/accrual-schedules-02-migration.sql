-- ============================================================================
-- docs/accrual-schedules-02-migration.sql
--
-- V61 audit (12 Nov 2026) — an accrual schedule and its periods are written
-- in ONE transaction.
--
-- Before: `AccrualSchedulesService.create` inserted the schedule, then the
-- periods, in two supabase-js calls (CLAUDE.md rule 4). A period of 0 (a small
-- total over many periods breaks `amount_minor > 0`) failed the second insert
-- and left a schedule with no periods — which `runDue` never posts. The debit
-- and credit accounts were never checked to belong to this business.
--
-- After: `accrual_schedule_create` checks both accounts are this workspace's,
-- different, and live; checks the periods it is given add up to the total and
-- are each above zero; and writes the schedule and every period together.
-- The period plan itself stays the shared rule (`buildAccrualPeriods`).
--
-- Additive, idempotent, safe to run twice.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-accrual-schedules-02.sql).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.accrual_schedule_create(
  p_workspace_id uuid,
  p_created_by uuid,
  p_schedule jsonb,
  p_periods jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total bigint;
  v_count integer;
  v_debit uuid;
  v_credit uuid;
  v_sum bigint;
  v_rows integer;
  v_id uuid;
BEGIN
  IF p_workspace_id IS NULL OR p_schedule IS NULL OR p_periods IS NULL
     OR jsonb_typeof(p_periods) <> 'array' THEN
    RAISE EXCEPTION 'ACCRUAL_ARGUMENTS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_total := (p_schedule->>'total_amount_minor')::bigint;
  v_count := (p_schedule->>'periods_count')::integer;
  v_debit := (p_schedule->>'debit_account_id')::uuid;
  v_credit := (p_schedule->>'credit_account_id')::uuid;

  IF v_debit = v_credit THEN
    RAISE EXCEPTION 'ACCRUAL_ACCOUNTS_MUST_DIFFER' USING ERRCODE = '23514';
  END IF;
  IF (SELECT count(*) FROM public.accounts
       WHERE id IN (v_debit, v_credit)
         AND workspace_id = p_workspace_id
         AND deleted_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'ACCRUAL_ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*), COALESCE(sum((e->>'amount_minor')::bigint), 0)
    INTO v_rows, v_sum
    FROM jsonb_array_elements(p_periods) AS e;
  IF v_rows <> v_count OR v_sum <> v_total THEN
    RAISE EXCEPTION 'ACCRUAL_PERIODS_DO_NOT_ADD_UP' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_periods) AS e
     WHERE (e->>'amount_minor')::bigint <= 0
  ) THEN
    RAISE EXCEPTION 'ACCRUAL_AMOUNT_TOO_SMALL_FOR_PERIODS' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.accrual_schedules (
    workspace_id, source_document_type, source_document_id, description,
    total_amount_minor, currency, periods_count, start_date,
    debit_account_id, credit_account_id, created_by
  ) VALUES (
    p_workspace_id,
    p_schedule->>'source_document_type',
    (p_schedule->>'source_document_id')::uuid,
    p_schedule->>'description',
    v_total,
    p_schedule->>'currency',
    v_count,
    (p_schedule->>'start_date')::date,
    v_debit,
    v_credit,
    p_created_by
  )
  RETURNING id INTO v_id;

  INSERT INTO public.accrual_schedule_periods
    (workspace_id, schedule_id, period_index, period_date, amount_minor, status)
  SELECT p_workspace_id,
         v_id,
         (e->>'period_index')::integer,
         (e->>'period_date')::date,
         (e->>'amount_minor')::bigint,
         'pending'
    FROM jsonb_array_elements(p_periods) AS e;

  RETURN (
    SELECT to_jsonb(s) || jsonb_build_object(
      'periods',
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.period_index)
         FROM public.accrual_schedule_periods p WHERE p.schedule_id = v_id)
    )
    FROM public.accrual_schedules s WHERE s.id = v_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accrual_schedule_create(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accrual_schedule_create(uuid, uuid, jsonb, jsonb) TO service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- Rollback / Mitigation (manual):
--   DROP FUNCTION IF EXISTS public.accrual_schedule_create(uuid, uuid, jsonb, jsonb);
-- Without the function the backend answers 503 ACCRUAL_CREATE_NOT_INSTALLED;
-- it never falls back to the two-call write.
-- ----------------------------------------------------------------------------
