-- ============================================================================
-- docs/document-revisions-01-migration.sql
--
-- V61 B.2.22 — Field-level audit + document versioning (`document_revisions`)
--   - Append-only `document_revisions` table with NOT NULL `workspace_id` + RLS.
--   - Trigger blocks UPDATE/DELETE (`DOCUMENT_REVISIONS_IMMUTABLE`).
--   - `record_document_revision_trigger()` fires inside the same DB transaction/RPC
--     that edits `invoices`, `customers`, or `products` (skips no-op updates).
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'customer', 'product', 'purchase_order', 'stock_transfer')),
  document_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  changed_fields text[] NOT NULL,
  UNIQUE (workspace_id, document_type, document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_document_revisions_lookup
  ON document_revisions (workspace_id, document_type, document_id, version DESC);

REVOKE ALL ON document_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON document_revisions TO authenticated, service_role;
GRANT INSERT ON document_revisions TO service_role;

ALTER TABLE document_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'document_revisions' AND policyname = 'document_revisions_ws_select'
  ) THEN
    CREATE POLICY document_revisions_ws_select ON document_revisions
      FOR SELECT TO authenticated
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
           WHERE wm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.document_revisions_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'DOCUMENT_REVISIONS_IMMUTABLE: document_revisions is append-only';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.document_revisions_immutable_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_document_revisions_immutable ON document_revisions;
CREATE TRIGGER trg_document_revisions_immutable
  BEFORE UPDATE OR DELETE ON document_revisions
  FOR EACH ROW EXECUTE FUNCTION public.document_revisions_immutable_guard();

CREATE OR REPLACE FUNCTION public.record_document_revision_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc_type text := TG_ARGV[0];
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_changed text[];
  v_next_version integer;
  v_actor uuid;
BEGIN
  SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
    INTO v_changed
    FROM (
      SELECT key AS k
        FROM jsonb_object_keys(v_old || v_new) AS key
       WHERE key <> 'updated_at'
         AND (v_old -> key) IS DISTINCT FROM (v_new -> key)
    ) diff;

  IF COALESCE(array_length(v_changed, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_actor := NULLIF(current_setting('app.actor_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_actor := NULL;
  END;

  IF v_actor IS NULL AND (v_new ? 'user_id') THEN
    BEGIN
      v_actor := NULLIF(v_new ->> 'user_id', '')::uuid;
    EXCEPTION WHEN others THEN
      v_actor := NULL;
    END;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.document_revisions
   WHERE workspace_id = NEW.workspace_id
     AND document_type = v_doc_type
     AND document_id = NEW.id;

  INSERT INTO public.document_revisions (
    workspace_id, document_type, document_id, version, actor_id, before_data, after_data, changed_fields
  ) VALUES (
    NEW.workspace_id, v_doc_type, NEW.id, v_next_version, v_actor, v_old, v_new, v_changed
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_document_revision_trigger() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_invoices_document_revision ON public.invoices;
    CREATE TRIGGER trg_invoices_document_revision
      AFTER UPDATE ON public.invoices
      FOR EACH ROW EXECUTE FUNCTION public.record_document_revision_trigger('invoice');
  END IF;

  IF to_regclass('public.customers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_customers_document_revision ON public.customers;
    CREATE TRIGGER trg_customers_document_revision
      AFTER UPDATE ON public.customers
      FOR EACH ROW EXECUTE FUNCTION public.record_document_revision_trigger('customer');
  END IF;

  IF to_regclass('public.products') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_products_document_revision ON public.products;
    CREATE TRIGGER trg_products_document_revision
      AFTER UPDATE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.record_document_revision_trigger('product');
  END IF;
END $$;

-- Rollback (manual reference):
-- DROP TRIGGER IF EXISTS trg_invoices_document_revision ON public.invoices;
-- DROP TRIGGER IF EXISTS trg_customers_document_revision ON public.customers;
-- DROP TRIGGER IF EXISTS trg_products_document_revision ON public.products;
-- DROP TABLE IF EXISTS public.document_revisions;
-- DROP FUNCTION IF EXISTS public.record_document_revision_trigger();
-- DROP FUNCTION IF EXISTS public.document_revisions_immutable_guard();
