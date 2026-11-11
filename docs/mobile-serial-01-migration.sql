-- ============================================
-- docs/mobile-serial-01-migration.sql
--
-- V59.1 Mobile & Serialized Devices:
--   1. Add reserved_until (timestamptz) to public.stock_serials for expiring IMEI holds.
--   2. Atomic, row-locked RPC public.serial_hold_with_expiry that auto-clears expired
--      holds and enforces exclusive per-serial reservation across devices.
--   3. Atomic RPC public.serial_release_expired_holds to release expired holds in a workspace.
--
-- Depends on: traceability-migration.sql, retail-ops-01-migration.sql.
-- Additive and idempotent. Status: PENDING HUMAN CONFIRMATION.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS
--     public.serial_hold_with_expiry(uuid, uuid, uuid, timestamptz),
--     public.serial_release_expired_holds(uuid);
--   DROP INDEX IF EXISTS public.stock_serials_hold_expiry_idx;
--   ALTER TABLE public.stock_serials
--     DROP CONSTRAINT IF EXISTS stock_serials_reserved_expiry_only_when_reserved,
--     DROP COLUMN IF EXISTS reserved_until;
-- ============================================

BEGIN;

ALTER TABLE public.stock_serials
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

CREATE INDEX IF NOT EXISTS stock_serials_hold_expiry_idx
  ON public.stock_serials (workspace_id, status, reserved_until)
  WHERE status = 'reserved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_serials_reserved_expiry_only_when_reserved'
  ) THEN
    ALTER TABLE public.stock_serials
      ADD CONSTRAINT stock_serials_reserved_expiry_only_when_reserved
      CHECK (reserved_until IS NULL OR status = 'reserved') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.stock_serials
  VALIDATE CONSTRAINT stock_serials_reserved_expiry_only_when_reserved;

CREATE OR REPLACE FUNCTION public.serial_release_expired_holds(
  p_workspace_id uuid
)
RETURNS TABLE(released_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  RETURN QUERY
  UPDATE public.stock_serials AS ss
     SET status = 'in_stock',
         reserved_for_customer_id = NULL,
         reserved_until = NULL,
         updated_at = now()
   WHERE ss.workspace_id = p_workspace_id
     AND ss.status = 'reserved'
     AND ss.reserved_until IS NOT NULL
     AND ss.reserved_until <= now()
  RETURNING ss.id;
END
$fn$;

CREATE OR REPLACE FUNCTION public.serial_hold_with_expiry(
  p_workspace_id uuid,
  p_serial_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  status text,
  reserved_for_customer_id uuid,
  reserved_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row public.stock_serials%ROWTYPE;
BEGIN
  SELECT *
    INTO v_row
    FROM public.stock_serials AS ss
   WHERE ss.id = p_serial_id
     AND ss.workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERIAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    PERFORM 1
      FROM public.customers AS c
     WHERE c.id = p_customer_id
       AND c.workspace_id = p_workspace_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SERIAL_HOLD_CUSTOMER_NOT_FOUND' USING ERRCODE = '22023';
    END IF;

    -- Auto-release an expired reservation so waiting buyers are not blocked.
    IF v_row.status = 'reserved'
       AND v_row.reserved_until IS NOT NULL
       AND v_row.reserved_until <= now() THEN
      v_row.status := 'in_stock';
      v_row.reserved_for_customer_id := NULL;
      v_row.reserved_until := NULL;
    END IF;

    IF v_row.status <> 'in_stock' THEN
      IF v_row.status = 'reserved' THEN
        RAISE EXCEPTION 'SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER' USING ERRCODE = '40001';
      END IF;
      RAISE EXCEPTION 'SERIAL_NOT_IN_STOCK' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    UPDATE public.stock_serials AS ss
       SET status = 'reserved',
           reserved_for_customer_id = p_customer_id,
           reserved_until = p_expires_at,
           updated_at = now()
     WHERE ss.id = p_serial_id
       AND ss.workspace_id = p_workspace_id
    RETURNING ss.id, ss.status, ss.reserved_for_customer_id, ss.reserved_until;
  ELSE
    IF v_row.status <> 'reserved' THEN
      RAISE EXCEPTION 'SERIAL_NOT_HELD' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    UPDATE public.stock_serials AS ss
       SET status = 'in_stock',
           reserved_for_customer_id = NULL,
           reserved_until = NULL,
           updated_at = now()
     WHERE ss.id = p_serial_id
       AND ss.workspace_id = p_workspace_id
    RETURNING ss.id, ss.status, ss.reserved_for_customer_id, ss.reserved_until;
  END IF;
END
$fn$;

REVOKE ALL ON FUNCTION public.serial_release_expired_holds(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.serial_hold_with_expiry(uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.serial_release_expired_holds(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.serial_hold_with_expiry(uuid, uuid, uuid, timestamptz) TO service_role;
  END IF;
END $$;

COMMIT;
