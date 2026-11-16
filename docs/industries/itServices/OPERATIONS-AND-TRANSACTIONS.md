# خدمات کامپیوتری — عملیات و تراکنش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «تعمیرات»](../families/repairs.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد. نزدیک‌ترین سند دستی: [repairs/OPERATIONS-AND-TRANSACTIONS.md](../repairs/OPERATIONS-AND-TRANSACTIONS.md) — همان مشخصات را می‌خواند.

## قواعد حسابداری خانواده

- بیعانه و پیش‌دریافت بدهی است تا کالا/خدمت تحویل شود؛ درآمد فقط با فاکتور شناخته می‌شود (یک موتور: `order_deposits`).
- فروش ≠ درآمد تحقق‌یافته ≠ سود: سود فقط از گزارش سود می‌آید و با بهای نامعلوم، «نامعلوم» است.
- کالای مشتری در امانت است و موجودی کسب‌وکار نیست.
- قطعه‌ی مصرف‌شده از لایه‌ی بهای خودش کم می‌شود؛ بهای نامعلوم «نامعلوم» می‌ماند.

## موتورهای اختصاصی که این صنف روشن می‌کند

هیچ — فاکتور، پرداخت، انبار و دفتر کل مشترک.

## DNA عملیاتی

- عرضه: `DELIVERABLE_SERVICE` · دریافت سفارش: `WALK_IN` · انبار: `NONE`
- تسویه: `IMMEDIATE_SETTLEMENT`، `CUSTOMER_CREDIT` · نیروی کار: `UNRESOLVED` · مشتری: `STANDARD_PARTY`
