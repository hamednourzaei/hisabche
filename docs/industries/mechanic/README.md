# مکانیکی و سرویس (`mechanic`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

| | |
| --- | --- |
| شناسه | `mechanic` |
| نام | مکانیکی و سرویس · مکانیکی و سرویس · Mechanic and servicing |
| نوع | صنف |
| خانواده | [تعمیرات](../families/repairs.md) |
| پروفایل | `generic` |
| archetype | `SERVICE_REPAIR` |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v59-1-repair-routes-http.test.ts`، `backend/src/__tests__/http-e2e-business-day.test.ts`، `backend/src/__tests__/journey-industries-1.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE` — پروفایل عمومی است؛ چیزی جز هسته‌ی مشترک وعده داده نشده.

**DNA عملیاتی** (از `inferOperationalDna`)

| محور | مقدار |
| --- | --- |
| offering | `DELIVERABLE_SERVICE`، `PHYSICAL_GOODS` |
| intake | `JOB_TICKET` |
| inventory | `SPARE_PARTS` |
| settlement | `DEPOSIT_PREPAYMENT`، `IMMEDIATE_SETTLEMENT` |
| workforce | `UNRESOLVED` |
| customer | `SERVICE_ASSET_PROFILE` |
| topology | `SINGLE_LOCATION` |
| unitTracking | `SERIAL_NUMBERS` |

**ماژول‌های فعال:** `accounting`، `customers`، `inventory`، `invoices`، `job_tickets`، `order_deposits`، `payroll`، `products`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`، `/till`

**داشبورد (ترتیب):** `openRepairTickets`، `workQueue`، `kpis`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: —

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «تعمیرات»

### هویت و مدل کسب‌وکار

پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف. نزدیک‌ترین سند کامل: [repairs](../repairs/README.md).

### گردش کار روزانه

مانند خانواده‌ی «تعمیرات» — تفاوتی نیست. سند: [DAILY-WORKFLOW.md](./DAILY-WORKFLOW.md)

### صفحه‌به‌صفحه

منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/till`. سند: [PAGE-BY-PAGE-UX.md](./PAGE-BY-PAGE-UX.md)

### عملیات و تراکنش

مانند خانواده‌ی «تعمیرات» — تفاوتی نیست. سند: [OPERATIONS-AND-TRANSACTIONS.md](./OPERATIONS-AND-TRANSACTIONS.md)

### KPI و گزارش

قطعه‌ی اختصاصی داشبورد: `openRepairTickets`. سند: [KPI-AND-REPORTS.md](./KPI-AND-REPORTS.md)

### نقش‌ها و دسترسی

مانند خانواده‌ی «تعمیرات» — تفاوتی نیست. سند: [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md)

### آفلاین و دستگاه

مانند خانواده‌ی «تعمیرات» — تفاوتی نیست. سند: [OFFLINE-AND-DEVICE.md](./OFFLINE-AND-DEVICE.md)

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است. سند: [GAPS-AND-REQUIREMENTS.md](./GAPS-AND-REQUIREMENTS.md)
