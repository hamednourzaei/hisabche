# پوشاک (`clothing`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                     |
| --------- | ----------------------------------- |
| شناسه     | `clothing`                          |
| نام       | پوشاک · پوشاک · Clothing            |
| نوع       | صنف                                 |
| خانواده   | [خرده‌فروشی](../families/retail.md) |
| پروفایل   | `specialized`                       |
| archetype | `GENERIC_BUSINESS`                  |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v59-1-clothing-routes-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-1.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

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

**داشبورد (ترتیب):** `lowStockVariants`، `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت     | وضعیت                     | موتور · آفلاین                | شاهد یا محدودیت                 |
| ---------- | ------------------------- | ----------------------------- | ------------------------------- |
| `variants` | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `COST_LAYERS_ARE_PRODUCT_KEYED` |

## تفاوت با خانواده‌ی «خرده‌فروشی»

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
