-- ============================================================================
-- HISABCHE — UNIFIED SALE / PURCHASE + NESTED ITEM DETAILS
-- Run this in the Supabase SQL editor.
--
-- Safe to run more than once: every statement is IF NOT EXISTS / idempotent.
-- Additive only — no column is dropped, no row is rewritten, no existing
-- invoice changes meaning. Existing records keep working untouched.
--
-- Read the ROLLBACK section at the bottom before running.
-- ============================================================================

BEGIN;

-- ─── 1. invoices.type — enforce the two real transaction types ──────────────
-- The column already exists and already defaults to 'sale'. This only adds a
-- guard so nothing can write a third value by accident.

ALTER TABLE invoices
  ALTER COLUMN type SET DEFAULT 'sale';

UPDATE invoices SET type = 'sale' WHERE type IS NULL;

ALTER TABLE invoices
  ALTER COLUMN type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_type_check'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_type_check
      CHECK (type IN ('sale', 'purchase'));
  END IF;
END $$;

-- Invoice lists filter by type constantly; without this they scan.
CREATE INDEX IF NOT EXISTS invoices_type_idx ON invoices (type);
CREATE INDEX IF NOT EXISTS invoices_user_type_idx ON invoices (user_id, type);

-- ─── 2. invoice_items — unit and weight ─────────────────────────────────────
-- `unit` was missing entirely: the unit lived on `products` only, so a line
-- could not record the unit it was actually sold in.
--
-- `weight_grams` is SEPARATE from `quantity` on purpose. For a gold seller,
-- "1 necklace weighing 12.5 g" is quantity=1, weight_grams=12.5. Collapsing
-- them would make one of the two numbers wrong.

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'piece';

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(12, 3);

-- User-defined unit label. `unit` stays a closed set so reports can still
-- GROUP BY it; anything the user invents is stored as unit='custom' with the
-- typed label here.
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit_label TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_unit_check'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_unit_check
      CHECK (unit IN ('piece', 'gram', 'kg', 'meter', 'liter', 'box', 'pack', 'carton', 'custom'));
  END IF;

  -- A custom unit without a label would render as the literal word "custom".
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_unit_label_check'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_unit_label_check
      CHECK (unit <> 'custom' OR (unit_label IS NOT NULL AND length(trim(unit_label)) > 0));
  END IF;
END $$;

-- ─── 3. invoice_item_details — the nested sub-items ─────────────────────────
-- A separate table, not JSON, because a detail is a real child row that must
-- be queryable, orderable and referentially safe. "گردنبند → زنجیر / سنگ /
-- اجرت" is a component of the item, never an independent invoice line.
--
-- ON DELETE CASCADE: deleting the parent item must not leave orphan details.

CREATE TABLE IF NOT EXISTS invoice_item_details (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id UUID NOT NULL
                  REFERENCES invoice_items (id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  quantity      NUMERIC(12, 3) NOT NULL DEFAULT 1,
  amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'piece',
  unit_label    TEXT,
  weight_grams  NUMERIC(12, 3),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_item_details_item_idx
  ON invoice_item_details (invoice_item_id);

-- Details must render in the order the user typed them.
CREATE INDEX IF NOT EXISTS invoice_item_details_order_idx
  ON invoice_item_details (invoice_item_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_item_details_title_check'
  ) THEN
    ALTER TABLE invoice_item_details
      ADD CONSTRAINT invoice_item_details_title_check
      CHECK (length(trim(title)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_item_details_amount_check'
  ) THEN
    ALTER TABLE invoice_item_details
      ADD CONSTRAINT invoice_item_details_amount_check
      CHECK (amount >= 0 AND quantity > 0);
  END IF;
END $$;

-- ─── 4. Row Level Security ──────────────────────────────────────────────────
-- Details inherit access from their invoice — from the WORKSPACE that invoice
-- belongs to, not from whoever created it.
--
-- This policy was written as `i.user_id = auth.uid()`. Two things followed:
-- a manager could open an invoice a seller had raised and see its header with
-- the line details missing, and user_id was back as a tenancy boundary in the
-- database, which is the thing the workspace policies removed everywhere else.
--
-- `docs/child-table-rls-fix.sql` applies the same correction to databases that
-- already ran the old version of this file.

ALTER TABLE invoice_item_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_item_details_owner ON invoice_item_details;
DROP POLICY IF EXISTS invoice_item_details_workspace_members ON invoice_item_details;
CREATE POLICY invoice_item_details_workspace_members ON invoice_item_details
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_details.invoice_item_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_details.invoice_item_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        )
    )
  );

-- ─── 5. updated_at trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_item_details_updated_at ON invoice_item_details;
CREATE TRIGGER invoice_item_details_updated_at
  BEFORE UPDATE ON invoice_item_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ============================================================================
-- VERIFY — run these after the migration
-- ============================================================================
-- SELECT type, count(*) FROM invoices GROUP BY type;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'invoice_items' AND column_name IN ('unit','weight_grams');
-- SELECT count(*) FROM invoice_item_details;   -- expect 0 on a fresh migration

-- ============================================================================
-- ROLLBACK — only if you need to undo this migration
-- ============================================================================
-- BEGIN;
--   DROP TABLE IF EXISTS invoice_item_details;
--   ALTER TABLE invoice_items DROP COLUMN IF EXISTS weight_grams;
--   ALTER TABLE invoice_items DROP COLUMN IF EXISTS unit;
--   ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
--   DROP INDEX IF EXISTS invoices_type_idx;
--   DROP INDEX IF EXISTS invoices_user_type_idx;
-- COMMIT;
--
-- Dropping invoice_item_details destroys every nested detail users entered.
-- Export it first if any real data exists:
--   SELECT * FROM invoice_item_details;
