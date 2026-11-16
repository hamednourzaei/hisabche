# عینک‌فروشی (`optician`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                    |
| --------- | ---------------------------------- |
| شناسه     | `optician`                         |
| نام       | عینک‌فروشی · عینک‌فروشی · Optician |
| نوع       | صنف                                |
| خانواده   | [سلامت](../families/health.md)     |
| پروفایل   | `specialized`                      |
| archetype | `NAIL_TECH_BEAUTY`                 |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/service-delivery-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-4.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور         | مقدار                                        |
| ------------ | -------------------------------------------- |
| offering     | `TIME_SERVICE`                               |
| intake       | `APPOINTMENT_BOOKING`                        |
| inventory    | `SERVICE_CONSUMABLES`                        |
| settlement   | `DEPOSIT_PREPAYMENT`، `IMMEDIATE_SETTLEMENT` |
| workforce    | `UNRESOLVED`                                 |
| customer     | `CLIENT_CARE_PROFILE`                        |
| topology     | `RESOURCE_CAPACITY`                          |
| unitTracking | `SERIAL_NUMBERS`                             |

**ماژول‌های فعال:** `accounting`، `appointments`، `consumables`، `customers`، `invoices`، `order_deposits`، `payroll`، `services`، `team`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`، `/market-seller`، `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت             | وضعیت                     | موتور · آفلاین                | شاهد یا محدودیت                                      |
| ------------------ | ------------------------- | ----------------------------- | ---------------------------------------------------- |
| `multi_unit`       | `EXISTING_AND_VERIFIED`   | `sales_invoice` · available   | `packages/ui/src/__tests__/product-unit-set.test.ts` |
| `batch_expiry`     | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `BATCH_RETURN_RESTORE_MISSING`                       |
| `serialized_items` | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY`               |

## تفاوت با خانواده‌ی «سلامت»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (3 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [DAILY-WORKFLOW.md](./DAILY-WORKFLOW.md)

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`. سند: [PAGE-BY-PAGE-UX.md](./PAGE-BY-PAGE-UX.md)

### عملیات و تراکنش

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [OPERATIONS-AND-TRANSACTIONS.md](./OPERATIONS-AND-TRANSACTIONS.md)

### KPI و گزارش

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [KPI-AND-REPORTS.md](./KPI-AND-REPORTS.md)

### نقش‌ها و دسترسی

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md)

### آفلاین و دستگاه

مانند خانواده‌ی «سلامت» — تفاوتی نیست. سند: [OFFLINE-AND-DEVICE.md](./OFFLINE-AND-DEVICE.md)

### شکاف‌ها و نیازمندی‌ها

نیمه‌کاره: `batch_expiry` (`BATCH_RETURN_RESTORE_MISSING`)؛ `serialized_items` (`SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY`). سند: [GAPS-AND-REQUIREMENTS.md](./GAPS-AND-REQUIREMENTS.md)
