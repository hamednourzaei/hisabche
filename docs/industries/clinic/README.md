# کلینیک و مطب (`clinic`)

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## حقایق از کد

|           |                                                  |
| --------- | ------------------------------------------------ |
| شناسه     | `clinic`                                         |
| نام       | کلینیک و مطب · کلینیک و مطب · Clinic and surgery |
| نوع       | صنف                                              |
| خانواده   | [سلامت](../families/health.md)                   |
| پروفایل   | `generic`                                        |
| archetype | `NAIL_TECH_BEAUTY`                               |

**وضعیت**

- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): `EXISTING_BUT_INCOMPLETE` — `backend/src/__tests__/service-delivery-http.test.ts`، `backend/src/__tests__/financial-flows-e2e.test.ts`، `backend/src/__tests__/journey-industries-3.pg.test.ts`
- تجربه‌ی اختصاصی صنف: `CONFIGURATION_REQUIRED` — پروفایل عمومی است؛ چیزی جز هسته‌ی مشترک وعده داده نشده.

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

**کالای تازه:** واحد `piece` · فیلدهای جلو: —

**ستون‌های اضافه‌ی فاکتور:** —

**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.

## تفاوت با خانواده‌ی «سلامت»

### هویت و مدل کسب‌وکار

پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف.

### گردش کار روزانه

مانند خانواده‌ی «سلامت» — تفاوتی نیست.

### صفحه‌به‌صفحه

منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: `/manufacturing`، `/market-seller`، `/till`.

### عملیات و تراکنش

مانند خانواده‌ی «سلامت» — تفاوتی نیست.

### KPI و گزارش

مانند خانواده‌ی «سلامت» — تفاوتی نیست.

### نقش‌ها و دسترسی

مانند خانواده‌ی «سلامت» — تفاوتی نیست.

### آفلاین و دستگاه

مانند خانواده‌ی «سلامت» — تفاوتی نیست.

### شکاف‌ها و نیازمندی‌ها

شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.
