# مواد ساختمانی (`buildingMaterials`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                    |
| --------- | -------------------------------------------------- |
| شناسه     | `buildingMaterials`                                |
| نام       | مواد ساختمانی · مواد ساختمانی · Building materials |
| نوع       | صنف                                                |
| خانواده   | [عمده‌فروشی](../families/wholesale.md)             |
| پروفایل   | `specialized`                                      |
| archetype | `GENERIC_BUSINESS`                                 |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/http-e2e-business-day.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-1.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_AND_VERIFIED`

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

**کالای تازه:** واحد `kg` · فیلدهای جلو: `unit`، `quantity`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت        | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                         |
| ------------- | ----------------------- | --------------------------- | ------------------------------------------------------- |
| `measurement` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/validation/src/__tests__/measurement.test.ts` |
| `multi_unit`  | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts`    |

## تفاوت با خانواده‌ی «عمده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (2 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «عمده‌فروشی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `unit`، `quantity`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`. واحد کالای تازه `kg` است.

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
