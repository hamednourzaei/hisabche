-- ============================================================================
-- docs/customer-360-phase3-migration.sql
--
-- Customer 360, phase 3: credit limit, payment terms, the customer who is also
-- a supplier, and documents attached to a customer.
--
-- ADDITIVE AND SAFE TO RE-RUN. Nothing is dropped, renamed or backfilled:
--   * credit_limit NULL        = no limit set (not "limit 0")
--   * payment_terms_days NULL  = no terms set (the invoice's own due date rules)
--   * supplier_id NULL         = not linked to a supplier
-- Existing rows keep NULL. Guessing a limit or terms for a real customer would
-- be a false claim about them (§12).
--
-- The backend reads these columns with a missing-column fallback, so deploying
-- the code before running this file is safe: the page shows «not configured».
--
-- Run in the Supabase SQL Editor, then run
-- docs/customer-360-phase3-verify.sql and report its output.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────── customers: credit and terms

ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit numeric(14,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms_days integer;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS supplier_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_credit_limit_check') THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_credit_limit_check CHECK (credit_limit IS NULL OR credit_limit >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_payment_terms_days_check') THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_payment_terms_days_check
      CHECK (payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 3650);
  END IF;
  -- A deleted supplier unlinks; it never deletes the customer.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_supplier_id_fkey') THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL;
  END IF;
END $$;

-- One supplier is the same party as at most one customer in a workspace.
CREATE UNIQUE INDEX IF NOT EXISTS customers_workspace_supplier_key
  ON customers (workspace_id, supplier_id) WHERE supplier_id IS NOT NULL;

-- ─────────────────────────────────────────────── customer_documents

-- Metadata only. The file itself lives in the private storage bucket
-- `customer-documents` under <workspace_id>/<customer_id>/<id>, and is only
-- ever handed out as a short-lived signed URL by the backend.
CREATE TABLE IF NOT EXISTS customer_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  customer_id   uuid NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    integer NOT NULL,
  uploaded_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: who removed a contract from a customer file is audit history.
  deleted_at    timestamptz,
  deleted_by    uuid,
  CONSTRAINT customer_documents_size_check CHECK (size_bytes > 0 AND size_bytes <= 5242880)
);

CREATE INDEX IF NOT EXISTS customer_documents_customer_idx
  ON customer_documents (workspace_id, customer_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

-- ⚠️ `auth_workspace_ids()` is NOT on the live database (42883 when this file
-- first ran). Same membership predicate as tenant-isolation-closure-migration.sql,
-- which is live.
DROP POLICY IF EXISTS customer_documents_ws_select ON customer_documents;
CREATE POLICY customer_documents_ws_select ON customer_documents FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS customer_documents_ws_insert ON customer_documents;
CREATE POLICY customer_documents_ws_insert ON customer_documents FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS customer_documents_ws_update ON customer_documents;
CREATE POLICY customer_documents_ws_update ON customer_documents FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));
-- No DELETE policy: rows are soft-deleted.

-- ─────────────────────────────────────────────── storage bucket (private)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('customer-documents', 'customer-documents', false, 5242880)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION (run only if needed; data in the new columns is lost)
--
--   BEGIN;
--   DROP TABLE IF EXISTS customer_documents;
--   DROP INDEX IF EXISTS customers_workspace_supplier_key;
--   ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_supplier_id_fkey;
--   ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_payment_terms_days_check;
--   ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_credit_limit_check;
--   ALTER TABLE customers DROP COLUMN IF EXISTS supplier_id;
--   ALTER TABLE customers DROP COLUMN IF EXISTS payment_terms_days;
--   ALTER TABLE customers DROP COLUMN IF EXISTS credit_limit;
--   COMMIT;
--   -- Storage objects in `customer-documents` must be removed from the
--   -- dashboard (Storage) before deleting the bucket.
--
-- Mitigation without rollback: the backend treats a missing column/table as
-- «not configured», so reverting the code is never required by this file.
-- ============================================================================
