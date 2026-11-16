# حمل بار و باربری (`freightTransport`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                                   |
| --------- | ----------------------------------------------------------------- |
| شناسه     | `freightTransport`                                                |
| نام       | حمل بار و باربری · حمل بار و باربری · Freight and cargo transport |
| نوع       | صنف                                                               |
| خانواده   | [حمل‌ونقل](../families/transport.md)                              |
| پروفایل   | `specialized`                                                     |
| archetype | `GENERIC_BUSINESS`                                                |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v60-http-families.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-3.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_AND_VERIFIED`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور       | مقدار                  |
| ---------- | ---------------------- |
| offering   | `DELIVERABLE_SERVICE`  |
| intake     | `WALK_IN`              |
| inventory  | `NONE`                 |
| settlement | `IMMEDIATE_SETTLEMENT` |
| workforce  | `UNRESOLVED`           |
| customer   | `STANDARD_PARTY`       |
| topology   | `SINGLE_LOCATION`      |

**ماژول‌های فعال:** `accounting`، `customers`، `delivery`، `invoices`، `payroll`، `team`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`، `/market-seller`، `/till`، `/warehouse`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `kg` · فیلدهای جلو: `unit`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت        | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                         |
| ------------- | ----------------------- | --------------------------- | ------------------------------------------------------- |
| `measurement` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/validation/src/__tests__/measurement.test.ts` |
| `multi_unit`  | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts`    |

## تفاوت با خانواده‌ی «حمل‌ونقل»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (2 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `unit`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`، `/warehouse`. واحد کالای تازه `kg` است.

### عملیات و تراکنش

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
