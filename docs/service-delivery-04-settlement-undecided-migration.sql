-- ============================================================================
-- Hisabche Migration: Service Delivery - a booking has no settlement yet (M4.3)
-- File: docs/service-delivery-04-settlement-undecided-migration.sql
-- Status: Post-migration verification query generated - PENDING HUMAN CONFIRMATION
--
-- Needs: docs/service-delivery-01-migration.sql, -02- and -03- already applied.
-- Additive and idempotent. No row is rewritten or deleted.
--
-- WHY
--   `settlement_method` was `NOT NULL DEFAULT 'package_credit'`. A session created
--   at booking time therefore claimed a settlement nobody had chosen: the row
--   and the screen said «اعتبار بسته» for a service that had not been delivered.
--   `undecided` says what is true - no method has been chosen yet.
--
--   The deliver function (docs/service-delivery-02-atomic-migration.sql) already
--   accepts only the three real methods and raises SETTLEMENT_METHOD_REQUIRED
--   otherwise, so an `undecided` session can never be delivered without a choice.
--   This migration only widens the column and moves its default.
--
-- DEPLOY ORDER
--   Backend first, or together. The new backend writes `undecided` and refuses
--   to deliver such a row; an old backend keeps writing 'package_credit', which
--   is still allowed. This file alone changes no behaviour.
-- ============================================================================

-- 1. New rows are born with no settlement. Existing rows keep what they hold.
ALTER TABLE public.service_delivery_sessions
  ALTER COLUMN settlement_method SET DEFAULT 'undecided';

-- 2. The check accepts the fourth, non-money state. DROP + ADD inside one DO so a
--    second run converges; NOT VALID first, then VALIDATE (rule: no constraint
--    is trusted before the rows are checked).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_service_delivery_settlement'
       AND conrelid = 'public.service_delivery_sessions'::regclass
  ) THEN
    ALTER TABLE public.service_delivery_sessions
      DROP CONSTRAINT chk_service_delivery_settlement;
  END IF;

  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_settlement CHECK (
      settlement_method IN ('undecided', 'package_credit', 'invoice', 'complementary')
    ) NOT VALID;
END $$;

ALTER TABLE public.service_delivery_sessions
  VALIDATE CONSTRAINT chk_service_delivery_settlement;

COMMENT ON COLUMN public.service_delivery_sessions.settlement_method IS
  'undecided = a booking with no settlement chosen. The three money methods are written only by service_delivery_deliver.';

-- ============================================================================
-- Rollback / mitigation
-- ============================================================================
/*
-- Rows written as 'undecided' must be given a real method BEFORE the narrower
-- check can hold; the ALTER below is refused while any of them exists.
ALTER TABLE public.service_delivery_sessions
  ALTER COLUMN settlement_method SET DEFAULT 'package_credit';

ALTER TABLE public.service_delivery_sessions
  DROP CONSTRAINT IF EXISTS chk_service_delivery_settlement;

ALTER TABLE public.service_delivery_sessions
  ADD CONSTRAINT chk_service_delivery_settlement CHECK (
    settlement_method IN ('package_credit', 'invoice', 'complementary')
  ) NOT VALID;

ALTER TABLE public.service_delivery_sessions
  VALIDATE CONSTRAINT chk_service_delivery_settlement;
*/
