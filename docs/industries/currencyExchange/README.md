# صرافی (`currencyExchange`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                   |
| --------- | ------------------------------------------------- |
| شناسه     | `currencyExchange`                                |
| نام       | صرافی · صرافی · Currency exchange                 |
| نوع       | صنف                                               |
| خانواده   | [مالی و بازرگانی](../families/finance_trading.md) |
| پروفایل   | `generic`                                         |
| archetype | `GENERIC_BUSINESS`                                |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v59-1-exchange-gl-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-3.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `CONFIGURATION_REQUIRED` — پروفایل عمومی است؛ چیزی جز هسته‌ی مشترک وعده داده نشده.

**DNA عملیاتی** (از `inferOperationalDna`)

| محور       | مقدار                  |
| ---------- | ---------------------- |
| offering   | `UNRESOLVED`           |
| intake     | `WALK_IN`              |
| inventory  | `UNRESOLVED`           |
| settlement | `IMMEDIATE_SETTLEMENT` |
| workforce  | `UNRESOLVED`           |
| customer   | `STANDARD_PARTY`       |
| topology   | `SINGLE_LOCATION`      |

**ماژول‌های فعال:** `accounting`، `consumables`، `customers`، `inventory`، `invoices`، `payroll`، `products`، `services`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: —

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «مالی و بازرگانی»

### هویت و مدل کسب‌وکار

پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف.

### گردش کار روزانه

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### صفحه‌به‌صفحه

منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
