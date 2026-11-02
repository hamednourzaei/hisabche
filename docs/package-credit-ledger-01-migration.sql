-- ============================================================================
-- Hisabche Migration: Package Credit and Entitlement Ledger (M3)
-- File: docs/package-credit-ledger-01-migration.sql
--
-- RUN ORDER: Run after offering-type-01-migration.sql.
-- PENDING HUMAN CONFIRMATION — run docs/VERIFY-package-credit-ledger-01.sql after it.
--
-- WHAT IT ADDS (strictly additive, zero breaking changes to existing data):
--   Table: public.package_credit_ledger
--   Columns:
--     id, workspace_id, customer_id, package_product_id, entry_type,
--     quantity, unit, source_document_type, source_document_id, source_line_id,
--     reference_entry_id, idempotency_key, notes, expires_at, effective_date,
--     created_at, updated_at, deleted_at
--   CHECK constraint: entry_type IN ('GRANT', 'CONSUME', 'REVERSAL', 'EXPIRE', 'ADJUSTMENT')
--   Function: public.package_credit_consume(
--     p_workspace_id uuid, p_customer_id uuid, p_package_product_id uuid,
--     p_quantity numeric, p_unit text, p_idempotency_key text, p_notes text,
--     p_effective_date date, p_user_id uuid
--   )
--   Idempotency unique index per workspace.
--   Row Level Security policies scoped to workspace_id.
--
-- INVARIANTS:
--   1. Package Credit/Entitlement Truth is an append-only ledger of immutable facts.
--   2. Payment Truth and Accounting Truth remain separate and undisturbed.
--   3. Derived balance: Remaining = Grants + Adjustments + Reversals - Consumes - Expirations.
--   4. Expiration zeroes remaining entitlement without creating cash refund.
--   5. Atomic consumption prevents overdraw via row locks and immediate balance check.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_prevent_package_credit_ledger_mutation ON public.package_credit_ledger;
--   DROP FUNCTION IF EXISTS public.prevent_package_credit_ledger_mutation();
--   DROP FUNCTION IF EXISTS public.package_credit_consume(uuid, uuid, uuid, numeric, text, text, text, date, uuid);
--   DROP TABLE IF EXISTS public.package_credit_ledger CASCADE;
-- ============================================================================

DO $$
BEGIN
  -- 1. Create table if not exists
  CREATE TABLE IF NOT EXISTS public.package_credit_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    package_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    entry_type text NOT NULL,
    quantity numeric(18, 4) NOT NULL,
    unit text,
    source_document_type text,
    source_document_id uuid,
    source_line_id uuid,
    reference_entry_id uuid REFERENCES public.package_credit_ledger(id) ON DELETE SET NULL,
    idempotency_key text,
    notes text,
    expires_at timestamptz,
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );

  -- 2. Add entry_type CHECK constraint if not present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_package_credit_ledger_entry_type'
  ) THEN
    ALTER TABLE public.package_credit_ledger
      ADD CONSTRAINT chk_package_credit_ledger_entry_type
      CHECK (entry_type IN ('GRANT', 'CONSUME', 'REVERSAL', 'EXPIRE', 'ADJUSTMENT'))
      NOT VALID;

    ALTER TABLE public.package_credit_ledger
      VALIDATE CONSTRAINT chk_package_credit_ledger_entry_type;
  END IF;

  -- 3. Indexes for fast balance derivation & account queries
  CREATE INDEX IF NOT EXISTS idx_pkg_credit_ws_cust_prod
    ON public.package_credit_ledger(workspace_id, customer_id, package_product_id);

  CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_idempotency
    ON public.package_credit_ledger(workspace_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_pkg_credit_ref_entry
    ON public.package_credit_ledger(workspace_id, reference_entry_id)
    WHERE reference_entry_id IS NOT NULL;

  -- 4. Security & Permissions
  REVOKE ALL ON public.package_credit_ledger FROM PUBLIC, anon;

  -- Append-only: authenticated users can SELECT and INSERT, NEVER UPDATE or DELETE
  GRANT SELECT, INSERT ON public.package_credit_ledger TO authenticated;
  GRANT ALL ON public.package_credit_ledger TO service_role;

  ALTER TABLE public.package_credit_ledger ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'package_credit_ledger'
      AND policyname = 'package_credit_ledger_tenant_isolation'
  ) THEN
    CREATE POLICY package_credit_ledger_tenant_isolation
      ON public.package_credit_ledger
      FOR ALL
      TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id
          FROM public.workspace_members
          WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id
          FROM public.workspace_members
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5. Immutability Guard Function & Trigger: Prevents arbitrary UPDATE or DELETE on ledger rows
CREATE OR REPLACE FUNCTION public.prevent_package_credit_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'PACKAGE_CREDIT_LEDGER_IMMUTABLE: Updates and deletes are forbidden on append-only package credit ledger. Use compensating entries.'
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_package_credit_ledger_mutation ON public.package_credit_ledger;
CREATE TRIGGER trg_prevent_package_credit_ledger_mutation
  BEFORE UPDATE OR DELETE ON public.package_credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_package_credit_ledger_mutation();

