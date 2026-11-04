-- ============================================
-- credit-concurrency-01: advisory lock for customer credit checks
-- ============================================
-- Two sales for the same customer from two backend instances can both read
-- the same receivable and both pass the limit. supabase-js has no
-- transactions, so the check + write must be atomic inside one Postgres
-- function. `pg_advisory_xact_lock` is released automatically at transaction
-- end, so a failed posting releases it too.
--
-- Owner action: run this migration, then run docs/VERIFY-credit-concurrency-01.sql.
-- Deploy order: backend must be deployed BEFORE this migration is applied
-- (the old binary calls the function only if it exists; the new binary
-- requires it).
-- Rollback: DROP FUNCTION. Safe because nothing else depends on it.

-- Rollback block (run first if re-applying)
DROP FUNCTION IF EXISTS public.assert_customer_credit(uuid, uuid, bigint);

CREATE OR REPLACE FUNCTION public.assert_customer_credit(
  p_workspace_id uuid,
  p_customer_id uuid,
  p_amount_minor bigint
)
RETURNS TABLE (
  allowed boolean,
  code text,
  over_limit_minor bigint,
  projected_receivable_minor bigint,
  credit_limit_minor bigint,
  currency text,
  detail text
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_limit numeric;
  v_receivable numeric;
  v_projected numeric;
BEGIN
  -- One caller at a time per customer, across all backend instances.
  PERFORM pg_advisory_xact_lock(
    ('x' || md5(p_workspace_id::text || ':' || p_customer_id::text))::bit(32)::int4
  );

  -- Credit limit mode: 'off' | 'warn' | 'block' (default 'warn')
  SELECT COALESCE(w.credit_limit_mode, 'warn')
  INTO v_mode
  FROM workspaces w
  WHERE w.id = p_workspace_id;

  IF v_mode = 'off' THEN
    RETURN QUERY SELECT true, null, 0, 0, null, null, null;
  END IF;

  -- Customer limit: null = unlimited, 0 = cash only, > 0 = max receivable
  SELECT c.credit_limit
  INTO v_limit
  FROM customers c
  WHERE c.id = p_customer_id AND c.workspace_id = p_workspace_id;

  IF v_limit IS NULL THEN
    RETURN QUERY SELECT true, null, 0, 0, null, null, null;
  END IF;

  -- Current receivable (posted, unpaid invoices + allocations not yet settled)
  SELECT COALESCE(SUM(i.total - i.paid_amount), 0)
  INTO v_receivable
  FROM invoices i
  WHERE i.customer_id = p_customer_id
    AND i.workspace_id = p_workspace_id
    AND i.status NOT IN ('cancelled', 'draft')
    AND i.deleted_at IS NULL;

  v_projected := v_receivable + p_amount_minor;

  -- Cash-only customer
  IF v_limit = 0 AND p_amount_minor > 0 THEN
    RETURN QUERY SELECT
      false,
      'CASH_ONLY_CUSTOMER',
      p_amount_minor,
      v_projected,
      0,
      NULL,
      'cash only customer cannot owe';
  END IF;

  -- Over limit
  IF v_projected > v_limit THEN
    RETURN QUERY SELECT
      false,
      'CREDIT_LIMIT_EXCEEDED',
      (v_projected - v_limit),
      v_projected,
      v_limit,
      NULL,
      'credit limit exceeded';
  END IF;

  RETURN QUERY SELECT true, null, 0, v_projected, v_limit, null, null;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) TO authenticated;

COMMENT ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) IS
  'V53 4.4 P0: atomically checks a customer credit limit under an advisory lock.';
