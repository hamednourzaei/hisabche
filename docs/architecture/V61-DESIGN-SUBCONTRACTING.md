# V61 Design Note — Subcontracting

## 1. Existing Core Extended

- **`PurchasingService` + `stock_transfers` + `ManufacturingService`**: Raw materials are transferred to a `supplier` warehouse/location (`warehouse_kind = 'subcontractor'`); finished goods return via a subcontracted PO receipt whose service charge + consumed component layers form the finished unit's FIFO/AVCO cost layer.

## 2. State Machine

- `subcontract_order` (PO with `is_subcontract = true`): `ordered` -> `materials_sent` -> `partially_received` -> `received` -> `billed`.

## 3. Tables (Additive)

- Extend `warehouses` with `owner_supplier_id uuid NULL`; extend `purchase_orders` with `is_subcontract boolean NOT NULL DEFAULT false` and `bom_id uuid NULL`.

## 4. RPC Boundary

- `rpc_receive_subcontract_po` atomically issues components from the subcontractor warehouse (`costing.recordIssue`), adds the subcontracting service fee, and creates the finished-good cost layer (`costing.recordReceipt`), then posts balanced GL entries via `ledger.postDocument`.

## 5. Offline Status

- `server_only` (cost-layer consumption + GL posting).

## 6. Verification Tests

- PG + HTTP test: raw material cost ($60) + supplier service invoice ($25) = finished unit cost layer ($85) with balanced GL.
