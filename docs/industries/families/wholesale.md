# خانواده‌ی عمده‌فروشی (`wholesale`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## مدل عملیاتی

کالا در حجم زیاد به کسب‌وکارهای دیگر فروخته می‌شود؛ فروش بیشتر نسیه و با مشتری نام‌دار است، قیمت به مشتری و مقدار بستگی دارد و وصول طلب به اندازه‌ی فروش مهم است.

## چرخه‌ی تراکنش

1. قرارداد و قیمت با مشتری
2. سفارش خرید
3. دریافت کالا
4. فروش نسیه
5. وصول طلب
6. تسویه با تأمین‌کننده

## صنف‌های این خانواده

| صنف | پروفایل | archetype | قابلیت‌های روشن | ساخته‌نشده |
| --- | --- | --- | --- | --- |
| [عمده‌فروشی](../wholesale/README.md) (`wholesale`) | `generic` | `GENERIC_BUSINESS` | — | — |
| [رول پارچه (عمده)](../fabricRoll/README.md) (`fabricRoll`) | `specialized` | `GENERIC_BUSINESS` | `measurement`، `length_pricing`، `multi_unit` | — |
| [مواد ساختمانی](../buildingMaterials/README.md) (`buildingMaterials`) | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit` | — |
| [چوب و الوار](../timber/README.md) (`timber`) | `specialized` | `GENERIC_BUSINESS` | `measurement`، `length_pricing`، `multi_unit` | — |
| [تیل‌فروشی و گاز](../fuel/README.md) (`fuel`) | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit` | `fuel_tank_reconciliation` |
| [تخم و کود](../seedsFertilizer/README.md) (`seedsFertilizer`) | `specialized` | `RETAIL_STORE` | `measurement`، `multi_unit`، `batch_expiry` | — |

## پنج گردش کار

### اصلی (فروش عمده)

1. فهرست قیمت هر مشتری (`GET /price-lists/for-customer/:x` (آفلاین: در دسترس)) در `/invoices?tab=pricing`.
2. فاکتور فروش در `/invoices/new` ثبت می‌شود (`POST /invoices` (آفلاین: در دسترس)).
3. واحد بسته و فله روی همان خط انتخاب می‌شود.
4. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).

### مالی (وصول)

1. فاکتورهای باز هر مشتری (`GET /payments/open-invoices/:x/:x` (آفلاین: در دسترس)).
2. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).
3. پرداخت فقط فاکتور هم‌ارز خودش را تسویه می‌کند.
4. پیگیری وصول در `/customers?tab=outreach`.

### منابع (تأمین)

1. سفارش خرید (`POST /purchase-orders` (آفلاین: در دسترس)) و دریافت (`POST /purchase-orders/:x/receive` (آفلاین: در دسترس)).
2. خرید = فاکتور خرید در همان جدول فاکتورها (`/invoices?type=purchase`)؛ هر خرید لایه‌ی بهای خودش را می‌سازد.
3. انتقال بین انبارها (`POST /stock-transfers` (آفلاین: در دسترس)).
4. موجودی هر انبار (`GET /warehouses/overview` (آفلاین: در دسترس)).

### نیروی انسانی

1. کارمندان در `/team-and-payroll` تعریف می‌شوند (`POST /employees` (آفلاین: در دسترس)).
2. برگه‌ی حضور و غیاب (`PUT /attendance-sheet` (آفلاین: در دسترس)) — «ثبت‌نشده» غایب نیست و به حقوق وصل نیست.
3. حقوق ثبت و تسویه می‌شود (`POST /payrolls` (آفلاین: در دسترس)، `PATCH /payrolls/:x` (آفلاین: در دسترس))؛ «پرداخت‌شده» نهایی است.
4. مرخصی درخواست و تصمیم‌گیری می‌شود (`POST /leaves` (آفلاین: در دسترس)، `PATCH /leaves/:x` (آفلاین: در دسترس)).

### مدیریتی

