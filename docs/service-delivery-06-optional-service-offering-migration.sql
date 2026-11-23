-- ============================================================================
-- Hisabche Migration: Service Delivery — optional service catalog reference (M4.6)
-- File: docs/service-delivery-06-optional-service-offering-migration.sql
-- Status: Post-migration verification query generated - PENDING HUMAN CONFIRMATION
--
-- Needs: docs/service-delivery-01-migration.sql through -05- already applied.
-- Safety classification: ADDITIVE (widening column nullability, never narrowing).
--   No column, table, index, constraint or policy is dropped except dropping
--   the NOT NULL constraint on service_offering_id. No row is rewritten or deleted.
--   Every statement is idempotent and safe to run multiple times.
--
-- WHY
--   1. Sessions were previously forced to reference a product catalog entry
--      (service_offering_id). Users who directly describe the service/session
--      via free text (session_type) should not be blocked when no catalog item
--      is defined or synced on device.
--   2. Ensures at least one of service_offering_id or session_type is present,
--      preventing completely undefined session services.
--
-- MODEL
--   service_offering_id  UUID NULL REFERENCES public.products(id) ON DELETE RESTRICT
--                        (widened from NOT NULL to NULL)
--   Constraint chk_service_delivery_has_service:
--     service_offering_id IS NOT NULL OR (session_type IS NOT NULL AND length(trim(session_type)) > 0)
-- ============================================================================

-- ─── 1. Widen service_offering_id to NULL ──────────────────────────────────

ALTER TABLE public.service_delivery_sessions
  ALTER COLUMN service_offering_id DROP NOT NULL;

COMMENT ON COLUMN public.service_delivery_sessions.service_offering_id IS
  'Optional catalog product reference (products.offering_type = service). NULL when session is defined purely via free-text session_type.';

-- ─── 2. Row-level invariant: session must have catalog item or free-text type ─

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_has_service'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_has_service;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_has_service CHECK (
      service_offering_id IS NOT NULL OR (session_type IS NOT NULL AND length(trim(session_type)) > 0)
    ) NOT VALID;
END $$;
ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_has_service;
