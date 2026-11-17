# پوشاک — نقش‌ها و دسترسی

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این سند برای این صنف‌ها هم خوانده می‌شود: [shoes](../shoes/README.md).

| نقش | چه می‌کند |
| --- | --- |
| صاحب کار | همه چیز، از جمله قیمت خرید و سود. |
| فروشنده (member) | فاکتور، دریافت، مرجوعی؛ قیمت خرید را فقط اگر نقشش اجازه بدهد می‌بیند. |
| بیننده (viewer) | فقط می‌خواند. |

نقش پایه (`owner`، `admin`، `member`، `viewer`) را سرور می‌سنجد؛ نقش سفارشی که کسب‌وکار در `/governance?tab=permissions` می‌سازد جایگزین مجموعه‌ی نقش پایه می‌شود. صفحه‌ی ممنوع mount نمی‌شود.

جدول کامل نقش × مجوز: [ROLE-PERMISSION-MATRIX.md](../ROLE-PERMISSION-MATRIX.md).
