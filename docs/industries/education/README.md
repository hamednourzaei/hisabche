# آموزشگاه و کورس (`education`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

| | |
| --- | --- |
| شناسه | `education` |
| نام | آموزشگاه و کورس · آموزشگاه و کورس · Training and courses |
| نوع | صنف |
| خانواده | [آموزش](../families/education.md) |
| پروفایل | `specialized` |
| archetype | `LANGUAGE_TEACHER` |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v60-http-families.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-1.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور | مقدار |
| --- | --- |
| offering | `PACKAGE_SESSION` |
| intake | `CLASS_ATTENDANCE` |
| inventory | `UNRESOLVED` |
| settlement | `PACKAGE_CREDITS`، `DEPOSIT_PREPAYMENT` |
| workforce | `UNRESOLVED` |
| customer | `STUDENT_PROFILE` |
| topology | `SEAT_OR_ROOM_BASED` |

**ماژول‌های فعال:** `accounting`، `attendance`، `consumables`، `customers`، `inventory`، `invoices`، `order_deposits`، `package_credits`، `payroll`، `services`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/market-seller`، `/till`

**داشبورد (ترتیب):** `packageCreditsLow`، `todaySessions`، `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت | وضعیت | موتور · آفلاین | شاهد یا محدودیت |
| --- | --- | --- | --- |
| `package_credits` | `EXISTING_BUT_INCOMPLETE` | `package_credits` · partial | `GRANT_ACTIVATION_POLICY_BASIC` |

## تفاوت با خانواده‌ی «آموزش»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (1 قابلیت روشن).

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
