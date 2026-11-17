# خدمات کامپیوتری — صفحه‌به‌صفحه

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «تعمیرات»](../families/repairs.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد. نزدیک‌ترین سند دستی: [repairs/PAGE-BY-PAGE-UX.md](../repairs/PAGE-BY-PAGE-UX.md) — همان مشخصات را می‌خواند.

## صفحه‌های این صنف

| نشانی | این صنف آنجا چه می‌خواند | پنهان در منوی پیشنهادی؟ |
| --- | --- | --- |
| `/customers` | پرونده‌های تعمیر هر مشتری (`GET /repair-tickets` (فقط آنلاین)). | خیر |
| `/invoices` | فروش، خرید، مرجوعی و قیمت‌گذاری در یک جدول (`GET /invoices` (آفلاین: در دسترس)). | خیر |
| `/warehouse` | کالا، موجودی هر انبار، قفسه‌ها (`GET /products` (آفلاین: در دسترس)، `GET /warehouses/overview` (آفلاین: در دسترس)). | بله — با آچار برمی‌گردد |
| `/till` | صندوق نقد هر ارز (`GET /pos/sessions/current` (آفلاین: در دسترس)). | بله — با آچار برمی‌گردد |
| `/team-and-payroll` | کارمند، حضور و غیاب، حقوق (`GET /employees` (آفلاین: در دسترس)، `GET /payrolls` (آفلاین: در دسترس)). | خیر |

## تفاوت صفحه‌ها برای این صنف (از پروفایل)

- **داشبورد**: قطعه‌ی اختصاصی `openRepairTickets`؛ ترتیب کامل: `openRepairTickets`، `workQueue`، `kpis`، `chart`، `insights`، `activities`، `manufacturing`.
- **منو**: منوی پیشنهادی از DNA این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`، `/warehouse`. پنهان‌کردن، قاعده‌ی حسابداری یا ممیزی را برنمی‌دارد.

## واژگان این صنف

واژه‌ی اختصاصی ندارد؛ برچسب‌های مشترک.

## چیدمان، اقدام‌ها و حالت‌ها

چیدمان از بالا به پایین، اقدام‌های هر صفحه و ده حالت (خالی، عادی، بارگذاری، آفلاین، بی‌اجازه، خطای اعتبارسنجی، داده‌ی ناقص، تعارض، تکمیل، بایگانی) برای همه‌ی صنف‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). زیر ۷۶۸px جدول‌ها کارت می‌شوند؛ ویندوز و اندروید همان صفحه را از `packages/app-shell` نشان می‌دهند.
