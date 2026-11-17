# ساخت‌وساز و پیمانکاری — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «ساخت‌وساز»](../families/construction.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.

## پنج اولویت خانواده

| چه چیزی | از کجا می‌آید |
| --- | --- |
| طلب از کارفرمایان | `GET /customers` (آفلاین: در دسترس) (مانده به تفکیک ارز) |
| پیش‌دریافت نگه‌داشته | `GET /customers/:x/deposits` (آفلاین: در دسترس) |
| سود هر مرکز هزینه | `GET /accounting/profit-report/cost-objects` (فقط آنلاین) (فقط آنلاین) |
| بدهی به تأمین‌کننده | `GET /customers` (آفلاین: در دسترس) (نقش تأمین‌کننده) |
| حقوق دوره | `GET /payrolls/summary` (آفلاین: در دسترس) |

## داشبورد این صنف در کد (به ترتیب)

`kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.
