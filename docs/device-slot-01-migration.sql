-- ============================================================================
-- docs/device-slot-01-migration.sql
--
-- 25C — the offline licence's device cap, enforced by the DATABASE.
--
-- The cap is OFFLINE_SEATS_PER_KIND = 2 devices per kind (computer / mobile), so
-- four per licence. The service used to read the active devices and then insert:
-- two activations at the same moment both saw room and both inserted.
--
-- Each active device now holds a numbered place (1 or 2) on its seat, and the
-- index below lets only ONE active device hold a given place. A concurrent second
-- activation of the same place gets 23505 and is answered by the service.
--
-- SAFE TO RE-RUN. Additive, idempotent. No row is deleted or deactivated.
-- ⚠️ Run docs/VERIFY-device-slot-01.sql afterwards. NOT run by the assistant.
-- ============================================================================

BEGIN;

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS slot smallint;

-- A place is 1 or 2 (OFFLINE_SEATS_PER_KIND). NULL = a row from before this migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_slot_range_chk') THEN
    ALTER TABLE public.devices
      ADD CONSTRAINT devices_slot_range_chk CHECK (slot IS NULL OR slot BETWEEN 1 AND 2);
  END IF;
END $$;

-- Number the places of devices that are already active: the longest-installed
-- device on a seat is place 1, the next place 2. A seat with MORE than two active
-- devices (the old model allowed one; anything above two is damage) is left
-- un-numbered above the second — it is reported by the VERIFY file, never changed.
WITH ranked AS (
  SELECT device_id,
         row_number() OVER (PARTITION BY license_id, seat ORDER BY activated_at, device_id) AS place
    FROM public.devices
   WHERE is_active = true AND slot IS NULL AND license_id IS NOT NULL AND seat IS NOT NULL
)
UPDATE public.devices d
   SET slot = ranked.place
  FROM ranked
 WHERE d.device_id = ranked.device_id
   AND ranked.place <= 2
   AND NOT EXISTS (
     SELECT 1 FROM public.devices o
      WHERE o.license_id = d.license_id AND o.seat = d.seat AND o.is_active = true
        AND o.slot = ranked.place AND o.device_id <> d.device_id
   );

-- The invariant: one active device per numbered place on a licence's seat.
CREATE UNIQUE INDEX IF NOT EXISTS devices_active_slot_uq
  ON public.devices (license_id, seat, slot)
  WHERE is_active = true AND slot IS NOT NULL;

COMMIT;

-- ─── ROLLBACK BLOCK ────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.devices_active_slot_uq;
-- ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_slot_range_chk;
-- ALTER TABLE public.devices DROP COLUMN IF EXISTS slot;
