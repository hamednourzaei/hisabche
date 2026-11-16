# عمده‌فروشی (`wholesale`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                        |
| --------- | -------------------------------------- |
| شناسه     | `wholesale`                            |
| نام       | عمده‌فروشی · عمده‌فروشی · Wholesale    |
| نوع       | مدل فروش                               |
| خانواده   | [عمده‌فروشی](../families/wholesale.md) |
| پروفایل   | `generic`                              |
| archetype | `GENERIC_BUSINESS`                     |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v60-http-families.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-1.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `CONFIGURATION_REQUIRED` — پروفایل عمومی است؛ چیزی جز هسته‌ی مشترک وعده داده نشده.

**DNA عملیاتی** (از `inferOperationalDna`)

| محور       | مقدار                                     |
| ---------- | ----------------------------------------- |
| offering   | `PHYSICAL_GOODS`                          |
| intake     | `WALK_IN`                                 |
| inventory  | `RETAIL_STOCK`                            |
| settlement | `IMMEDIATE_SETTLEMENT`، `CUSTOMER_CREDIT` |
| workforce  | `UNRESOLVED`                              |
| customer   | `STANDARD_PARTY`                          |
| topology   | `SINGLE_LOCATION`                         |

**ماژول‌های فعال:** `accounting`، `customers`، `inventory`، `invoices`، `payroll`، `products`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`، `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: —

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «عمده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف.

### گردش کار روزانه

مانند خانواده‌ی «عمده‌فروشی» — تفاوتی نیست.

### صفحه‌به‌صفحه

منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «عمده‌فروشی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «عمده‌فروشی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «عمده‌فروشی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «عمده‌فروشی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
