# خانواده‌ی سلامت (`health`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## مدل عملیاتی

کالای تاریخ‌دار (دارو، عدسی) و خدمت نوبتی (ویزیت) کنار هم‌اند. تاریخ انقضا و سری ساخت باید روی هر فروش دنبال شود و نوبت بیمار همان جلسه‌ی خدمت است.

## چرخه‌ی تراکنش

1. خرید با سری و تاریخ
2. نگهداری
3. نوبت یا مراجعه
4. فروش/خدمت
5. دریافت
6. کنترل تاریخ

## صنف‌های این خانواده

| صنف | پروفایل | archetype | قابلیت‌های روشن | ساخته‌نشده |
| --- | --- | --- | --- | --- |
| [دواخانه و داروخانه](../pharmacy/README.md) (`pharmacy`) | `specialized` | `GENERIC_BUSINESS` | `multi_unit`، `batch_expiry` | `pharmacy_prescription`، `pharmacy_dispensing`، `insurance_claims` |
| [کلینیک و مطب](../clinic/README.md) (`clinic`) | `generic` | `NAIL_TECH_BEAUTY` | — | `clinical_record`، `health_data_access` |
| [عینک‌فروشی](../optician/README.md) (`optician`) | `specialized` | `NAIL_TECH_BEAUTY` | `multi_unit`، `batch_expiry`، `serialized_items` | `optical_prescription`، `lens_order` |

## پنج گردش کار

### اصلی

1. نوبت بیمار (`POST /service-delivery/sessions` (آفلاین: در دسترس)).
2. فاکتور فروش در `/invoices/new` ثبت می‌شود (`POST /invoices` (آفلاین: در دسترس)).
3. کالای تاریخ‌دار از نزدیک‌ترین تاریخ برداشته می‌شود (تخصیص سری روی سرور).
4. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).

### مالی

1. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).
2. صندوق روز در `/till` باز می‌شود (`POST /pos/sessions` (آفلاین: در دسترس)).
3. مرجوعی (`POST /invoices/:x/returns` (آفلاین: در دسترس)).
4. پایان روز: شمارش و بستن صندوق (`POST /pos/sessions/:x/close` (آفلاین: در دسترس)).

### منابع (کالای تاریخ‌دار)

1. خرید = فاکتور خرید در همان جدول فاکتورها (`/invoices?type=purchase`)؛ هر خرید لایه‌ی بهای خودش را می‌سازد.
2. کالاهای رو به انقضا در `/warehouse?tab=expiry`.
3. انتقال بین انبارها (`POST /stock-transfers` (آفلاین: در دسترس)).
4. شمارش دوره‌ای (`POST /cycle-counts` (فقط آنلاین)) — فقط آنلاین.

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
| نوبت‌های امروز | `GET /analytics/dashboard/today-sessions` (آفلاین: در دسترس) |
| فروش امروز | `GET /analytics/dashboard` (آفلاین: در دسترس) |
| کالای رو به انقضا | بخش انقضا در `/warehouse?tab=expiry` |
| کالای رو به اتمام | `GET /inventory/reorder-suggestions` (آفلاین: در دسترس) |
| طلب از بیماران/بیمه | `GET /customers` (آفلاین: در دسترس) (مانده به تفکیک ارز) |

## صفحه‌ها

| نشانی | این خانواده آنجا چه می‌خواند |
| --- | --- |
| `/warehouse` | کالا، موجودی هر انبار، قفسه‌ها (`GET /products` (آفلاین: در دسترس)، `GET /warehouses/overview` (آفلاین: در دسترس)). |
| `/invoices` | فروش، خرید، مرجوعی و قیمت‌گذاری در یک جدول (`GET /invoices` (آفلاین: در دسترس)). |
| `/customers` | طرف حساب، مانده به تفکیک ارز، پیگیری (`GET /customers` (آفلاین: در دسترس)، `GET /customers/:x/accounting` (آفلاین: در دسترس)). |
| `/till` | صندوق نقد هر ارز (`GET /pos/sessions/current` (آفلاین: در دسترس)). |
| `/team-and-payroll` | کارمند، حضور و غیاب، حقوق (`GET /employees` (آفلاین: در دسترس)، `GET /payrolls` (آفلاین: در دسترس)). |

چیدمان، اقدام‌ها و ده حالت هر صفحه برای همه‌ی خانواده‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). موبایل و ویندوز همان صفحه و همان قرارداد را دارند؛ زیر ۷۶۸px جدول‌ها کارت می‌شوند.

## قواعد حسابداری

- فروش ≠ درآمد تحقق‌یافته ≠ سود: سود فقط از گزارش سود می‌آید و با بهای نامعلوم، «نامعلوم» است.
- بیعانه و پیش‌دریافت بدهی است تا کالا/خدمت تحویل شود؛ درآمد فقط با فاکتور شناخته می‌شود (یک موتور: `order_deposits`).
- سری و تاریخ روی دستگاه فقط آن چیزی است که همان دستگاه نوشته؛ تخصیص نهایی با سرور است.
- داده‌ی پزشکی بیمار در محصول نگه داشته نمی‌شود.

## شکاف‌های خانواده

قابلیت‌هایی که صنف‌های این خانواده خواسته‌اند و ساخته نشده (`NEW_CAPABILITY_REQUIRED`): `clinical_record`، `health_data_access`، `insurance_claims`، `lens_order`، `optical_prescription`، `pharmacy_dispensing`، `pharmacy_prescription`.

## بر اساس اندازه

تک‌نفره: صاحب کار همه‌ی نقش‌ها را دارد و منو با آچار کوتاه می‌شود. کوچک (چند نفر): نقش‌های پایه کافی است. متوسط: نقش سفارشی در `/governance?tab=permissions` و محدودیت شعبه/انبار. بزرگ: چند شعبه و گردش‌کار تأیید در `/approvals?tab=workflows`. این مرزها تنظیم کسب‌وکار است، نه قاعده‌ی محصول.
