# ماتریس قابلیت‌ها

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

| قابلیت                 | وضعیت رجیستری | برچسب                     | موتور                    | آفلاین موتور    | صنف‌هایی که روشنش دارند |
| ---------------------- | ------------- | ------------------------- | ------------------------ | --------------- | ----------------------- |
| `measurement`          | available     | `EXISTING_AND_VERIFIED`   | `sales_invoice`          | available       | 23                      |
| `weight_pricing`       | available     | `EXISTING_AND_VERIFIED`   | `sales_invoice`          | available       | 1                       |
| `length_pricing`       | partial       | `EXISTING_BUT_INCOMPLETE` | `sales_invoice`          | available       | ۰                       |
| `volume_pricing`       | partial       | `EXISTING_BUT_INCOMPLETE` | `sales_invoice`          | available       | ۰                       |
| `area_pricing`         | partial       | `EXISTING_BUT_INCOMPLETE` | `sales_invoice`          | available       | ۰                       |
| `roll_cutting`         | partial       | `EXISTING_BUT_INCOMPLETE` | —                        | —               | ۰                       |
| `tiered_pricing`       | partial       | `EXISTING_BUT_INCOMPLETE` | `pricing_rates`          | available       | ۰                       |
| `multi_unit`           | available     | `EXISTING_AND_VERIFIED`   | `sales_invoice`          | available       | 39                      |
| `batch_expiry`         | partial       | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog`      | partial         | 7                       |
| `recipe_bom`           | partial       | `EXISTING_BUT_INCOMPLETE` | `production_bom`         | online_required | ۰                       |
| `variants`             | partial       | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog`      | partial         | 12                      |
| `table_service`        | planned       | `NEW_CAPABILITY_REQUIRED` | —                        | —               | ۰                       |
| `serialized_items`     | partial       | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog`      | partial         | 8                       |
| `auto_fitments`        | partial       | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog`      | partial         | 2                       |
| `gold_purity`          | partial       | `EXISTING_BUT_INCOMPLETE` | `pricing_rates`          | available       | ۰                       |
| `making_charges`       | partial       | `EXISTING_BUT_INCOMPLETE` | `pricing_rates`          | available       | ۰                       |
| `resource_capacity`    | partial       | `EXISTING_BUT_INCOMPLETE` | `appointments_resources` | partial         | ۰                       |
| `work_queue_sla`       | partial       | `EXISTING_BUT_INCOMPLETE` | `work_orders_repair`     | partial         | 1                       |
| `sales_orders`         | partial       | `EXISTING_BUT_INCOMPLETE` | `sales_orders`           | online_required | ۰                       |
| `procurement_planning` | partial       | `EXISTING_BUT_INCOMPLETE` | `procurement`            | available       | ۰                       |
| `three_way_match`      | partial       | `EXISTING_BUT_INCOMPLETE` | `procurement`            | available       | ۰                       |
| `project_costing`      | partial       | `EXISTING_BUT_INCOMPLETE` | `projects_time`          | online_required | ۰                       |
| `timesheet_billing`    | partial       | `EXISTING_BUT_INCOMPLETE` | `projects_time`          | online_required | ۰                       |
| `contracts_recurring`  | partial       | `EXISTING_BUT_INCOMPLETE` | `contracts_recurring`    | online_required | ۰                       |
| `deposits_liability`   | partial       | `EXISTING_BUT_INCOMPLETE` | `deposits_installments`  | available       | ۰                       |
| `installments`         | partial       | `EXISTING_BUT_INCOMPLETE` | `deposits_installments`  | available       | ۰                       |
| `package_credits`      | partial       | `EXISTING_BUT_INCOMPLETE` | `package_credits`        | partial         | 1                       |
| `delivery_pod`         | partial       | `EXISTING_BUT_INCOMPLETE` | `delivery_logistics`     | online_required | ۰                       |
| `fleet_dispatch`       | partial       | `EXISTING_BUT_INCOMPLETE` | `delivery_logistics`     | online_required | ۰                       |
| `asset_rental`         | planned       | `NEW_CAPABILITY_REQUIRED` | —                        | —               | ۰                       |
| `quality_inspection`   | partial       | `EXISTING_BUT_INCOMPLETE` | `quality_claims`         | partial         | ۰                       |
| `warranty_claims`      | partial       | `EXISTING_BUT_INCOMPLETE` | `quality_claims`         | partial         | ۰                       |
| `cost_allocation`      | partial       | `EXISTING_BUT_INCOMPLETE` | `costing_ledger`         | available       | ۰                       |
| `approval_workflow`    | partial       | `EXISTING_BUT_INCOMPLETE` | `approvals_workflow`     | online_required | ۰                       |
| `owner_forecast`       | partial       | `EXISTING_BUT_INCOMPLETE` | `forecast_insights`      | partial         | ۰                       |
| `livestock_register`   | planned       | `NEW_CAPABILITY_REQUIRED` | —                        | —               | ۰                       |
| `crop_cycle`           | planned       | `NEW_CAPABILITY_REQUIRED` | —                        | —               | ۰                       |
| `room_nights`          | planned       | `NEW_CAPABILITY_REQUIRED` | —                        | —               | ۰                       |

`EXISTING_AND_VERIFIED` فقط وقتی است که رجیستری یک فایل تست نام برده و آن فایل واقعاً هست.
