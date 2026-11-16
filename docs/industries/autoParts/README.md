# قطعات موتر و یدکی (`autoParts`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                               |
| --------- | ------------------------------------------------------------- |
| شناسه     | `autoParts`                                                   |
| نام       | قطعات موتر و یدکی · قطعات موتر و یدکی · Auto parts and spares |
| نوع       | صنف                                                           |
| خانواده   | [خرده‌فروشی](../families/retail.md)                           |
| پروفایل   | `specialized`                                                 |
| archetype | `SERVICE_REPAIR`                                              |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v59-1-mobile-serials-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-4.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور       | مقدار                                        |
| ---------- | -------------------------------------------- |
| offering   | `DELIVERABLE_SERVICE`، `PHYSICAL_GOODS`      |
| intake     | `JOB_TICKET`                                 |
| inventory  | `SPARE_PARTS`                                |
| settlement | `DEPOSIT_PREPAYMENT`، `IMMEDIATE_SETTLEMENT` |
| workforce  | `UNRESOLVED`                                 |
| customer   | `SERVICE_ASSET_PROFILE`                      |
| topology   | `SINGLE_LOCATION`                            |

**ماژول‌های فعال:** `accounting`، `customers`، `inventory`، `invoices`، `job_tickets`، `order_deposits`، `payroll`، `products`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`، `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت          | وضعیت                     | موتور · آفلاین                | شاهد یا محدودیت           |
| --------------- | ------------------------- | ----------------------------- | ------------------------- |
| `auto_fitments` | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `CORE_CHARGE_NOT_APPLIED` |

## تفاوت با خانواده‌ی «خرده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (1 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

نیمه‌کاره: `auto_fitments` (`CORE_CHARGE_NOT_APPLIED`).
