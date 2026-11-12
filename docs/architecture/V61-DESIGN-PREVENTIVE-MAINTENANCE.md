# V61 Design Note — Preventive Maintenance

## 1. Existing Core Extended

- **`assets` + `resource-capacity` + `repair_tickets` (`ticket_kind = 'maintenance'`)**: A preventive maintenance schedule generates a service/repair ticket when due and books a maintenance window on the underlying asset/workstation resource so production job cards cannot double-book it.

## 2. State Machine

- **Schedule:** `active` -> `paused` -> `retired`.
- **Generated Ticket:** follows existing `REPAIR_STATUSES` (`received` -> `repairing` -> `ready` -> `delivered`).

## 3. Tables (Additive)

- `maintenance_schedules (id, workspace_id, asset_id, resource_id, interval_days, next_due_date, duration_minutes, active)` with RLS + `workspace_id`.

## 4. RPC Boundary

- Worker cron (`PROCESS_ROLE=worker`) claims due schedules (`FOR UPDATE SKIP LOCKED`), inserts a `repair_tickets` row and a `resource_bookings` maintenance block inside one transaction.

## 5. Offline Status

- `server_only` for schedule generation; generated tickets visible in offline work queue.

## 6. Verification Tests

- PG test: schedule due creates ticket + resource block idempotently (second run is no-op).
- HTTP test: booked maintenance window blocks overlapping workstation booking.
