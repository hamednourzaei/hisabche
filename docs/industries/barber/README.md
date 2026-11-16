# آرایشگاه و سلمانی (`barber`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                          |
| --------- | -------------------------------------------------------- |
| شناسه     | `barber`                                                 |
| نام       | آرایشگاه و سلمانی · آرایشگاه و سلمانی · Barber and salon |
| نوع       | صنف                                                      |
| خانواده   | [خدمات شخصی](../families/personal_services.md)           |
| پروفایل   | `specialized`                                            |
| archetype | `NAIL_TECH_BEAUTY`                                       |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/service-delivery-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-3.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `EXISTING_BUT_INCOMPLETE`

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

**داشبورد (ترتیب):** `todaySessions`، `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

**کالای تازه:** واحد `piece` · فیلدهای جلو: `name`، `sellPrice`

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «خدمات شخصی»

### هویت و مدل کسب‌وکار

پروفایل اختصاصی دارد (0 قابلیت روشن). نزدیک‌ترین سند کامل: [beautySalon](../beautySalon/README.md).

### گردش کار روزانه

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### صفحه‌به‌صفحه

فرم کالا این فیلدها را جلو می‌گذارد: `name`، `sellPrice`. منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### KPI و گزارش

قطعه‌ی اختصاصی داشبورد: `todaySessions`.

### نقش‌ها و دسترسی

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «خدمات شخصی» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
