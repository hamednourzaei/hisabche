# قطعات کامپیوتر (`computerComponents`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                      |
| --------- | ---------------------------------------------------- |
| شناسه     | `computerComponents`                                 |
| نام       | قطعات کامپیوتر · قطعات کمپیوتر · Computer components |
| نوع       | صنف                                                  |
| خانواده   | [خرده‌فروشی](../families/retail.md)                  |
| پروفایل   | `specialized`                                        |
| archetype | `GENERIC_BUSINESS`                                   |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v59-1-mobile-serials-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-2.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور         | مقدار                  |
| ------------ | ---------------------- |
| offering     | `UNRESOLVED`           |
| intake       | `WALK_IN`              |
| inventory    | `UNRESOLVED`           |
| settlement   | `IMMEDIATE_SETTLEMENT` |
| workforce    | `UNRESOLVED`           |
| customer     | `STANDARD_PARTY`       |
| topology     | `SINGLE_LOCATION`      |
| unitTracking | `SERIAL_NUMBERS`       |

**ماژول‌های فعال:** `accounting`، `consumables`، `customers`، `inventory`، `invoices`، `payroll`، `products`، `services`، `team`، `warehouse`

**منوی پیشنهادی — پنهان می‌شود:** `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت             | وضعیت                     | موتور · آفلاین                | شاهد یا محدودیت                        |
| ------------------ | ------------------------- | ----------------------------- | -------------------------------------- |
| `variants`         | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `COST_LAYERS_ARE_PRODUCT_KEYED`        |
| `serialized_items` | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY` |

## تفاوت با خانواده‌ی «خرده‌فروشی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (2 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «خرده‌فروشی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

نیمه‌کاره: `variants` (`COST_LAYERS_ARE_PRODUCT_KEYED`)؛ `serialized_items` (`SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY`).
