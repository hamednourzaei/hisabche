# ترانسپورت و باربری — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «حمل‌ونقل»](../families/transport.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## پنج اولویت خانواده

| چه چیزی        | از کجا می‌آید                                                |
| -------------- | ------------------------------------------------------------ |
| سفرهای امروز   | `GET /analytics/dashboard/today-sessions` (آفلاین: در دسترس) |
| طلب از مشتریان | `GET /customers` (آفلاین: در دسترس) (مانده به تفکیک ارز)     |
| فروش دوره      | `GET /analytics/sales` (آفلاین: در دسترس)                    |
| رزرو وسیله‌ها  | `GET /resource-bookings` (آفلاین: در دسترس)                  |
| حقوق دوره      | `GET /payrolls/summary` (آفلاین: در دسترس)                   |

## داشبورد این صنف در کد (به ترتیب)

`kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.
