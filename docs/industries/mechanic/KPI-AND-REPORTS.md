# مکانیکی و سرویس — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «تعمیرات»](../families/repairs.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد. نزدیک‌ترین سند دستی: [repairs/KPI-AND-REPORTS.md](../repairs/KPI-AND-REPORTS.md) — همان مشخصات را می‌خواند.

## پنج اولویت خانواده

| چه چیزی                       | از کجا می‌آید                                                     |
| ----------------------------- | ----------------------------------------------------------------- |
| پرونده‌های باز به تفکیک وضعیت | `GET /analytics/dashboard/open-repair-tickets` (آفلاین: در دسترس) |
| کارهای آماده‌ی تحویل          | `GET /repair-tickets` (فقط آنلاین) (وضعیت `ready`)                |
| منتظر قطعه                    | `GET /repair-tickets` (فقط آنلاین) (وضعیت `waiting_parts`)        |
| فروش امروز                    | `GET /analytics/dashboard` (آفلاین: در دسترس)                     |
| قطعه‌های رو به اتمام          | `GET /inventory/reorder-suggestions` (آفلاین: در دسترس)           |

## داشبورد این صنف در کد (به ترتیب)

`openRepairTickets`، `workQueue`، `kpis`، `chart`، `insights`، `activities`، `manufacturing`

شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.