1. داشبورد (`/dashboard`، `GET /analytics/dashboard` (آفلاین: در دسترس)) — رقمی که شخص مجوزش را ندارد حذف می‌شود، صفر نشان داده نمی‌شود.
2. گزارش سود به تفکیک ارز (`GET /accounting/profit-report/by-currency` (آفلاین: در دسترس)) در `/accounting?tab=reports`؛ بهای نامعلوم «نامعلوم» می‌ماند.
3. تراز آزمایشی (`GET /accounting/trial-balance` (آفلاین: در دسترس)) و دفتر (`GET /accounting/journal` (آفلاین: در دسترس)) در `/accounting`.
4. تأیید سندها در `/approvals` — تا گردش‌کاری تعریف نشده، این صفحه خالی است و دلیلش را می‌گوید.

## پنج اولویت داشبورد

| چه چیزی | از کجا می‌آید |
| --- | --- |
| طلب سررسیدشده | `GET /customers` (آفلاین: در دسترس) و `GET /payments/open-invoices/:x/:x` (آفلاین: در دسترس) |
| فروش دوره | `GET /analytics/sales` (آفلاین: در دسترس) |
| سفارش خرید در راه | `GET /purchase-orders` (آفلاین: در دسترس) |
| موجودی هر انبار | `GET /warehouses/overview` (آفلاین: در دسترس) |
| سود به تفکیک ارز | `GET /accounting/profit-report/by-currency` (آفلاین: در دسترس) |

## صفحه‌ها

| نشانی | این خانواده آنجا چه می‌خواند |
| --- | --- |
| `/invoices` | فروش، خرید، مرجوعی و قیمت‌گذاری در یک جدول (`GET /invoices` (آفلاین: در دسترس)). |
| `/customers` | طرف حساب، مانده به تفکیک ارز، پیگیری (`GET /customers` (آفلاین: در دسترس)، `GET /customers/:x/accounting` (آفلاین: در دسترس)). |
| `/warehouse` | کالا، موجودی هر انبار، قفسه‌ها (`GET /products` (آفلاین: در دسترس)، `GET /warehouses/overview` (آفلاین: در دسترس)). |
| `/accounting` | دفتر، خزانه و گزارش‌ها (`GET /accounting/accounts` (آفلاین: در دسترس)). |
| `/team-and-payroll` | کارمند، حضور و غیاب، حقوق (`GET /employees` (آفلاین: در دسترس)، `GET /payrolls` (آفلاین: در دسترس)). |

چیدمان، اقدام‌ها و ده حالت هر صفحه برای همه‌ی خانواده‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). موبایل و ویندوز همان صفحه و همان قرارداد را دارند؛ زیر ۷۶۸px جدول‌ها کارت می‌شوند.

## قواعد حسابداری

- فروش ≠ درآمد تحقق‌یافته ≠ سود: سود فقط از گزارش سود می‌آید و با بهای نامعلوم، «نامعلوم» است.
- فاکتور ارزِ دیگر بدون نرخ ثبت نمی‌شود؛ نرخ روی همان فاکتور منجمد است و مانده‌ی طرف حساب به تفکیک ارز است.
- بیعانه و پیش‌دریافت بدهی است تا کالا/خدمت تحویل شود؛ درآمد فقط با فاکتور شناخته می‌شود (یک موتور: `order_deposits`).
- سقف اعتبار و مهلت پرداخت مشتری فقط با اتصال خوانده می‌شود (`PATCH /customers/:x/terms` (فقط آنلاین)).
- پیش‌خرید سمت تأمین‌کننده همان موتور بیعانه است، با نقش دیگر.

## شکاف‌های خانواده

قابلیت‌هایی که صنف‌های این خانواده خواسته‌اند و ساخته نشده (`NEW_CAPABILITY_REQUIRED`): `fuel_tank_reconciliation`.

## بر اساس اندازه

تک‌نفره: صاحب کار همه‌ی نقش‌ها را دارد و منو با آچار کوتاه می‌شود. کوچک (چند نفر): نقش‌های پایه کافی است. متوسط: نقش سفارشی در `/governance?tab=permissions` و محدودیت شعبه/انبار. بزرگ: چند شعبه و گردش‌کار تأیید در `/approvals?tab=workflows`. این مرزها تنظیم کسب‌وکار است، نه قاعده‌ی محصول.
