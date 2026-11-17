# آرایشگاه و سلمانی — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «خدمات شخصی»](../families/personal_services.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد. نزدیک‌ترین سند دستی: [beautySalon/KPI-AND-REPORTS.md](../beautySalon/KPI-AND-REPORTS.md) — همان مشخصات را می‌خواند.

## پنج اولویت خانواده

| چه چیزی | از کجا می‌آید |
| --- | --- |
| نوبت‌های امروز به تفکیک متخصص و وضعیت | `GET /analytics/dashboard/today-sessions` (آفلاین: در دسترس) |
| بیعانه‌ی نگه‌داشته | `GET /analytics/dashboard/today-sessions` (آفلاین: در دسترس) (به تفکیک ارز) |
| فروش امروز | `GET /analytics/dashboard` (آفلاین: در دسترس) |
| کمیسیون دوره | `GET /provider-commissions` (فقط آنلاین) |
| مشتریانی که نیامدند | `GET /service-delivery/sessions` (آفلاین: در دسترس) (وضعیت `no_show`) |

## داشبورد این صنف در کد (به ترتیب)

`todaySessions`، `kpis`، `workQueue`، `chart`، `insights`، `activities`، `manufacturing`

شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.
