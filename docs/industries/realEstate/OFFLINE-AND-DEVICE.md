# املاک و مشاورین — آفلاین و دستگاه

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «حرفه‌ای و اداری»](../families/professional_office.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## موتورهای این صنف

| موتور           | قابلیت‌ها                   | آفلاین                                  |
| --------------- | --------------------------- | --------------------------------------- |
| `sales_invoice` | `measurement`، `multi_unit` | روی دستگاه هم اجرا می‌شود · `available` |

## مکان اجرای سه عمل قرارداد

| عمل              | امروز                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `invoice.create` | `device` اگر میزبان (ویندوز/اندروید) برای همین کسب‌وکار آماده باشد، وگرنه `server`؛ وب همیشه `server` |
| `payment.record` | `device` اگر میزبان (ویندوز/اندروید) برای همین کسب‌وکار آماده باشد، وگرنه `server`؛ وب همیشه `server` |
| `invoice.return` | در قرارداد هست ولی هیچ hook آن را صدا نمی‌زند؛ امروز `server`                                         |

وضعیت هر endpoint در [OFFLINE-WORKFLOW-MATRIX.md](../OFFLINE-WORKFLOW-MATRIX.md) است (از `OFFLINE_ENDPOINT_MATRIX`، نه نوشته).
