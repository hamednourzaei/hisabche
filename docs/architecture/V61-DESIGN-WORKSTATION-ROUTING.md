# V61 Design Note — Workstation, Job Card & Routing

## 1. Existing Core Extended

- **`work_orders` (`services/manufacturing/`) + `resource-capacity` (`services/bookings/resource-capacity.ts`)**: A workstation is a `resource` kind (`resource_kind = 'workstation'`). Routing is an ordered list of operations attached to a BOM/work order; a job card tracks actual time/status per operation and reserves the workstation slot via exclusion constraint.

## 2. State Machine

- **Job Card:** `pending` -> `in_progress` -> `paused` -> `completed` | `cancelled`.

## 3. Tables (Additive)

- `work_order_operations (id, workspace_id, work_order_id, seq, resource_id, planned_minutes, actual_minutes, status, started_at, completed_at)` with RLS + `workspace_id`.

## 4. RPC Boundary

- `rpc_complete_work_order_operation` updates actual minutes and posts labor/machine overhead through `overhead-allocation.domain.ts` before final `work_order` completion posts finished goods to `costing`.

## 5. Offline Status

- `online_required` for workstation slot booking (backed by Postgres exclusion constraint); local timer queue possible once slot is claimed.

## 6. Verification Tests

- PG test: overlapping job cards on same workstation resource rejected by exclusion constraint.
- HTTP test: operation completion accumulates actual minutes into `work_order` cost.
