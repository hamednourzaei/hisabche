# خانواده‌ی تولید (`manufacturing`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## مدل عملیاتی

مواد اولیه به کالای تمام‌شده تبدیل می‌شود. بهای محصول از فرمول ساخت، مواد مصرف‌شده و هزینه‌های کار می‌آید و فروش مثل عمده یا خرده است.

## چرخه‌ی تراکنش

1. خرید مواد
2. فرمول ساخت
3. ثبت تولید
4. انبار محصول
5. فروش
6. بهای تمام‌شده

## صنف‌های این خانواده

| صنف | پروفایل | archetype | قابلیت‌های روشن | ساخته‌نشده |
| --- | --- | --- | --- | --- |
| [تولیدی و کارگاه](../manufacturing/README.md) (`manufacturing`) | `specialized` | `GENERIC_BUSINESS` | `multi_unit` | — |
| [زراعت و کشاورزی](../agriculture/README.md) (`agriculture`) | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit`، `batch_expiry` | — |
| [مالداری و دامداری](../livestock/README.md) (`livestock`) | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit`، `serialized_items` | — |
| [چاپ و تبلیغات](../printing/README.md) (`printing`) | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit` | `print_job` |

## پنج گردش کار

### اصلی (تولید)

1. فرمول ساخت ذخیره می‌شود (`PUT /manufacturing/definitions` (فقط آنلاین)) — استفاده‌شده ویرایش نمی‌شود، بازنگری می‌شود.
2. «تکمیل» یعنی ثبت تولید (`POST /manufacturing/produce` (فقط آنلاین)).
3. تاریخچه از snapshot همان اجرا خوانده می‌شود (`GET /manufacturing/runs/:x` (فقط آنلاین)).
4. فاکتور فروش در `/invoices/new` ثبت می‌شود (`POST /invoices` (آفلاین: در دسترس)).

### مالی

1. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).
2. گزارش بهای تولید (`GET /manufacturing/report` (فقط آنلاین)).
3. سود به تفکیک ارز (`GET /accounting/profit-report/by-currency` (آفلاین: در دسترس)).
4. سند دستی دفتر (`POST /accounting/journal` (آفلاین: در دسترس)).

### منابع (مواد)

1. خرید = فاکتور خرید در همان جدول فاکتورها (`/invoices?type=purchase`)؛ هر خرید لایه‌ی بهای خودش را می‌سازد.
2. سفارش خرید (`POST /purchase-orders` (آفلاین: در دسترس)).
3. موجودی هر انبار (`GET /warehouses/overview` (آفلاین: در دسترس)).
4. انتقال بین انبارها (`POST /stock-transfers` (آفلاین: در دسترس)).

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
| تولید دوره | `GET /manufacturing/runs` (فقط آنلاین) (فقط آنلاین) |
| مواد رو به اتمام | `GET /inventory/reorder-suggestions` (آفلاین: در دسترس) |
| فروش دوره | `GET /analytics/sales` (آفلاین: در دسترس) |
| بهای تولید | `GET /manufacturing/report` (فقط آنلاین) |
| سفارش خرید در راه | `GET /purchase-orders` (آفلاین: در دسترس) |

## صفحه‌ها

| نشانی | این خانواده آنجا چه می‌خواند |
| --- | --- |
| `/manufacturing` | فرمول، ثبت تولید و گزارش (`GET /manufacturing/runs` (فقط آنلاین)). |
| `/warehouse` | کالا، موجودی هر انبار، قفسه‌ها (`GET /products` (آفلاین: در دسترس)، `GET /warehouses/overview` (آفلاین: در دسترس)). |
| `/invoices` | فروش، خرید، مرجوعی و قیمت‌گذاری در یک جدول (`GET /invoices` (آفلاین: در دسترس)). |
| `/accounting` | دفتر، خزانه و گزارش‌ها (`GET /accounting/accounts` (آفلاین: در دسترس)). |
| `/team-and-payroll` | کارمند، حضور و غیاب، حقوق (`GET /employees` (آفلاین: در دسترس)، `GET /payrolls` (آفلاین: در دسترس)). |

چیدمان، اقدام‌ها و ده حالت هر صفحه برای همه‌ی خانواده‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). موبایل و ویندوز همان صفحه و همان قرارداد را دارند؛ زیر ۷۶۸px جدول‌ها کارت می‌شوند.

## قواعد حسابداری

- تولید فقط آنلاین است و سند دفتر کل نمی‌زند (کار در جریان و سربار تصمیم صاحب کار است).
- گردکردن بها چهار رقم اعشار است، جدا از گردکردن قیمت.
- فروش ≠ درآمد تحقق‌یافته ≠ سود: سود فقط از گزارش سود می‌آید و با بهای نامعلوم، «نامعلوم» است.
- فاکتور ارزِ دیگر بدون نرخ ثبت نمی‌شود؛ نرخ روی همان فاکتور منجمد است و مانده‌ی طرف حساب به تفکیک ارز است.

## شکاف‌های خانواده

قابلیت‌هایی که صنف‌های این خانواده خواسته‌اند و ساخته نشده (`NEW_CAPABILITY_REQUIRED`): `print_job`.

## بر اساس اندازه

تک‌نفره: صاحب کار همه‌ی نقش‌ها را دارد و منو با آچار کوتاه می‌شود. کوچک (چند نفر): نقش‌های پایه کافی است. متوسط: نقش سفارشی در `/governance?tab=permissions` و محدودیت شعبه/انبار. بزرگ: چند شعبه و گردش‌کار تأیید در `/approvals?tab=workflows`. این مرزها تنظیم کسب‌وکار است، نه قاعده‌ی محصول.
