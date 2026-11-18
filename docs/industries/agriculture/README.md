# زراعت و کشاورزی (`agriculture`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

| | |
| --- | --- |
| شناسه | `agriculture` |
| نام | زراعت و کشاورزی · زراعت و کشاورزی · Agriculture and farming |
| نوع | صنف |
| خانواده | [تولید](../families/manufacturing.md) |
| پروفایل | `specialized` |
| archetype | `GENERIC_BUSINESS` |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v60-http-families.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-4.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور | مقدار |
| --- | --- |
| offering | `PHYSICAL_GOODS` |
| intake | `WALK_IN` |
| inventory | `RAW_MATERIALS`، `FINISHED_GOODS` |
| settlement | `IMMEDIATE_SETTLEMENT` |
| workforce | `UNRESOLVED` |
| customer | `STANDARD_PARTY` |
| topology | `SINGLE_LOCATION` |

**ماژول‌های فعال:** `accounting`، `customers`، `inventory`، `invoices`، `payroll`، `products`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `kg` · فیلدهای جلو: `unit`، `sellPrice`، `quantity`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت | وضعیت | موتور · آفلاین | شاهد یا محدودیت |
| --- | --- | --- | --- |
| `measurement` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/validation/src/__tests__/measurement.test.ts` |
| `multi_unit` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts` |
| `batch_expiry` | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `EXPIRY_REPORT_AND_LOT_TRAIL_ONLINE_ONLY` |

**خواسته‌شده و ساخته‌نشده** (`NEW_CAPABILITY_REQUIRED`): `crop_cycle`

## تفاوت با خانواده‌ی «تولید»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (3 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «تولید» — تفاوتی نیست. سند: [DAILY-WORKFLOW.md](./DAILY-WORKFLOW.md)

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `unit`، `sellPrice`، `quantity`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`. واحد کالای تازه `kg` است. سند: [PAGE-BY-PAGE-UX.md](./PAGE-BY-PAGE-UX.md)

### عملیات و تراکنش

مانند خانواده‌ی «تولید» — تفاوتی نیست. سند: [OPERATIONS-AND-TRANSACTIONS.md](./OPERATIONS-AND-TRANSACTIONS.md)

### KPI و گزارش

مانند خانواده‌ی «تولید» — تفاوتی نیست. سند: [KPI-AND-REPORTS.md](./KPI-AND-REPORTS.md)

### نقش‌ها و دسترسی

مانند خانواده‌ی «تولید» — تفاوتی نیست. سند: [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md)

### آفلاین و دستگاه

مانند خانواده‌ی «تولید» — تفاوتی نیست. سند: [OFFLINE-AND-DEVICE.md](./OFFLINE-AND-DEVICE.md)

### شکاف‌ها و نیازمندی‌ها

ساخته‌نشده: `crop_cycle`. نیمه‌کاره: `batch_expiry` (`EXPIRY_REPORT_AND_LOT_TRAIL_ONLINE_ONLY`). سند: [GAPS-AND-REQUIREMENTS.md](./GAPS-AND-REQUIREMENTS.md)
