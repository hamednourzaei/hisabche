# خانواده‌ی خرده‌فروشی (`retail`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## مدل عملیاتی

کالای آماده خریده و به مصرف‌کننده‌ی نهایی فروخته می‌شود؛ بیشتر فروش‌ها نقدی و بی‌نام‌اند، تعداد فاکتور زیاد و مبلغ هر کدام کم است. موجودی، بهای خرید و صندوق سه چیزی است که هر روز باید درست باشد.

## چرخه‌ی تراکنش

1. خرید از تأمین‌کننده
2. ورود به انبار و قفسه
3. فروش نقدی یا نسیه
4. دریافت پول
5. بستن صندوق
6. سفارش دوباره

## صنف‌های این خانواده

| صنف                                                                      | پروفایل       | archetype          | قابلیت‌های روشن                               | ساخته‌نشده |
| ------------------------------------------------------------------------ | ------------- | ------------------ | --------------------------------------------- | ---------- |
| [خرده‌فروشی](../retail/README.md) (`retail`)                             | `generic`     | `RETAIL_STORE`     | —                                             | —          |
| [خواروبار و سوپرمارکت](../grocery/README.md) (`grocery`)                 | `specialized` | `RETAIL_STORE`     | `multi_unit`                                  | —          |
| [قصابی](../butcher/README.md) (`butcher`)                                | `specialized` | `RETAIL_STORE`     | `measurement`، `multi_unit`، `batch_expiry`   | —          |
| [میوه و سبزی](../fruitVegetable/README.md) (`fruitVegetable`)            | `specialized` | `RETAIL_STORE`     | `measurement`، `multi_unit`                   | —          |
| [لبنیات](../dairy/README.md) (`dairy`)                                   | `specialized` | `RETAIL_STORE`     | `multi_unit`، `batch_expiry`                  | —          |
| [خشکبار و آجیل](../nuts/README.md) (`nuts`)                              | `specialized` | `RETAIL_STORE`     | `measurement`، `multi_unit`                   | —          |
| [عطاری و ادویه](../spices/README.md) (`spices`)                          | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit`                   | —          |
| [طلا و جواهر](../jewellery/README.md) (`jewellery`)                      | `specialized` | `GENERIC_BUSINESS` | `measurement`، `weight_pricing`، `multi_unit` | —          |
| [ساعت](../watches/README.md) (`watches`)                                 | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit`                   | —          |
| [پوشاک](../clothing/README.md) (`clothing`)                              | `specialized` | `GENERIC_BUSINESS` | `variants`                                    | —          |
| [پارچه متری و خرازی](../fabric/README.md) (`fabric`)                     | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit`                   | —          |
| [کفش](../shoes/README.md) (`shoes`)                                      | `specialized` | `GENERIC_BUSINESS` | `variants`                                    | —          |
| [فرش و قالین](../carpet/README.md) (`carpet`)                            | `specialized` | `RETAIL_STORE`     | `measurement`، `multi_unit`، `variants`       | —          |
| [موبایل و لوازم جانبی](../mobilePhones/README.md) (`mobilePhones`)       | `specialized` | `GENERIC_BUSINESS` | `variants`، `serialized_items`                | —          |
| [کامپیوتر و لپ‌تاپ](../computers/README.md) (`computers`)                | `specialized` | `GENERIC_BUSINESS` | `variants`، `serialized_items`                | —          |
| [قطعات کامپیوتر](../computerComponents/README.md) (`computerComponents`) | `specialized` | `GENERIC_BUSINESS` | `variants`، `serialized_items`                | —          |
| [لوازم برقی و الکترونیک](../electronics/README.md) (`electronics`)       | `specialized` | `GENERIC_BUSINESS` | `variants`، `serialized_items`                | —          |
| [آهن‌فروشی و ابزار](../hardware/README.md) (`hardware`)                  | `specialized` | `GENERIC_BUSINESS` | `measurement`، `multi_unit`                   | —          |
| [رنگ و ابزار نقاشی](../paint/README.md) (`paint`)                        | `specialized` | `RETAIL_STORE`     | `measurement`، `multi_unit`، `variants`       | —          |
| [شیشه و آلومینیوم](../glass/README.md) (`glass`)                         | `specialized` | `RETAIL_STORE`     | `measurement`، `multi_unit`                   | —          |
| [قطعات موتر و یدکی](../autoParts/README.md) (`autoParts`)                | `specialized` | `SERVICE_REPAIR`   | `auto_fitments`                               | —          |
| [مبل و اثاثیه](../furniture/README.md) (`furniture`)                     | `specialized` | `RETAIL_STORE`     | `multi_unit`، `variants`                      | —          |
| [ظروف و لوازم آشپزخانه](../kitchenware/README.md) (`kitchenware`)        | `generic`     | `RETAIL_STORE`     | —                                             | —          |
| [لوازم خانگی](../homeAppliances/README.md) (`homeAppliances`)            | `specialized` | `RETAIL_STORE`     | `variants`، `serialized_items`                | —          |
| [لوازم‌التحریر و کتاب](../stationery/README.md) (`stationery`)           | `specialized` | `RETAIL_STORE`     | `multi_unit`                                  | —          |
| [اسباب‌بازی](../toys/README.md) (`toys`)                                 | `specialized` | `RETAIL_STORE`     | `multi_unit`، `variants`                      | —          |
| [کادو و تزئینات](../giftShop/README.md) (`giftShop`)                     | `specialized` | `RETAIL_STORE`     | `multi_unit`                                  | —          |
| [لوازم آرایشی و بهداشتی](../cosmetics/README.md) (`cosmetics`)           | `specialized` | `RETAIL_STORE`     | `multi_unit`، `batch_expiry`، `variants`      | —          |
| [گل و گیاه](../flowers/README.md) (`flowers`)                            | `specialized` | `RETAIL_STORE`     | `multi_unit`                                  | —          |
| [کسب‌وکارت پیدا نشد؟ (سایر)](../other/README.md) (`other`)               | `generic`     | `GENERIC_BUSINESS` | —                                             | —          |

## پنج گردش کار

### اصلی (فروش)

1. صندوق روز در `/till` باز می‌شود (`POST /pos/sessions` (آفلاین: در دسترس)).
2. فاکتور فروش در `/invoices/new` ثبت می‌شود (`POST /invoices` (آفلاین: در دسترس)).
3. کالا با جست‌وجو یا بارکد انتخاب می‌شود (`GET /products` (آفلاین: در دسترس))؛ چک موجودی از هیچ کشی نمی‌آید.
4. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).
5. مرجوعی روی همان فاکتور (`POST /invoices/:x/returns` (آفلاین: در دسترس)).
6. پایان روز: شمارش و بستن صندوق (`POST /pos/sessions/:x/close` (آفلاین: در دسترس)).

### مالی

1. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).
2. فروش نسیه مانده‌ی مشتری را می‌سازد (`GET /payments/open-invoices/:x/:x` (آفلاین: در دسترس)).
3. اقساط برنامه‌ی زمانی است، نه پرداخت (`PUT /invoices/:x/installments` (آفلاین: در دسترس)).
4. ورود و خروج نقد صندوق (`POST /pos/sessions/:x/cash` (آفلاین: در دسترس)).

### منابع (کالا و انبار)

1. خرید = فاکتور خرید در همان جدول فاکتورها (`/invoices?type=purchase`)؛ هر خرید لایه‌ی بهای خودش را می‌سازد.
2. انتقال بین انبارها (`POST /stock-transfers` (آفلاین: در دسترس)).
3. پیشنهاد سفارش دوباره (`GET /inventory/reorder-suggestions` (آفلاین: در دسترس)).
4. موجودی بی‌بها با اقدام صریح ارزش‌گذاری می‌شود (`POST /inventory/unvalued/value` (آفلاین: در دسترس)).

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

| چه چیزی                   | از کجا می‌آید                                            |
| ------------------------- | -------------------------------------------------------- |
| فروش امروز و تعداد فاکتور | `GET /analytics/dashboard` (آفلاین: در دسترس)            |
| صندوق باز و مانده‌ی نقد   | `GET /pos/sessions/current` (آفلاین: در دسترس)           |
| کالاهای رو به اتمام       | `GET /inventory/reorder-suggestions` (آفلاین: در دسترس)  |
| طلب از مشتریان            | `GET /customers` (آفلاین: در دسترس) (مانده به تفکیک ارز) |
| کالای راکد                | `GET /inventory/dead-stock` (آفلاین: در دسترس)           |

## صفحه‌ها

| نشانی               | این خانواده آنجا چه می‌خواند                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/invoices`         | فروش، خرید، مرجوعی و قیمت‌گذاری در یک جدول (`GET /invoices` (آفلاین: در دسترس)).                                               |
| `/warehouse`        | کالا، موجودی هر انبار، قفسه‌ها (`GET /products` (آفلاین: در دسترس)، `GET /warehouses/overview` (آفلاین: در دسترس)).            |
| `/till`             | صندوق نقد هر ارز (`GET /pos/sessions/current` (آفلاین: در دسترس)).                                                             |
| `/customers`        | طرف حساب، مانده به تفکیک ارز، پیگیری (`GET /customers` (آفلاین: در دسترس)، `GET /customers/:x/accounting` (آفلاین: در دسترس)). |
| `/accounting`       | دفتر، خزانه و گزارش‌ها (`GET /accounting/accounts` (آفلاین: در دسترس)).                                                        |
| `/team-and-payroll` | کارمند، حضور و غیاب، حقوق (`GET /employees` (آفلاین: در دسترس)، `GET /payrolls` (آفلاین: در دسترس)).                           |

