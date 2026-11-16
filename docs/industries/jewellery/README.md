# طلا و جواهر (`jewellery`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                |
| --------- | ---------------------------------------------- |
| شناسه     | `jewellery`                                    |
| نام       | طلا و جواهر · طلا و جواهر · Gold and jewellery |
| نوع       | صنف                                            |
| خانواده   | [خرده‌فروشی](../families/retail.md)            |
| پروفایل   | `specialized`                                  |
| archetype | `GENERIC_BUSINESS`                             |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v59-1-gold-routes-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-4.pg.test.ts`
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

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `activities`، `insights`، `manufacturing`

**کالای تازه:** واحد `gram` · فیلدهای جلو: `unit`، `sellPrice`، `quantity`

**ستون‌های اضافه‌ی فاکتور:** `weightGrams`

**قابلیت‌های روشن**

| قابلیت           | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                               |
| ---------------- | ----------------------- | --------------------------- | ------------------------------------------------------------- |
| `measurement`    | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/validation/src/__tests__/measurement.test.ts`       |
| `weight_pricing` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/validation/src/__tests__/column-multiplier.test.ts` |
| `multi_unit`     | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts`          |

## تفاوت با خانواده‌ی «خرده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (3 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست. سند: [DAILY-WORKFLOW.md](./DAILY-WORKFLOW.md)

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `unit`، `sellPrice`، `quantity`. فاکتور این ستون‌ها را از اول نشان می‌دهد: `weightGrams`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`. واحد کالای تازه `gram` است. سند: [PAGE-BY-PAGE-UX.md](./PAGE-BY-PAGE-UX.md)

### عملیات و تراکنش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست. سند: [OPERATIONS-AND-TRANSACTIONS.md](./OPERATIONS-AND-TRANSACTIONS.md)

### KPI و گزارش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست. سند: [KPI-AND-REPORTS.md](./KPI-AND-REPORTS.md)

### نقش‌ها و دسترسی

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست. سند: [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md)

### آفلاین و دستگاه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست. سند: [OFFLINE-AND-DEVICE.md](./OFFLINE-AND-DEVICE.md)

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است. سند: [GAPS-AND-REQUIREMENTS.md](./GAPS-AND-REQUIREMENTS.md)
