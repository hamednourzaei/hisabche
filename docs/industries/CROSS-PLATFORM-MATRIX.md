# ماتریس سه پلتفرم

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

| نشانی               | صفحه‌ی وب | پوسته (ویندوز و اندروید) | بسته            |
| ------------------- | --------- | ------------------------ | --------------- |
| `/dashboard`        | ✓         | ✓                        | `core`          |
| `/invoices`         | ✓         | ✓                        | `core`          |
| `/warehouse`        | ✓         | ✓                        | `core`          |
| `/accounting`       | ✓         | ✓                        | `core`          |
| `/customers`        | ✓         | ✓                        | `core`          |
| `/approvals`        | ✓         | ✓                        | `approvals`     |
| `/settings`         | ✓         | ✓                        | `core`          |
| `/activities`       | ✓         | ✓                        | `core`          |
| `/till`             | ✓         | ✓                        | `core`          |
| `/data-and-sync`    | ✓         | ✓                        | `core`          |
| `/team-and-payroll` | ✓         | ✓                        | `workforce`     |
| `/manufacturing`    | ✓         | ✓                        | `manufacturing` |
| `/billing`          | ✓         | ✓                        | `core`          |
| `/market-seller`    | ✓         | ✓                        | `marketplace`   |
| `/analysis`         | ✓         | ✓                        | `intelligence`  |
| `/assistant`        | ✓         | ✓                        | `intelligence`  |
| `/governance`       | ✓         | ✓                        | `core`          |

ویندوز و اندروید یک پوسته را نشان می‌دهند (`packages/app-shell`) و هر سه همان کامپوننت‌های `packages/ui` را. تفاوت پلتفرم‌ها در چیدمان است، نه در قرارداد.

## بسته‌های دانلودپذیر

| بسته            | نشانی‌ها | جدول‌های همگام‌سازی                                                                                                          | وابسته به |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| `core`          | 26       | `invoice`، `customer`، `product`، `transaction`، `warehouse`، `branch`، `exchange_rate`، `product_stock`، `product_variants` | —         |
| `operations`    | 2        | `order_deposits`، `order_deposit_applications`، `order_deposit_refunds`                                                      | `core`    |
| `manufacturing` | 1        | —                                                                                                                            | `core`    |
| `workforce`     | 2        | `time_entry`، `service_delivery_sessions`، `package_credit_ledger`، `repair_tickets`                                         | `core`    |
| `approvals`     | 1        | —                                                                                                                            | `core`    |
| `intelligence`  | 2        | —                                                                                                                            | `core`    |
| `marketplace`   | 2        | —                                                                                                                            | `core`    |
