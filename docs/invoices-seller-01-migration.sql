-- ============================================================================
-- invoices-seller-01 — who sold this invoice (V61 open decision 1)
--
-- Owner decision (12 Nov 2026): the seller is a MEMBER of the business —
-- owner, manager, employee, whoever — and the owner sees each seller.
--
-- What this adds: ONE nullable column, `invoices.seller_user_id`, and an index.
--   - NULL means «the issuer sold it» (`invoices.user_id`). The application
--     writes the column only when the form names ANOTHER member, so nothing is
--     back-filled: old invoices read as their issuer's by that same rule.
--   - No foreign key. A member who leaves the business keeps the sales they
--     made; a key to `workspace_members` would either block the removal or
--     erase the history (ON DELETE SET NULL). The server proves the member is
--     current when the invoice is written (`resolveSellerOverride`).
--   - No commission column: no commission rate exists in the product, and the
--     owner has not set one.
--
-- Additive, idempotent: safe to run twice.
-- PENDING HUMAN CONFIRMATION — run in the Supabase SQL editor, then
-- docs/VERIFY-invoices-seller-01.sql.
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS seller_user_id uuid;

COMMENT ON COLUMN public.invoices.seller_user_id IS
  'The member who sold it, when not the issuer (user_id). NULL = the issuer. Owner decision 12 Nov 2026.';

-- «How much did each seller sell?» — only the overrides are indexed; the
-- issuer path already has user_id.
CREATE INDEX IF NOT EXISTS invoices_seller_idx
  ON public.invoices (workspace_id, seller_user_id)
  WHERE seller_user_id IS NOT NULL;

-- ── Rollback / mitigation ───────────────────────────────────────────────────
-- The application reads the column tolerantly (42703 → every invoice is its
-- issuer's) and names it only for an override, so dropping it is safe:
--   DROP INDEX IF EXISTS public.invoices_seller_idx;
--   ALTER TABLE public.invoices DROP COLUMN IF EXISTS seller_user_id;
-- Overrides recorded meanwhile are lost with the column.
