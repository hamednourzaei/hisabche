-- ============================================================================
-- docs/multi-warehouse-migration.sql
--
-- Multi-warehouse (request #90).
--
-- WHY: with more than one warehouse, an invoice line did not say which
-- warehouse the goods left or arrived at, so `invoice.service#soleWarehouseId`
-- left every such movement unattributed — the product total moved, no
-- warehouse's stock did. An invoice now names its warehouse.
--
-- ADDITIVE AND SAFE TO RE-RUN:
--   * invoices.warehouse_id uuid NULL — existing invoices stay NULL (§12: which
--     building old goods left from is unknown, not guessed).
--   * warehouses.deleted_at loses its DEFAULT now(). SETUP-COMPLETE.sql showed
--     `deleted_at ... DEFAULT now()`, while every reader filters
--     `deleted_at IS NULL` — a new warehouse would be born «deleted». The code
--     now writes NULL explicitly on create; this removes the trap for any other
--     writer. No existing row is changed — see the verify query.
--
-- The backend reads/writes `invoices.warehouse_id` only when an invoice names a
-- warehouse, so deploying the code first is safe.
-- ============================================================================

BEGIN;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS warehouse_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_warehouse_id_fkey') THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS invoices_workspace_warehouse_idx
  ON invoices (workspace_id, warehouse_id) WHERE warehouse_id IS NOT NULL;

ALTER TABLE warehouses ALTER COLUMN deleted_at DROP DEFAULT;

-- Per-warehouse stock reads filter by workspace then warehouse.
CREATE INDEX IF NOT EXISTS warehouse_stock_workspace_warehouse_idx
  ON warehouse_stock (workspace_id, warehouse_id);

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--   BEGIN;
--   DROP INDEX IF EXISTS warehouse_stock_workspace_warehouse_idx;
--   DROP INDEX IF EXISTS invoices_workspace_warehouse_idx;
--   ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_warehouse_id_fkey;
--   ALTER TABLE invoices DROP COLUMN IF EXISTS warehouse_id;   -- loses which warehouse each invoice used
--   COMMIT;
-- (The deleted_at default is not restored: it was the defect.)
-- ============================================================================

-- ============================================================================
-- VERIFY (read-only) — report the output; the first three rows should be true.
--
--   SELECT 'invoices.warehouse_id exists' AS item,
--          EXISTS (SELECT 1 FROM information_schema.columns
--                  WHERE table_name = 'invoices' AND column_name = 'warehouse_id')::text AS value
--   UNION ALL
--   SELECT 'fk invoices_warehouse_id_fkey',
--          EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_warehouse_id_fkey')::text
--   UNION ALL
--   SELECT 'warehouses.deleted_at has no default',
--          (SELECT column_default IS NULL FROM information_schema.columns
--           WHERE table_name = 'warehouses' AND column_name = 'deleted_at')::text
--   UNION ALL
--   -- Diagnostic, NOT auto-fixed: warehouses whose deleted_at was set at the
--   -- moment of creation (the old default) are hidden from every screen.
--   SELECT 'warehouses deleted at creation (hidden by the old default)',
--          count(*)::text
--   FROM warehouses
--   WHERE deleted_at IS NOT NULL AND abs(extract(epoch FROM (deleted_at - created_at))) < 5;
-- ============================================================================
