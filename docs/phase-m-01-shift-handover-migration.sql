-- ============================================================================
-- docs/phase-m-01-shift-handover-migration.sql
--
-- PHASE M · M3 — the shift handover, kept.
--
-- ---------------------------------------------------------------------------
-- WHAT IS WRONG TODAY
--
-- `closeSession` stores what was COUNTED (`counted_cash_minor`), the reason for
-- a variance, who closed it and when. Everything else on the handover —
-- opening float, cash sales, cash in and out, EXPECTED cash, and the variance
-- itself — is computed by `summarise()` at read time from the session's orders
-- and movements.
--
-- ⚠️ WHICH MEANS THE HANDOVER CHANGES AFTER IT IS SIGNED.
--
-- Void an order from a closed session and the expected cash for that shift
-- silently becomes a different number. The person who counted the drawer and
-- signed off a variance of 200 can be shown a variance of 900 a week later,
-- with nothing recording that it moved.
--
-- A handover is a statement about a moment. It has to be frozen at that moment.
--
-- ---------------------------------------------------------------------------
-- ⚠️ ADDITIVE, AND NOTHING IS BACKFILLED
--
-- Sessions closed before this migration keep NULL in the new columns. Their
-- figures can still be recomputed exactly as they are today — the reader falls
-- back when the frozen value is absent.
--
-- Backfilling would compute today's answer and stamp it as though it had been
-- recorded at close, which is precisely the retroactive number this migration
-- exists to prevent (§12).
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   ALTER TABLE pos_sessions
--     DROP COLUMN IF EXISTS expected_cash_minor,
--     DROP COLUMN IF EXISTS cash_sales_minor,
--     DROP COLUMN IF EXISTS cash_in_minor,
--     DROP COLUMN IF EXISTS cash_out_minor,
--     DROP COLUMN IF EXISTS variance_minor;
--
-- ⚠️ That discards the frozen handovers and returns every closed shift to a
-- figure recomputed from data that may have moved since.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. Which of these columns already exist? (Expected: none.)
--
--   SELECT column_name FROM information_schema.columns
--   WHERE  table_name = 'pos_sessions'
--     AND  column_name IN ('expected_cash_minor', 'cash_sales_minor',
--                          'cash_in_minor', 'cash_out_minor', 'variance_minor');
--
-- P2. How many closed sessions will keep NULL? These are the shifts whose
--     figures remain recomputed rather than frozen — nothing is backfilled.
--
--   SELECT status, COUNT(*) FROM pos_sessions GROUP BY status ORDER BY 2 DESC;
--
-- ============================================================================

BEGIN;

ALTER TABLE pos_sessions
  ADD COLUMN IF NOT EXISTS expected_cash_minor bigint,
  ADD COLUMN IF NOT EXISTS cash_sales_minor    bigint,
  ADD COLUMN IF NOT EXISTS cash_in_minor       bigint,
  ADD COLUMN IF NOT EXISTS cash_out_minor      bigint,
  ADD COLUMN IF NOT EXISTS variance_minor      bigint;

COMMENT ON COLUMN pos_sessions.expected_cash_minor IS
  'M3 — what the drawer SHOULD have held, frozen at close. Recomputing it later would let a voided order silently change a handover somebody already signed. NULL on sessions closed before this migration; the reader falls back to recomputing for those.';

COMMENT ON COLUMN pos_sessions.variance_minor IS
  'M3 — counted − expected, in minor units, frozen at close. The figure the closing actor actually signed off against.';

COMMENT ON COLUMN pos_sessions.cash_sales_minor IS
  'M3 — cash taken in sales during the shift, frozen at close.';

COMMENT ON COLUMN pos_sessions.cash_in_minor IS
  'M3 — cash paid into the drawer other than by sale (a float top-up), frozen at close.';

COMMENT ON COLUMN pos_sessions.cash_out_minor IS
  'M3 — cash removed from the drawer (a drop, a payout), frozen at close.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. All five columns exist and are nullable.
--
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE  table_name = 'pos_sessions'
--     AND  column_name IN ('expected_cash_minor', 'cash_sales_minor',
--                          'cash_in_minor', 'cash_out_minor', 'variance_minor')
--   ORDER  BY column_name;
--
-- V2. ⚠️ NOTHING WAS BACKFILLED. Every pre-existing session still has NULL.
--
--   SELECT COUNT(*) AS frozen FROM pos_sessions WHERE expected_cash_minor IS NOT NULL;
--   -- expect 0 immediately after the migration
--
-- V3. AFTER THE NEXT SHIFT IS CLOSED — the handover was frozen, and the
--     variance stored equals counted − expected.
--
--   SELECT id, opening_float_minor, cash_sales_minor, cash_in_minor,
--          cash_out_minor, expected_cash_minor, counted_cash_minor,
--          variance_minor,
--          (counted_cash_minor - expected_cash_minor) AS recomputed_variance
--   FROM   pos_sessions
--   WHERE  status IN ('closed', 'force_closed') AND expected_cash_minor IS NOT NULL
--   ORDER  BY closed_at DESC LIMIT 5;
--   -- variance_minor must equal recomputed_variance on every row
--
-- ============================================================================
