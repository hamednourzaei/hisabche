# خواروبار و سوپرمارکت — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «خرده‌فروشی»](../families/retail.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## پنج اولویت خانواده

| چه چیزی                   | از کجا می‌آید                                            |
| ------------------------- | -------------------------------------------------------- |
| فروش امروز و تعداد فاکتور | `GET /analytics/dashboard` (آفلاین: در دسترس)            |
| صندوق باز و مانده‌ی نقد   | `GET /pos/sessions/current` (آفلاین: در دسترس)           |
| کالاهای رو به اتمام       | `GET /inventory/reorder-suggestions` (آفلاین: در دسترس)  |
| طلب از مشتریان            | `GET /customers` (آفلاین: در دسترس) (مانده به تفکیک ارز) |
| کالای راکد                | `GET /inventory/dead-stock` (آفلاین: در دسترس)           |

## داشبورد این صنف در کد (به ترتیب)

`kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.
