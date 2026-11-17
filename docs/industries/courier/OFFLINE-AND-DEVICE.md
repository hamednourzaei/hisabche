# پیک و تحویل بسته — آفلاین و دستگاه

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «حمل‌ونقل»](../families/transport.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## موتورهای این صنف

موتور اختصاصی ندارد؛ وضعیت آفلاین همان هسته‌ی مشترک است.

## مکان اجرای سه عمل قرارداد

| عمل | امروز |
| --- | --- |
| `invoice.create` | `device` اگر میزبان (ویندوز/اندروید) برای همین کسب‌وکار آماده باشد، وگرنه `server`؛ وب همیشه `server` |
| `payment.record` | `device` اگر میزبان (ویندوز/اندروید) برای همین کسب‌وکار آماده باشد، وگرنه `server`؛ وب همیشه `server` |
| `invoice.return` | در قرارداد هست ولی هیچ hook آن را صدا نمی‌زند؛ امروز `server` |

وضعیت هر endpoint در [OFFLINE-WORKFLOW-MATRIX.md](../OFFLINE-WORKFLOW-MATRIX.md) است (از `OFFLINE_ENDPOINT_MATRIX`، نه نوشته).
