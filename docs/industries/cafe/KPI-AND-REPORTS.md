# کافه و قهوه‌خانه — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «غذا و پذیرایی»](../families/food_hospitality.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## پنج اولویت خانواده

| چه چیزی          | از کجا می‌آید                                           |
| ---------------- | ------------------------------------------------------- |
| فروش امروز       | `GET /analytics/dashboard` (آفلاین: در دسترس)           |
| صندوق باز        | `GET /pos/sessions/current` (آفلاین: در دسترس)          |
| مواد رو به اتمام | `GET /inventory/reorder-suggestions` (آفلاین: در دسترس) |
| بهای تولید       | `GET /manufacturing/report` (فقط آنلاین) (فقط آنلاین)   |
| جریان نقد        | `GET /pos/cash-flow` (آفلاین: در دسترس)                 |

## داشبورد این صنف در کد (به ترتیب)

`workQueue`، `kpis`، `chart`، `activities`، `insights`، `manufacturing`

شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.
