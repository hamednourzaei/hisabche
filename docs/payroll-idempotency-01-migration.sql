-- ============================================================================
-- docs/payroll-idempotency-01-migration.sql
--
-- Adds client_request_id column and unique index on payrolls for idempotency (BUG-NEW-010).
-- Prevents duplicate payroll creation and duplicate journal postings.
--
-- SAFE TO RE-RUN. Additive, idempotent.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payrolls'
      AND column_name = 'client_request_id'
  ) THEN
    ALTER TABLE public.payrolls ADD COLUMN client_request_id uuid NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payrolls_client_request_id
  ON public.payrolls (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- ─── ROLLBACK BLOCK ────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.idx_payrolls_client_request_id;
-- ALTER TABLE public.payrolls DROP COLUMN IF EXISTS client_request_id;
