# نمایشگاه موتر (`carDealer`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                   |
| --------- | ------------------------------------------------- |
| شناسه     | `carDealer`                                       |
| نام       | نمایشگاه موتر · نمایشگاه موتر · Car dealership    |
| نوع       | صنف                                               |
| خانواده   | [مالی و بازرگانی](../families/finance_trading.md) |
| پروفایل   | `specialized`                                     |
| archetype | `GENERIC_BUSINESS`                                |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/v59-1-mobile-serials-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-4.pg.test.ts`
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
| `serialized_items` | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY` |
| `auto_fitments`    | `EXISTING_BUT_INCOMPLETE` | `inventory_catalog` · partial | `CORE_CHARGE_NOT_APPLIED`              |

## تفاوت با خانواده‌ی «مالی و بازرگانی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (2 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «مالی و بازرگانی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

نیمه‌کاره: `serialized_items` (`SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY`)؛ `auto_fitments` (`CORE_CHARGE_NOT_APPLIED`).
