# عینک‌فروشی — عملیات و تراکنش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «سلامت»](../families/health.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## قواعد حسابداری خانواده

- فروش ≠ درآمد تحقق‌یافته ≠ سود: سود فقط از گزارش سود می‌آید و با بهای نامعلوم، «نامعلوم» است.
- بیعانه و پیش‌دریافت بدهی است تا کالا/خدمت تحویل شود؛ درآمد فقط با فاکتور شناخته می‌شود (یک موتور: `order_deposits`).
- سری و تاریخ روی دستگاه فقط آن چیزی است که همان دستگاه نوشته؛ تخصیص نهایی با سرور است.
- داده‌ی پزشکی بیمار در محصول نگه داشته نمی‌شود.

## موتورهای اختصاصی که این صنف روشن می‌کند

| موتور | قابلیت‌ها | آفلاین |
| --- | --- | --- |
| `sales_invoice` | `multi_unit` | روی دستگاه هم اجرا می‌شود · `available` |
| `inventory_catalog` | `batch_expiry`، `serialized_items` | روی دستگاه هم اجرا می‌شود · `partial` |

## DNA عملیاتی

- عرضه: `TIME_SERVICE` · دریافت سفارش: `APPOINTMENT_BOOKING` · انبار: `SERVICE_CONSUMABLES`
- تسویه: `DEPOSIT_PREPAYMENT`، `IMMEDIATE_SETTLEMENT` · نیروی کار: `UNRESOLVED` · مشتری: `CLIENT_CARE_PROFILE`
