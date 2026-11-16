# خشکبار و آجیل (`nuts`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                      |
| --------- | ---------------------------------------------------- |
| شناسه     | `nuts`                                               |
| نام       | خشکبار و آجیل · خشکبار و آجیل · Dried fruit and nuts |
| نوع       | صنف                                                  |
| خانواده   | [خرده‌فروشی](../families/retail.md)                  |
| پروفایل   | `specialized`                                        |
| archetype | `RETAIL_STORE`                                       |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/http-e2e-business-day.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-3.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_AND_VERIFIED`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور         | مقدار                  |
| ------------ | ---------------------- |
| offering     | `PHYSICAL_GOODS`       |
| intake       | `COUNTER_POS`          |
| inventory    | `RETAIL_STOCK`         |
| settlement   | `IMMEDIATE_SETTLEMENT` |
| workforce    | `UNRESOLVED`           |
| customer     | `STANDARD_PARTY`       |
| topology     | `SINGLE_LOCATION`      |
| unitTracking | `EXPIRY_DATES`         |

**ماژول‌های فعال:** `accounting`، `customers`، `inventory`، `invoices`، `payroll`، `pos`، `products`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `kg` · فیلدهای جلو: `unit`، `sellPrice`، `quantity`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت        | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                         |
| ------------- | ----------------------- | --------------------------- | ------------------------------------------------------- |
| `measurement` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/validation/src/__tests__/measurement.test.ts` |
| `multi_unit`  | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts`    |

## تفاوت با خانواده‌ی «خرده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (2 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `unit`، `sellPrice`، `quantity`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`. واحد کالای تازه `kg` است.

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
