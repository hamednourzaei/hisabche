-- ============================================
-- docs/batch-recall-migration.sql
--
-- WP-05 — a recalled batch cannot be sold.
--
-- A supplier recall, or a delivery that failed inspection, is a fact about a
-- CARTON, not about a product: the other cartons on the shelf are fine. Until
-- now the only block the system knew was the expiry date, so a recalled carton
-- stayed sellable and FEFO would happily ship it first (it is usually the
-- soonest to expire).
--
--   · recalled_at     — when it was blocked. NULL = sellable.
--   · recalled_reason — why. Required: a block nobody can explain is a block
--                       the next person undoes.
--   · recalled_by     — who blocked it (provenance for the audit entry).
--
-- The QUANTITY is deliberately untouched. The goods still exist and their value
-- still belongs on the balance sheet; what changes is that allocation refuses
-- them (the shared `planAllocation` core, on the server AND on the device).
-- Writing them off is a separate, money-moving act.
--
-- Additive and idempotent: safe to run twice. No new grants — the table
-- already carries its RLS policy and privileges (docs/traceability-migration.sql).
--
-- Rollback (bottom of this file):
--   DROP INDEX IF EXISTS public.stock_batches_recalled_idx;
--   ALTER TABLE public.stock_batches DROP CONSTRAINT IF EXISTS stock_batches_recall_complete;
--   ALTER TABLE public.stock_batches
--     DROP COLUMN IF EXISTS recalled_at,
--     DROP COLUMN IF EXISTS recalled_reason,
--     DROP COLUMN IF EXISTS recalled_by;
-- ============================================

ALTER TABLE public.stock_batches ADD COLUMN IF NOT EXISTS recalled_at timestamptz;
ALTER TABLE public.stock_batches ADD COLUMN IF NOT EXISTS recalled_reason text;
ALTER TABLE public.stock_batches ADD COLUMN IF NOT EXISTS recalled_by uuid;

-- Recalled ⇔ a reason. A block with no reason is a block nobody can defend,
-- and a reason with no block is a sentence about nothing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_batches_recall_complete'
       AND conrelid = 'public.stock_batches'::regclass
  ) THEN
    ALTER TABLE public.stock_batches
      ADD CONSTRAINT stock_batches_recall_complete CHECK (
        (
          recalled_at IS NULL
          AND recalled_reason IS NULL
        )
        OR (
          recalled_at IS NOT NULL
          AND recalled_reason IS NOT NULL
          AND length(btrim(recalled_reason)) > 0
        )
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.stock_batches VALIDATE CONSTRAINT stock_batches_recall_complete;

-- The recall queue: which batches of a workspace are blocked right now.
CREATE INDEX IF NOT EXISTS stock_batches_recalled_idx
  ON public.stock_batches (workspace_id, recalled_at)
  WHERE recalled_at IS NOT NULL;

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- Run these statements, in this order, only to undo this migration:
--
--   DROP INDEX IF EXISTS public.stock_batches_recalled_idx;
--   ALTER TABLE public.stock_batches DROP CONSTRAINT IF EXISTS stock_batches_recall_complete;
--   ALTER TABLE public.stock_batches
--     DROP COLUMN IF EXISTS recalled_at,
--     DROP COLUMN IF EXISTS recalled_reason,
--     DROP COLUMN IF EXISTS recalled_by;
