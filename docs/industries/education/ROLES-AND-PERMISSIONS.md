# آموزشگاه و کورس — نقش‌ها و دسترسی

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

| نقش             | چه می‌کند                   |
| --------------- | --------------------------- |
| مدیر آموزشگاه   | همه چیز.                    |
| پذیرش (member)  | ثبت‌نام، فروش بسته، دریافت. |
| مدرس (member)   | جلسه‌های خودش و حضور.       |
| بیننده (viewer) | فقط می‌خواند.               |

نقش پایه (`owner`، `admin`، `member`، `viewer`) را سرور می‌سنجد؛ نقش سفارشی که کسب‌وکار در `/governance?tab=permissions` می‌سازد جایگزین مجموعه‌ی نقش پایه می‌شود. صفحه‌ی ممنوع mount نمی‌شود.

جدول کامل نقش × مجوز: [ROLE-PERMISSION-MATRIX.md](../ROLE-PERMISSION-MATRIX.md).
