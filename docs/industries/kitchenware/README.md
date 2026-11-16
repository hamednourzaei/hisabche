# ظروف و لوازم آشپزخانه (`kitchenware`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                             |
| --------- | ----------------------------------------------------------- |
| شناسه     | `kitchenware`                                               |
| نام       | ظروف و لوازم آشپزخانه · ظروف و لوازم آشپزخانه · Kitchenware |
| نوع       | صنف                                                         |
| خانواده   | [خرده‌فروشی](../families/retail.md)                         |
| پروفایل   | `generic`                                                   |
| archetype | `RETAIL_STORE`                                              |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/http-e2e-business-day.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-2.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `CONFIGURATION_REQUIRED` — پروفایل عمومی است؛ چیزی جز هسته‌ی مشترک وعده داده نشده.

**DNA عملیاتی** (از `inferOperationalDna`)

| محور       | مقدار                  |
| ---------- | ---------------------- |
| offering   | `PHYSICAL_GOODS`       |
| intake     | `COUNTER_POS`          |
| inventory  | `RETAIL_STOCK`         |
| settlement | `IMMEDIATE_SETTLEMENT` |
| workforce  | `UNRESOLVED`           |
| customer   | `STANDARD_PARTY`       |
| topology   | `SINGLE_LOCATION`      |

**ماژول‌های فعال:** `accounting`، `customers`، `inventory`، `invoices`، `payroll`، `pos`، `products`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «خرده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف.

### گردش کار روزانه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`.

### عملیات و تراکنش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
