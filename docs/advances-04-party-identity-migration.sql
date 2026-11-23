-- ============================================================================
-- docs/advances-04-party-identity-migration.sql
--
-- پیش‌خرید و تفکیک هویتی طرف حساب در پیش‌پرداخت‌ها (Pre-purchase / Party Identity)
-- Safety classification: ADDITIVE | DATA_BACKFILL
--
-- Solves Defect D-1:
-- A supplier advance (pre_purchase) was previously storing the supplier's UUID
-- in order_deposits.customer_id because order_deposits lacked a supplier_id column.
--
-- This migration:
-- 1. Adds `supplier_id` column referencing `public.suppliers(id)`.
-- 2. Relaxes `customer_id` to NULLABLE so supplier advances do not violate customer constraints.
-- 3. Backfills existing `pre_purchase` records where the stored party ID exists
--    in `public.suppliers` for that workspace.
-- 4. Enforces party identity on the write that sets it (triggers, not a CHECK):
--    - `pre_purchase`  → supplier_id required, customer_id must be NULL
--    - every other kind → customer_id required, supplier_id must be NULL
--    A CHECK would also fire on every UPDATE of the row, which would make an
--    unresolved historical row impossible to post, apply or refund. The trigger
--    fires on INSERT, and on UPDATE only when the party columns themselves
--    change. See section 5 for the full reasoning.
--
-- Unresolved historical rows are tolerated on purpose and stay visible through
-- docs/FINDING-advances-party-identity.sql. They are never re-pointed by guess.
--
-- Status: PENDING HUMAN CONFIRMATION
-- After running, run `docs/VERIFY-advances-04-party-identity.sql`.
--
-- DEPLOY ORDER — the migration and the backend go out in the SAME window.
-- There is no order in which one alone keeps pre_purchase working:
--   * migration first, old backend → the trigger refuses its inserts, because
--     it still writes the supplier into customer_id;
--   * backend first, migration absent → customer_id is still NOT NULL and the
--     new pre_purchase insert (customer_id NULL, supplier_id set) is refused.
-- During the changeover, creating a pre_purchase advance fails loudly. It is
-- never silently stored under the wrong role.
-- ============================================================================

-- ── 1. Add supplier_id column ────────────────────────────────────────────────
ALTER TABLE public.order_deposits
  ADD COLUMN IF NOT EXISTS supplier_id uuid;

-- The FK is added explicitly. `ADD COLUMN IF NOT EXISTS` is a no-op when the
-- column is already there, so an inline REFERENCES would silently skip the
-- constraint on a re-run or on a partially applied database.
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_deposits_supplier_id_fkey'
      AND conrelid = 'public.order_deposits'::regclass
  ) THEN
    ALTER TABLE public.order_deposits
      ADD CONSTRAINT order_deposits_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;
  END IF;
END
$fk$;

-- ── 2. Allow customer_id to be NULL for supplier advances ────────────────────
ALTER TABLE public.order_deposits
  ALTER COLUMN customer_id DROP NOT NULL;

-- ── 3. Deterministic Data Backfill ───────────────────────────────────────────
-- Only backfill rows where the stored customer_id demonstrably matches a real supplier
-- in the exact same workspace. Unresolved rows remain untouched.
UPDATE public.order_deposits od
SET
  supplier_id = od.customer_id,
  customer_id = NULL
FROM public.suppliers s
WHERE od.source_type = 'pre_purchase'
  AND od.supplier_id IS NULL
  AND od.customer_id = s.id
  AND od.workspace_id = s.workspace_id;

-- ── 4. Add index on supplier_id ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_deposits_supplier_id
  ON public.order_deposits (workspace_id, supplier_id)
  WHERE supplier_id IS NOT NULL;

-- ── 5. Party identity enforcement (on the write that sets the party) ─────────
--
-- This is a trigger, not a CHECK constraint, and the reason is operational.
--
-- A CHECK is re-evaluated on every UPDATE of the row. Historical pre_purchase
-- rows whose party id exists only in `customers` cannot be mapped with
-- certainty, so they stay unresolved on purpose. A CHECK would make such a row
-- impossible to post, apply or refund until somebody resolved it by hand —
-- turning a reporting problem into a stuck money operation.
--
-- The rule belongs to the write that creates the party, so:
--   * BEFORE INSERT  — always enforced;
--   * BEFORE UPDATE OF source_type, customer_id, supplier_id — enforced when a
--     write actually changes the party, ignored when it only moves
--     posting_status / applied_invoice_id / note.
--
-- It raises 23514 (check_violation), the same class a CHECK would raise, and
-- names `order_deposits_party_check` so a caller can recognise it.

CREATE OR REPLACE FUNCTION public.order_deposits_assert_party_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.source_type = 'pre_purchase' THEN
    IF NEW.supplier_id IS NULL OR NEW.customer_id IS NOT NULL THEN
      RAISE EXCEPTION
        'order_deposits_party_check: a pre_purchase advance needs supplier_id and no customer_id'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.customer_id IS NULL OR NEW.supplier_id IS NOT NULL THEN
      RAISE EXCEPTION
        'order_deposits_party_check: a % deposit needs customer_id and no supplier_id',
        NEW.source_type
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.order_deposits_assert_party_identity()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_deposits_party_identity_ins ON public.order_deposits;
CREATE TRIGGER order_deposits_party_identity_ins
  BEFORE INSERT ON public.order_deposits
  FOR EACH ROW EXECUTE FUNCTION public.order_deposits_assert_party_identity();

DROP TRIGGER IF EXISTS order_deposits_party_identity_upd ON public.order_deposits;
CREATE TRIGGER order_deposits_party_identity_upd
  BEFORE UPDATE OF source_type, customer_id, supplier_id ON public.order_deposits
  FOR EACH ROW EXECUTE FUNCTION public.order_deposits_assert_party_identity();

-- ============================================================================
-- ROLLBACK BLOCK
-- ============================================================================
-- DROP TRIGGER IF EXISTS order_deposits_party_identity_upd ON public.order_deposits;
-- DROP TRIGGER IF EXISTS order_deposits_party_identity_ins ON public.order_deposits;
-- DROP FUNCTION IF EXISTS public.order_deposits_assert_party_identity();
-- DROP INDEX IF EXISTS public.idx_order_deposits_supplier_id;
-- UPDATE public.order_deposits SET customer_id = supplier_id, supplier_id = NULL WHERE source_type = 'pre_purchase' AND supplier_id IS NOT NULL;
-- ALTER TABLE public.order_deposits ALTER COLUMN customer_id SET NOT NULL;
-- ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS supplier_id;
-- ============================================================================
