-- ============================================================================
-- docs/session-deposit-01-migration.sql
--
-- V54 Phase 5.4 — a booking deposit (بیعانه‌ی نوبت) is an ORDER DEPOSIT whose
-- document is a service session.
--
-- The deposit engine already keys a deposit by «the document it is for»
-- (`order_deposits.order_id`, no FK) and books Dr cash|bank / Cr customer
-- advances; apply (Dr advances / Cr receivable) and refund are the same locked
-- Postgres functions. Nothing new is needed for the MONEY. What was missing is
-- what the document IS, so a screen can say «نوبت» instead of «سفارش»:
--
--   order_deposits.source_type   'sales_order' (default, every existing row)
--                                | 'service_session'
--
-- Additive, idempotent, safe to re-run. No row is rewritten: every existing
-- deposit was taken for an order and the default says so.
-- Prerequisite: none.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-session-deposit-01.sql.
--    Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

ALTER TABLE public.order_deposits
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'sales_order';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_deposits_source_type_known') THEN
    ALTER TABLE public.order_deposits
      ADD CONSTRAINT order_deposits_source_type_known
      CHECK (source_type IN ('sales_order', 'service_session'));
  END IF;
END $$;

-- ── ROLLBACK BLOCK (manual) ────────────────────────────────────────────────
-- ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_source_type_known;
-- ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS source_type;
