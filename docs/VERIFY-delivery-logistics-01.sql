-- ============================================================================
-- HISABCHE — VERIFY docs/delivery-logistics-01-migration.sql (WP-19)
--
-- READ-ONLY. Every query below is a SELECT; nothing here writes, and running it
-- twice changes nothing. Run it after the migration and paste the result.
--
-- ⚠️ Read the numbers, not just the ✓/✗. A check that finds rows is a finding,
-- not a failure of this script.
-- ============================================================================

-- 1. The fleet table exists with the columns the service writes.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'delivery_vehicles'
ORDER BY ordinal_position;
-- EXPECT: id, workspace_id, name, plate_number, asset_id, capacity_parcels,
--         active, last_service_on, next_service_due_on, odometer_km, notes,
--         created_at, updated_at — 13 rows.

-- 2. Its two rules are in place and VALIDATED (nothing historical can break them).
SELECT conname, convalidated
FROM pg_constraint
WHERE conrelid = 'public.delivery_vehicles'::regclass
  AND contype = 'c'
ORDER BY conname;
-- EXPECT: delivery_vehicles_capacity_positive, delivery_vehicles_odometer_non_negative
--         — both convalidated = true.

-- 3. The delivery columns exist. EXPECT: 15 rows.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'courier_deliveries'
  AND column_name IN (
    'vehicle_id', 'planned_on', 'pod_method', 'pod_recipient_name', 'pod_photo_ref',
    'pod_code', 'pod_recorded_at', 'pod_actor_user_id', 'failure_reason', 'attempt_count',
    'last_attempt_at', 'cod_collected_minor', 'cod_shortfall_minor', 'cod_settled_at',
    'client_request_id'
  )
ORDER BY column_name;

-- 4. Which rules are enforced on new rows, and which were deliberately not
--    retro-validated. EXPECT: pod_method, pod_shape, cod_collected_range and
--    shortfall_non_negative = true; delivered_has_pod and failed_has_reason = false
--    with a definition mentioning NOT VALID.
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.courier_deliveries'::regclass
  AND conname LIKE 'courier_deliveries_%'
ORDER BY conname;

-- 5. Exactly-once closing: the outbox key is unique per workspace.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'courier_deliveries'
  AND indexname IN ('courier_deliveries_request_idx', 'courier_deliveries_dispatch_idx', 'courier_deliveries_status_idx')
ORDER BY indexname;
-- EXPECT: three rows; courier_deliveries_request_idx carries WHERE client_request_id IS NOT NULL.

-- 6. Tenancy on the new table: RLS on, NO member-write policy and no client
--    grant left. The fleet register is backend-only (see the migration header).
--    EXPECT: rowsecurity = true, policies = 0, anon_privileges = '' (empty).
SELECT c.relname,
       c.relrowsecurity AS rowsecurity,
       (SELECT count(*) FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = 'delivery_vehicles') AS policies,
       coalesce((SELECT string_agg(privilege_type, ',')
                   FROM information_schema.role_table_grants g
                  WHERE g.table_schema = 'public'
                    AND g.table_name = 'delivery_vehicles'
                    AND g.grantee = 'anon'), '') AS anon_privileges
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'delivery_vehicles';

-- 7. History that the two NOT VALID rules would have refused. This is a FACT
--    about rows closed before WP-19, not a failure: they carry no proof because
--    nobody captured one. EXPECT: whatever was already in the table.
SELECT
  count(*) FILTER (WHERE status = 'delivered' AND pod_recorded_at IS NULL) AS delivered_without_proof,
  count(*) FILTER (WHERE status = 'failed' AND failure_reason IS NULL)     AS failed_without_reason,
  count(*)                                                                AS total
FROM courier_deliveries;

-- 8. Nothing was collected above what was due. EXPECT: 0 rows.
SELECT id, tracking_number, cod_amount_minor, cod_collected_minor
FROM courier_deliveries
WHERE cod_collected_minor IS NOT NULL
  AND cod_collected_minor > cod_amount_minor;

-- 9. The COD book, per delivery, for a human to eyeball: what was due, what came
--    back, what is still owed. EXPECT: rows only after the first delivery closes.
SELECT tracking_number,
       status,
       cod_amount_minor,
       cod_collected_minor,
       cod_shortfall_minor,
       cod_stage,
       cod_settled_at,
       pod_method,
       pod_recorded_at
FROM courier_deliveries
WHERE cod_amount_minor > 0
ORDER BY created_at DESC
LIMIT 50;

-- 10. The delivery-note proof columns exist. EXPECT: 6 rows.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'delivery_notes'
  AND column_name LIKE 'pod\_%'
ORDER BY column_name;

-- 11. A note that carries a proof carries a method and a person. EXPECT: 0 rows.
SELECT id, note_number, pod_method, pod_recipient_name
FROM delivery_notes
WHERE pod_recorded_at IS NOT NULL
  AND (pod_method IS NULL OR pod_recipient_name IS NULL OR length(btrim(pod_recipient_name)) = 0);
