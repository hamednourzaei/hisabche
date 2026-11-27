# Hisabche UX Reconstruction — Industry & Capability Map (Verified)

> **Phase 0 Deliverable** | Revised: `2026-11-26` | Source: `packages/validation/src/schemas/`

## 1. Honest Capability Readiness Breakdown (53 Capabilities)

Measured directly from `packages/validation/src/schemas/business-capabilities.ts`:

- **`available` (4/53):** `sales_invoice`, `weight_pricing`, `length_pricing`, `multi_unit`
- **`partial` (36/53):** `volume_pricing`, `area_pricing`, `roll_cutting`, `tiered_pricing`, `batch_expiry`, `recipe_bom`, `variants`, `table_service`, `serialized_items`, `auto_fitments`, `gold_purity`, `making_charges`, `resource_capacity`, `work_queue_sla`, `sales_orders`, `procurement_planning`, `three_way_match`, `project_costing`, `timesheet_billing`, `contracts_recurring`, `deposits_liability`, `installments`, `package_credits`, `delivery_pod`, `fleet_dispatch`, `asset_rental`, `quality_inspection`, `warranty_claims`, `cost_allocation`, `approval_workflow`, `owner_forecast`, `livestock_register`, `crop_cycle`, `currency_exchange`, `gold_trade`, `payroll_runs`
- **`planned` (13/53 — NO UI/engine wired yet):** `room_nights`, `pharmacy_prescription`, `pharmacy_dispensing`, `insurance_claims`, `optical_prescription`, `lens_order`, `laundry_item_tracking`, `fuel_tank_reconciliation`, `print_job`, `travel_booking`, `supplier_settlement`, `clinical_record`, `health_data_access`

> **Compliance Note (§6.5):** We do **not** claim full end-to-end UX coverage of all 67 industries: `retail` and `wholesale` act as onboarding sales models (not separate trade profiles), and 13 vertical capabilities remain `planned`.

## 2. Capability -> Route & Shared Core Mapping

| Shared Core / Engine                                        | Primary Routes Affected                                | Industry Composition Surface                                     |
| ----------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| `sales_invoice`, `pricing_rates`, `deposits_installments`   | `/invoices`, `/invoices/new`, `/invoices/:id`, `/till` | Unit/column emphasis, gold purity/making charges, tiered pricing |
| `inventory_catalog`, `production_bom`                       | `/warehouse`, `/warehouse/:id`, `/manufacturing`       | Batch/expiry, serialized items, variants, roll cutting, BOM      |
| `costing_ledger`, `exchange`, `forecast_insights`           | `/accounting`, `/till`, `/analysis`, `/dashboard`      | Multi-currency exchange, cost allocation, owner forecast         |
| `workforce_payroll`, `approvals_workflow`                   | `/team-and-payroll`, `/approvals`                      | Payroll runs, timesheets, approval chains                        |
| `sales_orders`, `delivery_logistics`, `contracts_recurring` | `/invoices`, `/customers`, `/customers/:id`            | Table service, POD/fleet, contracts                              |
| `assets_rental`, `quality_claims`, `agriculture_livestock`  | `/accounting`, `/warehouse`, `/operations`             | Rental/claims/agriculture extensions                             |

## 3. Architecture Separation Rule (§6.2)

1. **Industry Profile (`INDUSTRY_KEYS`, 67):** Emphasis, terminology, defaults only.
2. **Feature Packs (`PACK_IDS`, 7):** `core`, `operations`, `manufacturing`, `workforce`, `approvals`, `intelligence`, `marketplace` (`PackRouteGate` in `app-shell`).
3. **Module Locks (`NAV_MODULE`, 8 modules):** `invoices`, `parties`, `payments`, `inventory`, `accounting`, `budgets`, `people`, `workspace`.
