# آرایشگاه و سلمانی — گردش کار روزانه

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این صنف سند دستی جدا ندارد. این سند از [خانواده‌ی «خدمات شخصی»](../families/personal_services.md) و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد. نزدیک‌ترین سند دستی: [beautySalon/DAILY-WORKFLOW.md](../beautySalon/DAILY-WORKFLOW.md) — همان مشخصات را می‌خواند.

## چرخه‌ی تراکنش اصلی

1. نوبت‌دهی
2. حضور مشتری
3. ارائه‌ی خدمت
4. فاکتور و دریافت
5. کمیسیون متخصص
6. نوبت بعد

## اصلی (نوبت تا تحویل)

1. نوبت = جلسه‌ی خدمت (`POST /service-delivery/sessions` (آفلاین: در دسترس)).
2. «حاضر شد / شروع شد / نیامد» بدون پول (`POST /service-delivery/sessions/:x/status` (آفلاین: در دسترس)).
3. تحویل خدمت فاکتور می‌سازد (`POST /service-delivery/sessions/:x/deliver` (آفلاین: در دسترس)).
4. دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود (`POST /payments` (آفلاین: در دسترس)).

## مالی

1. بیعانه‌ی نوبت پیش‌دریافت مشتری است (`GET /customers/:x/deposits` (آفلاین: در دسترس)).
2. صندوق روز در `/till` باز می‌شود (`POST /pos/sessions` (آفلاین: در دسترس)).
3. کمیسیون از نرخ تعریف‌شده حساب می‌شود (`GET /provider-commissions` (فقط آنلاین)) — بی‌نرخ، کمیسیونی ساخته نمی‌شود.
4. پایان روز: شمارش و بستن صندوق (`POST /pos/sessions/:x/close` (آفلاین: در دسترس)).

## منابع (وقت و مواد)

1. صندلی/اتاق با رزرو منبع نگه داشته می‌شود (`POST /resource-bookings` (آفلاین: در دسترس)).
2. مواد مصرفی کالاست و با خرید وارد می‌شود (`/invoices?type=purchase`).
3. ضایعات مواد (`POST /products/:x/waste` (فقط آنلاین)) — فقط آنلاین.
4. لغو جلسه (`POST /service-delivery/sessions/:x/cancel` (آفلاین: در دسترس)).

## نیروی انسانی

1. کارمندان در `/team-and-payroll` تعریف می‌شوند (`POST /employees` (آفلاین: در دسترس)).
2. برگه‌ی حضور و غیاب (`PUT /attendance-sheet` (آفلاین: در دسترس)) — «ثبت‌نشده» غایب نیست و به حقوق وصل نیست.
3. حقوق ثبت و تسویه می‌شود (`POST /payrolls` (آفلاین: در دسترس)، `PATCH /payrolls/:x` (آفلاین: در دسترس))؛ «پرداخت‌شده» نهایی است.
4. مرخصی درخواست و تصمیم‌گیری می‌شود (`POST /leaves` (آفلاین: در دسترس)، `PATCH /leaves/:x` (آفلاین: در دسترس)).

## مدیریتی

1. داشبورد (`/dashboard`، `GET /analytics/dashboard` (آفلاین: در دسترس)) — رقمی که شخص مجوزش را ندارد حذف می‌شود، صفر نشان داده نمی‌شود.
2. گزارش سود به تفکیک ارز (`GET /accounting/profit-report/by-currency` (آفلاین: در دسترس)) در `/accounting?tab=reports`؛ بهای نامعلوم «نامعلوم» می‌ماند.
3. تراز آزمایشی (`GET /accounting/trial-balance` (آفلاین: در دسترس)) و دفتر (`GET /accounting/journal` (آفلاین: در دسترس)) در `/accounting`.
4. تأیید سندها در `/approvals` — تا گردش‌کاری تعریف نشده، این صفحه خالی است و دلیلش را می‌گوید.

## آنچه این صنف در روز متفاوت دارد

- هنگام ثبت کالا این فیلدها جلو هستند: `name`، `sellPrice`.
