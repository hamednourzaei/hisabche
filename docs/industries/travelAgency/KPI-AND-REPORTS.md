# آژانس مسافرتی — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «اقامت و گردشگری»](../families/tourism_lodging.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## پنج اولویت خانواده

| چه چیزی | از کجا می‌آید |
| --- | --- |
| رزروهای پیش رو | `GET /resource-bookings` (آفلاین: در دسترس) |
| بیعانه‌ی نگه‌داشته | `GET /customers/:x/deposits` (آفلاین: در دسترس) |
| فروش دوره | `GET /analytics/sales` (آفلاین: در دسترس) |
| بدهی به تأمین‌کننده | `GET /customers` (آفلاین: در دسترس) (نقش تأمین‌کننده) |
| سود به تفکیک ارز | `GET /accounting/profit-report/by-currency` (آفلاین: در دسترس) |

## داشبورد این صنف در کد (به ترتیب)

`kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.