چیدمان، اقدام‌ها و ده حالت هر صفحه برای همه‌ی خانواده‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). موبایل و ویندوز همان صفحه و همان قرارداد را دارند؛ زیر ۷۶۸px جدول‌ها کارت می‌شوند.

## قواعد حسابداری

- فروش ≠ درآمد تحقق‌یافته ≠ سود: سود فقط از گزارش سود می‌آید و با بهای نامعلوم، «نامعلوم» است.
- بیعانه و پیش‌دریافت بدهی است تا کالا/خدمت تحویل شود؛ درآمد فقط با فاکتور شناخته می‌شود (یک موتور: `order_deposits`).
- فاکتور ارزِ دیگر بدون نرخ ثبت نمی‌شود؛ نرخ روی همان فاکتور منجمد است و مانده‌ی طرف حساب به تفکیک ارز است.
- ارزش موجودی = قیمت خرید؛ روش بها (FIFO یا میانگین موزون) در تنظیمات انبار است (`GET /inventory/settings` (آفلاین: در دسترس)).
- فروش بیش از موجودی رد نمی‌شود؛ ثبت می‌شود و تعارض می‌سازد.

## شکاف‌های خانواده

هیچ قابلیت ساخته‌نشده‌ای در رجیستری برای این خانواده ثبت نیست.

## بر اساس اندازه

تک‌نفره: صاحب کار همه‌ی نقش‌ها را دارد و منو با آچار کوتاه می‌شود. کوچک (چند نفر): نقش‌های پایه کافی است. متوسط: نقش سفارشی در `/governance?tab=permissions` و محدودیت شعبه/انبار. بزرگ: چند شعبه و گردش‌کار تأیید در `/approvals?tab=workflows`. این مرزها تنظیم کسب‌وکار است، نه قاعده‌ی محصول.
