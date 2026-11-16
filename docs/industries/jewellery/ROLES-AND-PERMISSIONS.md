# طلا و جواهر — نقش‌ها و دسترسی

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «خرده‌فروشی»](../families/retail.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

نقش پایه (`owner`، `admin`، `member`، `viewer`) را سرور می‌سنجد؛ نقش سفارشی که کسب‌وکار در `/governance?tab=permissions` می‌سازد جایگزین مجموعه‌ی نقش پایه می‌شود. صفحه‌ی ممنوع mount نمی‌شود.

## بر اساس اندازه

تک‌نفره: صاحب کار همه‌ی نقش‌ها را دارد و منو با آچار کوتاه می‌شود. کوچک (چند نفر): نقش‌های پایه کافی است. متوسط: نقش سفارشی در `/governance?tab=permissions` و محدودیت شعبه/انبار. بزرگ: چند شعبه و گردش‌کار تأیید در `/approvals?tab=workflows`. این مرزها تنظیم کسب‌وکار است، نه قاعده‌ی محصول.

جدول کامل نقش × مجوز: [ROLE-PERMISSION-MATRIX.md](../ROLE-PERMISSION-MATRIX.md).
