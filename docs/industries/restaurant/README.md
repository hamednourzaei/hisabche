# رستوران (`restaurant`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                  |
| --------- | ------------------------------------------------ |
| شناسه     | `restaurant`                                     |
| نام       | رستوران · رستوران · Restaurant                   |
| نوع       | صنف                                              |
| خانواده   | [غذا و پذیرایی](../families/food_hospitality.md) |
| پروفایل   | `specialized`                                    |
| archetype | `GENERIC_BUSINESS`                               |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/http-e2e-business-day.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-2.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `CONFIGURATION_REQUIRED`

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

**داشبورد (ترتیب):** `workQueue`، `kpis`، `chart`، `activities`، `insights`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «غذا و پذیرایی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (0 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «غذا و پذیرایی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «غذا و پذیرایی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «غذا و پذیرایی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «غذا و پذیرایی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «غذا و پذیرایی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
