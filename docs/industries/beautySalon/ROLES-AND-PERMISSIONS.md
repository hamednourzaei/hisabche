# ناخن و سالن زیبایی — نقش‌ها و دسترسی

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این سند برای این صنف‌ها هم خوانده می‌شود: [barber](../barber/README.md).

| نقش             | چه می‌کند                                                                   |
| --------------- | --------------------------------------------------------------------------- |
| صاحب سالن       | همه چیز؛ نرخ کمیسیون را فقط او تعیین می‌کند.                                |
| پذیرش (member)  | نوبت، وضعیت، فاکتور و دریافت.                                               |
| متخصص (member)  | جلسه‌های خودش و کمیسیون خودش (`GET /provider-commissions/my` (فقط آنلاین)). |
| بیننده (viewer) | فقط می‌خواند.                                                               |

نقش پایه (`owner`، `admin`، `member`، `viewer`) را سرور می‌سنجد؛ نقش سفارشی که کسب‌وکار در `/governance?tab=permissions` می‌سازد جایگزین مجموعه‌ی نقش پایه می‌شود. صفحه‌ی ممنوع mount نمی‌شود.

جدول کامل نقش × مجوز: [ROLE-PERMISSION-MATRIX.md](../ROLE-PERMISSION-MATRIX.md).
