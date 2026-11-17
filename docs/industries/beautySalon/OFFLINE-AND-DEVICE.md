# ناخن و سالن زیبایی — آفلاین و دستگاه

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این سند برای این صنف‌ها هم خوانده می‌شود: [barber](../barber/README.md).

## بدون اینترنت انجام می‌شود

- ثبت نوبت — `POST /service-delivery/sessions`
- حاضر شد / شروع / نیامد — `POST /service-delivery/sessions/:x/status`
- تحویل خدمت — `POST /service-delivery/sessions/:x/deliver`
- لغو نوبت — `POST /service-delivery/sessions/:x/cancel`
- رزرو صندلی/اتاق — `POST /resource-bookings`
- دریافت پول — `POST /payments`

## اینترنت می‌خواهد

- تعیین نرخ کمیسیون — `PUT /provider-commissions/rates`

## هر اقدام اصلی: آفلاین یا نه، و کجا اجرا می‌شود

| اقدام | endpoint | آفلاین (ماتریس) | مکان اجرا (`executionSiteFor`) |
| --- | --- | --- | --- |
| ثبت نوبت | `POST /service-delivery/sessions` | آفلاین: در دسترس | — (قرارداد مکان اجرا این عمل را نام نمی‌برد) |
| حاضر شد / شروع / نیامد | `POST /service-delivery/sessions/:x/status` | آفلاین: در دسترس | — (قرارداد مکان اجرا این عمل را نام نمی‌برد) |
| تحویل خدمت | `POST /service-delivery/sessions/:x/deliver` | آفلاین: در دسترس | — (قرارداد مکان اجرا این عمل را نام نمی‌برد) |
| لغو نوبت | `POST /service-delivery/sessions/:x/cancel` | آفلاین: در دسترس | — (قرارداد مکان اجرا این عمل را نام نمی‌برد) |
| رزرو صندلی/اتاق | `POST /resource-bookings` | آفلاین: در دسترس | — (قرارداد مکان اجرا این عمل را نام نمی‌برد) |
| دریافت پول | `POST /payments` | آفلاین: در دسترس | `payment.record` → `device` اگر میزبان آماده باشد، وگرنه `server` |
| تعیین نرخ کمیسیون | `PUT /provider-commissions/rates` | فقط آنلاین | — (قرارداد مکان اجرا این عمل را نام نمی‌برد) |

ستون‌های بالا از `OFFLINE_ENDPOINT_MATRIX` و `packages/api/src/lib/execution-site.ts` خوانده شده‌اند، نه نوشته؛ «در دست استفاده» را هم اسکن `executionSiteFor('<op>')` در `packages/api/src/hooks` می‌گوید.

## مکان اجرا: یک قرارداد، نه یک انتخاب

- `executionSiteFor` فقط سه عمل را می‌شناسد: `invoice.create`، `payment.record`، `invoice.return`. عمل چهارم یعنی مسیر سوم، و مسیر سوم ساخته نمی‌شود.
- `device` تنها وقتی پاسخ است که میزبان (ویندوز/اندروید) یک بررسی آمادگی ثبت کرده باشد، کسب‌وکار فعال باشد و میزبان برای همین عمل در همین کسب‌وکار آماده باشد؛ وگرنه پاسخ `server` است. وب هرگز ثبت نمی‌کند، پس روی وب همیشه `server` است.
- تصمیم از روی داده گرفته می‌شود، نه از روی سخت‌افزار؛ گوشی ضعیف با همان ردیف‌ها همان اعداد را می‌سازد.

## رزرو: تعارض صریح، نه آخرین‌نویسنده

`POST /resource-bookings` در ماتریس «آفلاین: در دسترس» است: دو دستگاه آفلاین می‌توانند هم‌زمان یک منبع و یک بازه را بگیرند.

- هنگام ارسال، سرور برای هم‌پوشانی `409` می‌دهد و `pushEntry` در `packages/app-shell/src/features/sync/sync-engine.ts` آن را به `handleBookingSyncConflict` می‌دهد.
- نتیجه `conflictState: PENDING_REVIEW` و `reason: RESOURCE_SLOT_OVERLAP` است، و خطا `permanent = true` می‌گیرد؛ پس صف تا بی‌نهایت دوباره تلاش نمی‌کند.
- هیچ‌کدام از دو رزرو دور ریخته یا بازنویسی نمی‌شود؛ یک آدم در مرکز سینک تصمیم می‌گیرد. این همان چیزی است که تست `resource-capacity-race.test.ts` می‌سنجد.

## روی دستگاه (ویندوز و اندروید)

- فروش روی دستگاهِ آماده اول در SQLite خود دستگاه ثبت می‌شود، حتی آنلاین؛ ارسال به سرور در پس‌زمینه است و سرور همان فاکتور را دوباره اعتبارسنجی و شماره‌گذاری می‌کند.
- آنچه دستگاه نپذیرد، وقتی آنلاین است از سرور پرسیده می‌شود: سریال، سری تاریخ‌دار، اعتبار بسته و لایه‌ی بها روی دستگاه کامل نیست.
- عمل‌هایی که hook امروز از قرارداد مکان اجرا می‌پرسد: `invoice.create`، `payment.record`؛ بقیه‌ی عمل‌های قرارداد مسیر سرور می‌روند.
- دو دستگاه آفلاین که یک زمان/منبع را بگیرند تعارض صریح می‌سازند، نه آخرین‌نویسنده.
