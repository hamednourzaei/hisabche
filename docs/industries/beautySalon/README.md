# ناخن و سالن زیبایی (`beautySalon`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

| | |
| --- | --- |
| شناسه | `beautySalon` |
| نام | ناخن و سالن زیبایی · ناخن و سالون زیبایی · Nails and beauty salon |
| نوع | صنف |
| خانواده | [خدمات شخصی](../families/personal_services.md) |
| پروفایل | `generic` |
| archetype | `NAIL_TECH_BEAUTY` |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/service-delivery-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-4.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE` — پروفایل عمومی است؛ چیزی جز هسته‌ی مشترک وعده داده نشده.

**DNA عملیاتی** (از `inferOperationalDna`)

| محور | مقدار |
| --- | --- |
| offering | `TIME_SERVICE` |
| intake | `APPOINTMENT_BOOKING` |
| inventory | `SERVICE_CONSUMABLES` |
| settlement | `DEPOSIT_PREPAYMENT`، `IMMEDIATE_SETTLEMENT` |
| workforce | `UNRESOLVED` |
| customer | `CLIENT_CARE_PROFILE` |
| topology | `RESOURCE_CAPACITY` |

**ماژول‌های فعال:** `accounting`، `appointments`، `consumables`، `customers`، `invoices`، `order_deposits`، `payroll`، `services`، `team`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`، `/market-seller`، `/till`

**داشبورد (ترتیب):** `todaySessions`، `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «خدمات شخصی»

### هویت و مدل کسب‌وکار

پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف.

### گردش کار روزانه

سند کامل: [DAILY-WORKFLOW.md](./DAILY-WORKFLOW.md)

### صفحه‌به‌صفحه

سند کامل: [PAGE-BY-PAGE-UX.md](./PAGE-BY-PAGE-UX.md)

### عملیات و تراکنش

سند کامل: [OPERATIONS-AND-TRANSACTIONS.md](./OPERATIONS-AND-TRANSACTIONS.md)

### KPI و گزارش

سند کامل: [KPI-AND-REPORTS.md](./KPI-AND-REPORTS.md)

### نقش‌ها و دسترسی

سند کامل: [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md)

### آفلاین و دستگاه

سند کامل: [OFFLINE-AND-DEVICE.md](./OFFLINE-AND-DEVICE.md)

### شکاف‌ها و نیازمندی‌ها

سند کامل: [GAPS-AND-REQUIREMENTS.md](./GAPS-AND-REQUIREMENTS.md)
