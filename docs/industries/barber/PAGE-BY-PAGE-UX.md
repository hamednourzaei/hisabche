# آرایشگاه و سلمانی — صفحه‌به‌صفحه

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «خدمات شخصی»](../families/personal_services.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد. نزدیک‌ترین سند دستی: [beautySalon/PAGE-BY-PAGE-UX.md](../beautySalon/PAGE-BY-PAGE-UX.md) — همان مشخصات را می‌خواند.

## صفحه‌های این صنف

| نشانی | این صنف آنجا چه می‌خواند | پنهان در منوی پیشنهادی؟ |
| --- | --- | --- |
| `/customers` | جلسه‌های خدمت و پیگیری مشتری (`GET /service-delivery/sessions` (آفلاین: در دسترس)). | خیر |
| `/invoices` | فروش، خرید، مرجوعی و قیمت‌گذاری در یک جدول (`GET /invoices` (آفلاین: در دسترس)). | خیر |
| `/till` | صندوق نقد هر ارز (`GET /pos/sessions/current` (آفلاین: در دسترس)). | بله — با آچار برمی‌گردد |
| `/team-and-payroll` | کارمند، حضور و غیاب، حقوق (`GET /employees` (آفلاین: در دسترس)، `GET /payrolls` (آفلاین: در دسترس)). | خیر |
| `/warehouse` | کالا، موجودی هر انبار، قفسه‌ها (`GET /products` (آفلاین: در دسترس)، `GET /warehouses/overview` (آفلاین: در دسترس)). | خیر |

## تفاوت صفحه‌ها برای این صنف (از پروفایل)

- **داشبورد**: قطعه‌ی اختصاصی `todaySessions`؛ ترتیب کامل: `todaySessions`، `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`.
- **فرم کالا** (`/warehouse`): واحد پیش‌فرض `piece`؛ فیلدهای جلو: `name`، `sellPrice`.
- **منو**: منوی پیشنهادی از DNA این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`. پنهان‌کردن، قاعده‌ی حسابداری یا ممیزی را برنمی‌دارد.

## واژگان این صنف

| جا | برچسب | کلید |
| --- | --- | --- |
| `productKey` | خدمت | `industry.vocabulary.service` |
| `customerKey` | مراجعه‌کننده | `industry.vocabulary.client` |

## چیدمان، اقدام‌ها و حالت‌ها

چیدمان از بالا به پایین، اقدام‌های هر صفحه و ده حالت (خالی، عادی، بارگذاری، آفلاین، بی‌اجازه، خطای اعتبارسنجی، داده‌ی ناقص، تعارض، تکمیل، بایگانی) برای همه‌ی صنف‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). زیر ۷۶۸px جدول‌ها کارت می‌شوند؛ ویندوز و اندروید همان صفحه را از `packages/app-shell` نشان می‌دهند.
