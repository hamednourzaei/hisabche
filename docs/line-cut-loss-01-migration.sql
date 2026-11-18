-- ============================================================================
-- HISABCHE — WP-03 · «پرت برش» ON AN INVOICE LINE (CUT LOSS)
-- Run this in the Supabase SQL editor.
--
-- WHAT IT ADDS
--   `invoice_items.cut_loss_quantity` — the material that left the shelf with
--   this line and was NOT sold: a frayed end, a crooked cut, a damaged piece
--   trimmed away. It is in the LINE's unit.
--
--   The model, and nothing beyond it:
--
--     quantity            what the customer bought and pays for
--     cut_loss_quantity   what left the shelf beside it and was not sold
--
--   STOCK moves by `quantity + cut_loss_quantity`; MONEY never sees the loss.
--   The cost of the offcut is therefore part of what this sale consumed, which
--   is exactly where a shopkeeper looks for it (the line's margin goes down).
--
-- SAFE TO RUN MORE THAN ONCE — every statement is IF NOT EXISTS / idempotent.
-- ADDITIVE — no column is dropped, no row is rewritten. Every existing invoice
-- gets 0, which means «no loss was recorded» and keeps its exact behaviour.
--
-- Read the ROLLBACK section at the bottom before running.
-- ============================================================================

BEGIN;

-- ─── 1. The column ──────────────────────────────────────────────────────────
-- NUMERIC(12, 3) for the same reason `weight_grams` uses it: a shop weighs and
-- measures to the gram and the millimetre, and 3 decimals is the precision the
-- invoice grid already displays. NOT NULL DEFAULT 0 so every historical row
-- answers «no loss» without a backfill (CLAUDE.md §12 — no guessed history).
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS cut_loss_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0;

-- ─── 2. A loss cannot be negative ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_cut_loss_non_negative'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_cut_loss_non_negative
      CHECK (cut_loss_quantity >= 0) NOT VALID;
  END IF;
END $$;

-- ─── 3. A cut loss is a MEASUREMENT, never a count ──────────────────────────
-- «2 pieces, 1 of them lost» is a stock adjustment with its own document, not a
-- cut. The server and the offline engine refuse it (`cutLossIssue`); this says
-- the same thing where no application code can be bypassed.
--
-- The allowed list mirrors `invoice_items_unit_check` (the units a line may
-- name). `custom` is allowed because its dimension is unknown — the person
-- typed the word, and the figure is still a quantity in that same unit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_cut_loss_measured_unit'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_cut_loss_measured_unit
      CHECK (
        cut_loss_quantity = 0
        OR unit IN ('gram', 'kg', 'meter', 'liter', 'custom')
      ) NOT VALID;
  END IF;
END $$;

-- Validate only now that the rules are in place: the two passes are what let a
-- live table take the constraint without holding a lock over every row twice.
ALTER TABLE invoice_items VALIDATE CONSTRAINT invoice_items_cut_loss_non_negative;
ALTER TABLE invoice_items VALIDATE CONSTRAINT invoice_items_cut_loss_measured_unit;

COMMENT ON COLUMN invoice_items.cut_loss_quantity IS
  'WP-03 «پرت برش»: material that left the shelf with this line and was not sold, in the line unit. Stock and cost of goods sold include it; the invoice total does not. 0 = no loss recorded.';

COMMIT;

-- ============================================================================
-- ROLLBACK
--
-- ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_cut_loss_measured_unit;
-- ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_cut_loss_non_negative;
-- ALTER TABLE invoice_items DROP COLUMN IF EXISTS cut_loss_quantity;
--
-- No data is lost by the rollback that this migration created: the column is
-- the only thing it adds. A line that recorded a loss keeps its `quantity`, and
-- the stock movements it wrote are the source of truth for what the shelf lost
-- (they are not touched by this rollback).
-- ============================================================================
