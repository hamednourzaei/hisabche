# عکاسی و فیلم‌برداری (`photography`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                                   |
| --------- | ----------------------------------------------------------------- |
| شناسه     | `photography`                                                     |
| نام       | عکاسی و فیلم‌برداری · عکاسی و فیلم‌برداری · Photography and video |
| نوع       | صنف                                                               |
| خانواده   | [خدمات شخصی](../families/personal_services.md)                    |
| پروفایل   | `specialized`                                                     |
| archetype | `NAIL_TECH_BEAUTY`                                                |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/service-delivery-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-2.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_AND_VERIFIED`

**DNA عملیاتی** (از `inferOperationalDna`)

| محور       | مقدار                                        |
| ---------- | -------------------------------------------- |
| offering   | `TIME_SERVICE`                               |
| intake     | `APPOINTMENT_BOOKING`                        |
| inventory  | `SERVICE_CONSUMABLES`                        |
| settlement | `DEPOSIT_PREPAYMENT`، `IMMEDIATE_SETTLEMENT` |
| workforce  | `UNRESOLVED`                                 |
| customer   | `CLIENT_CARE_PROFILE`                        |
| topology   | `RESOURCE_CAPACITY`                          |

**ماژول‌های فعال:** `accounting`، `appointments`، `consumables`، `customers`، `invoices`، `order_deposits`، `payroll`، `services`، `team`

**منوی پیشنهادی — پنهان می‌شود:** `/manufacturing`، `/market-seller`، `/till`

**داشبورد (ترتیب):** `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن**

| قابلیت       | وضعیت                   | موتور · آفلاین              | شاهد یا محدودیت                                      |
| ------------ | ----------------------- | --------------------------- | ---------------------------------------------------- |
| `multi_unit` | `EXISTING_AND_VERIFIED` | `sales_invoice` · available | `packages/ui/src/__tests__/product-unit-set.test.ts` |

## تفاوت با خانواده‌ی «خدمات شخصی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (1 قابلیت روشن).

### گردش کار روزانه

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
