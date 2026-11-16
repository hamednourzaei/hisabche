# تولیدی و کارگاه (`manufacturing`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                                |
| --------- | -------------------------------------------------------------- |
| شناسه     | `manufacturing`                                                |
| نام       | تولیدی و کارگاه · تولیدی و کارگاه · Manufacturing and workshop |
| نوع       | صنف                                                            |
| خانواده   | [تولید](../families/manufacturing.md)                          |
| پروفایل   | `specialized`                                                  |
| archetype | `GENERIC_BUSINESS`                                             |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/manufacturing-page-500s.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-1.pg.test.ts`
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

**داشبورد (ترتیب):** `manufacturing`، `workQueue`، `kpis`، `chart`، `insights`، `activities`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `unit`، `quantity`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت       | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                      |
| ------------ | ----------------------- | --------------------------- | ---------------------------------------------------- |
| `multi_unit` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts` |

## تفاوت با خانواده‌ی «تولید»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (1 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «تولید» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `unit`، `quantity`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «تولید» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «تولید» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «تولید» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «تولید» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
