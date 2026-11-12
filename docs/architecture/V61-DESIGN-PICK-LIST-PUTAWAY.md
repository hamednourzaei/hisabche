# V61 Design Note — Pick List & Putaway

## 1. Existing Core Extended

- **`stock_transfers` & `storage_place_stock`** (`backend/src/services/warehouse.service.ts`, `packages/validation/src/schemas/warehouse.ts`): A pick list is a `stock_transfer` with `transfer_kind = 'pick'` moving goods from warehouse shelves to a `staging` location for a `sales_order_id`. Putaway suggests a target shelf on purchase receipt based on `storage_place_stock` remaining capacity.

## 2. State Machine

- **Pick List:** `draft` -> `picking` -> `staged` -> `completed` (consumed by delivery) | `cancelled` (returns reservation).
- **Putaway:** `suggested` -> `confirmed` (posts shelf transfer) | `overridden` (alternate shelf selected).

## 3. Tables (Additive)

- Extend `stock_transfers` with nullable `transfer_kind text CHECK (transfer_kind IN ('transfer', 'pick', 'putaway'))` and `sales_order_id uuid`.
- Capacity hint uses existing `storage_places.capacity_units` vs `SUM(storage_place_stock.quantity)`.

## 4. RPC Boundary

- `rpc_complete_pick_list(p_workspace_id, p_transfer_id)` atomically moves `storage_place_stock` from shelf to staging inside a single Postgres transaction locked in `LOCK-ORDER.md` order (`warehouses -> products -> storage_place_stock -> sales_orders`).

## 5. Offline Status

- `online_required` for multi-picker concurrency (warehouse shelf contention must serialize on server), with read-only cached pick sheets in `local-engine`.

## 6. Verification Tests

- PG test: two pickers concurrently picking last shelf units -> second fails with `INSUFFICIENT_SHELF_STOCK`.
- HTTP test: pick list created from sales order -> staged -> delivered reduces staging to 0.
