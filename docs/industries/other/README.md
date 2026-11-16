# کسب‌وکارت پیدا نشد؟ (سایر) (`other`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                                                     |
| --------- | ----------------------------------------------------------------------------------- |
| شناسه     | `other`                                                                             |
| نام       | کسب‌وکارت پیدا نشد؟ (سایر) · تجارتت پیدا نشد؟ (سایر) · Business not listed? (Other) |
| نوع       | سایر                                                                                |
| خانواده   | [خرده‌فروشی](../families/retail.md)                                                 |
| پروفایل   | `generic`                                                                           |
| archetype | `GENERIC_BUSINESS`                                                                  |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/http-e2e-business-day.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-3.pg.test.ts`
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

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «خرده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف.

### گردش کار روزانه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`.

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