-- 6. Atomic Consumption Function for PostgreSQL
CREATE OR REPLACE FUNCTION public.package_credit_consume(
  p_workspace_id uuid,
  p_customer_id uuid,
  p_package_product_id uuid,
  p_quantity numeric,
  p_unit text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_effective_date date DEFAULT CURRENT_DATE,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing record;
  v_balance numeric;
  v_new_id uuid;
  v_row record;
BEGIN
  -- Tenancy boundary check
  IF p_workspace_id IS NULL OR p_customer_id IS NULL OR p_package_product_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_CUSTOMER_PRODUCT_REQUIRED' USING ERRCODE = '22000';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE' USING ERRCODE = '22000';
  END IF;

  -- Idempotency check: if already processed, return existing row
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.package_credit_ledger
    WHERE workspace_id = p_workspace_id
      AND idempotency_key = p_idempotency_key
      AND deleted_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'workspace_id', v_existing.workspace_id,
        'customer_id', v_existing.customer_id,
        'package_product_id', v_existing.package_product_id,
        'entry_type', v_existing.entry_type,
        'quantity', v_existing.quantity,
        'unit', v_existing.unit,
        'idempotency_key', v_existing.idempotency_key,
        'notes', v_existing.notes,
        'effective_date', v_existing.effective_date,
        'created_at', v_existing.created_at,
        'is_replayed', true
      );
    END IF;
  END IF;

  -- Row-level concurrency lock on customer to serialize concurrent consumptions
  PERFORM id
  FROM public.customers
  WHERE id = p_customer_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  -- Calculate current balance from ledger:
  -- Grants + Adjustments + Reversals - Consumes - Expirations
  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
      WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity
      ELSE 0
    END
  ), 0)
  INTO v_balance
  FROM public.package_credit_ledger
  WHERE workspace_id = p_workspace_id
    AND customer_id = p_customer_id
    AND package_product_id = p_package_product_id
    AND deleted_at IS NULL;

  -- Fail-closed concurrency assertion
  IF v_balance < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_PACKAGE_CREDIT: Available balance % is less than requested %', v_balance, p_quantity
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert immutable CONSUME row
  v_new_id := gen_random_uuid();
  INSERT INTO public.package_credit_ledger (
    id, workspace_id, customer_id, package_product_id,
    entry_type, quantity, unit, idempotency_key,
    notes, effective_date, created_at, updated_at
  ) VALUES (
    v_new_id, p_workspace_id, p_customer_id, p_package_product_id,
    'CONSUME', p_quantity, p_unit, p_idempotency_key,
    p_notes, p_effective_date, now(), now()
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'workspace_id', v_row.workspace_id,
    'customer_id', v_row.customer_id,
    'package_product_id', v_row.package_product_id,
    'entry_type', v_row.entry_type,
    'quantity', v_row.quantity,
    'unit', v_row.unit,
    'idempotency_key', v_row.idempotency_key,
    'notes', v_row.notes,
    'effective_date', v_row.effective_date,
    'created_at', v_row.created_at,
    'remaining_balance', (v_balance - p_quantity),
    'is_replayed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.package_credit_consume FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.package_credit_consume TO authenticated, service_role;
