# دواخانه و داروخانه (`pharmacy`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

| | |
| --- | --- |
| شناسه | `pharmacy` |
| نام | دواخانه و داروخانه · دواخانه و داروخانه · Pharmacy |
| نوع | صنف |
| خانواده | [سلامت](../families/health.md) |
| پروفایل | `specialized` |
| archetype | `GENERIC_BUSINESS` |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/service-delivery-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-2.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور | مقدار |
| --- | --- |
| offering | `UNRESOLVED` |
| intake | `WALK_IN` |
| inventory | `UNRESOLVED` |
| settlement | `IMMEDIATE_SETTLEMENT` |
| workforce | `UNRESOLVED` |
| customer | `STANDARD_PARTY` |
| topology | `SINGLE_LOCATION` |
| unitTracking | `EXPIRY_DATES` |

**ماژول‌های فعال:** `accounting`، `consumables`، `customers`، `inventory`، `invoices`، `payroll`، `products`، `services`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `unit`، `sellPrice`، `quantity`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت | وضعیت | موتور · آفلاین | شاهد یا محدودیت |
| --- | --- | --- | --- |
| `multi_unit` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts` |
| `batch_expiry` | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `EXPIRY_REPORT_AND_LOT_TRAIL_ONLINE_ONLY` |

**خواسته‌شده و ساخته‌نشده** (`NEW_CAPABILITY_REQUIRED`): `pharmacy_prescription`، `pharmacy_dispensing`، `insurance_claims`

## تفاوت با خانواده‌ی «سلامت»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (2 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [DAILY-WORKFLOW.md](./DAILY-WORKFLOW.md)

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `unit`، `sellPrice`، `quantity`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`. سند: [PAGE-BY-PAGE-UX.md](./PAGE-BY-PAGE-UX.md)

### عملیات و تراکنش

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [OPERATIONS-AND-TRANSACTIONS.md](./OPERATIONS-AND-TRANSACTIONS.md)

### KPI و گزارش

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [KPI-AND-REPORTS.md](./KPI-AND-REPORTS.md)

### نقش‌ها و دسترسی

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md)

### آفلاین و دستگاه

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [OFFLINE-AND-DEVICE.md](./OFFLINE-AND-DEVICE.md)

### شکاف‌ها و نیازمندی‌ها

ساخته‌نشده: `pharmacy_prescription`، `pharmacy_dispensing`، `insurance_claims`. نیمه‌کاره: `batch_expiry` (`EXPIRY_REPORT_AND_LOT_TRAIL_ONLINE_ONLY`). سند: [GAPS-AND-REQUIREMENTS.md](./GAPS-AND-REQUIREMENTS.md)
