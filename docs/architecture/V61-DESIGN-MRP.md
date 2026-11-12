# V61 Design Note — Material Requirements Planning (MRP)

## 1. Existing Core Extended

- **`computeProductionCost` + BOM + `InventoryReservationService` + `stock_insights`** (`backend/src/services/manufacturing/`, `inventory/reservation.service.ts`): Pure read-model calculation computing net material requirements: `open sales/work orders * BOM - available stock - open purchase orders`.

## 2. State Machine

- Read-only recommendation run -> optional action to generate draft `purchase_orders` (extending existing purchasing flow) or draft `work_orders`. No separate MRP document lifecycle.

## 3. Tables (if any)

- None required for Phase 1 (pure derived read model like `forecast.domain.ts`). Optional `mrp_runs` audit log if snapshots are later requested.

## 4. RPC Boundary

- Converting selected MRP suggestions into draft POs calls existing `PurchasingService.create` and `ManufacturingService.createWorkOrder`.

## 5. Offline Status

- `server_only` (depends on global cross-warehouse ATP and open PO commitments).

## 6. Verification Tests

- Unit domain test: BOM explosion across 2 levels with missing lead time returns explicit `null` expected date (`unknown-is-not-zero`), never `0`.
- HTTP test: open sales order + partial stock + open PO -> net shortage matches hand calculation.
