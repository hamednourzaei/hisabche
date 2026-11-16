# ترانسپورت و باربری (`transport`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                                 |
| --------- | --------------------------------------------------------------- |
| شناسه     | `transport`                                                     |
| نام       | ترانسپورت و باربری · ترانسپورت و باربری · Transport and freight |
| نوع       | صنف                                                             |
| خانواده   | [حمل‌ونقل](../families/transport.md)                            |
| پروفایل   | `specialized`                                                   |
| archetype | `GENERIC_BUSINESS`                                              |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v60-http-families.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-2.pg.test.ts`
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

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت       | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                      |
| ------------ | ----------------------- | --------------------------- | ---------------------------------------------------- |
| `multi_unit` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts` |

## تفاوت با خانواده‌ی «حمل‌ونقل»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (1 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست. سند: [DAILY-WORKFLOW.md](./DAILY-WORKFLOW.md)

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`، `/warehouse`. سند: [PAGE-BY-PAGE-UX.md](./PAGE-BY-PAGE-UX.md)

### عملیات و تراکنش

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست. سند: [OPERATIONS-AND-TRANSACTIONS.md](./OPERATIONS-AND-TRANSACTIONS.md)

### KPI و گزارش

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست. سند: [KPI-AND-REPORTS.md](./KPI-AND-REPORTS.md)

### نقش‌ها و دسترسی

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست. سند: [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md)

### آفلاین و دستگاه

مانند خانواده‌ی «حمل‌ونقل» — تفاوتی نیست. سند: [OFFLINE-AND-DEVICE.md](./OFFLINE-AND-DEVICE.md)

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است. سند: [GAPS-AND-REQUIREMENTS.md](./GAPS-AND-REQUIREMENTS.md)
