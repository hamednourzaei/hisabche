# ساخت‌وساز و پیمانکاری (`construction`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                                              |
| --------- | ---------------------------------------------------------------------------- |
| شناسه     | `construction`                                                               |
| نام       | ساخت‌وساز و پیمانکاری · ساخت‌وساز و پیمانکاری · Construction and contracting |
| نوع       | صنف                                                                          |
| خانواده   | [ساخت‌وساز](../families/construction.md)                                     |
| پروفایل   | `specialized`                                                                |
| archetype | `GENERIC_BUSINESS`                                                           |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v60-http-families.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-4.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_AND_VERIFIED`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور       | مقدار                             |
| ---------- | --------------------------------- |
| offering   | `PHYSICAL_GOODS`                  |
| intake     | `WALK_IN`                         |
| inventory  | `RAW_MATERIALS`، `FINISHED_GOODS` |
| settlement | `IMMEDIATE_SETTLEMENT`            |
| workforce  | `UNRESOLVED`                      |
| customer   | `STANDARD_PARTY`                  |
| topology   | `SINGLE_LOCATION`                 |

**ماژول‌های فعال:** `accounting`، `customers`، `inventory`، `invoices`، `payroll`، `products`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت        | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                         |
| ------------- | ----------------------- | --------------------------- | ------------------------------------------------------- |
| `measurement` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/validation/src/__tests__/measurement.test.ts` |
| `multi_unit`  | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts`    |

## تفاوت با خانواده‌ی «ساخت‌وساز»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (2 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «ساخت‌وساز» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «ساخت‌وساز» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «ساخت‌وساز» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «ساخت‌وساز» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «ساخت‌وساز» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
