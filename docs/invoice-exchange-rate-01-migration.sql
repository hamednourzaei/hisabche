-- ============================================================================
-- invoice-exchange-rate-01 — the rate an invoice in another currency is booked at
-- ============================================================================
-- Additive and idempotent: safe to run twice. No row is changed.
--
-- The books (ledger, cost layers) are kept in ONE currency per business. An
-- invoice in another currency used to be booked figure for figure, as if one
-- toman were one afghani. From now on such an invoice carries the rate of its
-- day — units of the BOOKS currency per one unit of its own — and the server
-- refuses to record it without one.
--
--   exchange_rate IS NULL  → the invoice is in the books currency, OR it was
--                            made before rates were kept. NOTHING IS BACKFILLED:
--                            what an old foreign invoice was really worth is
--                            not known, and a guessed rate would be a claim.
--
-- Until this file is run, the backend refuses every invoice whose currency is
-- not the books currency (INVOICE_EXCHANGE_RATE_NOT_CONFIGURED). Invoices in
-- the books currency are not affected either way.
-- ============================================================================

BEGIN;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric(24, 10);

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_exchange_rate_positive;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_exchange_rate_positive
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

COMMENT ON COLUMN public.invoices.exchange_rate IS
  'Books currency per one unit of this invoice''s currency, on its day. NULL = books currency, or made before rates were kept.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Dropping the column forgets the rate every foreign-currency invoice was
-- booked at; their ledger entries stay as they were posted. Prefer leaving it.
--
--   BEGIN;
--   ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_exchange_rate_positive;
--   ALTER TABLE public.invoices DROP COLUMN IF EXISTS exchange_rate;
--   COMMIT;
--
-- VERIFY: docs/VERIFY-invoice-exchange-rate-01.sql
-- ============================================================================
