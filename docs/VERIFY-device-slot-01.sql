-- ============================================================================
-- docs/VERIFY-device-slot-01.sql — read-only. Run each block separately.
-- Every block must answer ok = true (block 4 lists rows only if there are any).
-- ============================================================================

-- 1. The column, the check and the unique index exist
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'slot') AS column_slot_exists,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_slot_range_chk') AS check_exists,
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = 'devices_active_slot_uq') AS index_exists;

-- 2. The index is UNIQUE and partial on active rows
SELECT indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%is_active = true%' AS ok
  FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'devices_active_slot_uq';

-- 3. No licence seat holds more than two active devices
SELECT count(*) = 0 AS ok FROM (
  SELECT license_id, seat FROM public.devices WHERE is_active = true
   GROUP BY license_id, seat HAVING count(*) > 2
) t;

-- 4. Active devices that have no numbered place (should be empty after the migration)
SELECT device_id, license_id, seat FROM public.devices
 WHERE is_active = true AND slot IS NULL AND license_id IS NOT NULL;
