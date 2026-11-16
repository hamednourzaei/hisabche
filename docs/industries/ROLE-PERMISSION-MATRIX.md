# ماتریس نقش × مجوز

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

| مجوز               | `owner` | `admin` | `member` | `viewer` |
| ------------------ | ------- | ------- | -------- | -------- |
| `record.read`      | ✓       | ✓       | ✓        | ✓        |
| `record.create`    | ✓       | ✓       | ✓        | —        |
| `record.update`    | ✓       | ✓       | ✓        | —        |
| `record.delete`    | ✓       | —       | —        | —        |
| `member.invite`    | ✓       | ✓       | —        | —        |
| `workspace.manage` | ✓       | —       | —        | —        |

این جدول نقش‌های پایه‌ی دستگاه است (`packages/auth-core`).

نقش پایه (`owner`، `admin`، `member`، `viewer`) را سرور می‌سنجد؛ نقش سفارشی که کسب‌وکار در `/governance?tab=permissions` می‌سازد جایگزین مجموعه‌ی نقش پایه می‌شود. صفحه‌ی ممنوع mount نمی‌شود.

نقش را همیشه سرور از عضویت می‌خواند؛ آنچه به مرورگر رسیده فقط برای نمایش است. دسترسی انبار همان دسترسی شعبه است.
