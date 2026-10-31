# گزارش نهایی تثبیت و وریفای (۳۱ اکتبر ۲۰۲۶)

## ۱. خلاصه اجرایی

**حکم: `PRODUCTION-READY-WITH-LIMITATIONS` (وضعیت `VERIFIED_WITH_LIMITATIONS`).**

کد و تست‌ها (بدون Postgres واقعی) پایدار شدند، ولی سه چیز را نمی‌شود «تأییدشده» نامید:

1. **Postgres واقعی روی این دستگاه نیست** (`REAL POSTGRES AVAILABLE: NO`). دو migration تازه (`device-slot-01`، `appointment-conflict-02`) و تست‌های همزمانی‌شان نوشته شده‌اند ولی اجرا نشده‌اند.
2. **اجرای واقعی ویندوز انجام نشد.** بیلد عادی دسکتاپ روی این دستگاه نمی‌سازد (Defender اجازهٔ پاک‌کردن فایل موقت esbuild را نمی‌دهد)، پس صفحهٔ لاگین و دکمهٔ آفلاین فقط با تست منبع و منطق CSS سنجیده شده‌اند.
3. **انتقال آفلاین → ابر برای خرید، حقوق، قسط، شمارش انبار و بودجه وجود ندارد** (جدول بخش ۵).

## ۲. یافته‌ها

| یافته                             | وضعیت                           | محل                                                               | رفع                                                                                                 | تست رفتاری                                                                                                                         | روی DB زنده                                       |
| --------------------------------- | ------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| BUG-NEW-006 هویت موتور محلی       | `VERIFIED_WITH_LIMITATIONS`     | `packages/local-engine/src/context.ts`                            | هیچ مسیری از «اولین ردیف `local_user`» مجوز نمی‌گیرد. کاربر باید نام‌برده شود و در جدول باشد.       | `identity.test.ts` (۱۴)، `route-guards.test.ts`                                                                                    | ندارد (SQLite)                                    |
| GAP-NEW-002 شناسهٔ پیش‌فرض ساختگی | `VERIFIED_WITH_LIMITATIONS`     | `context.ts`، `offline-session.ts`                                | `DEFAULT_USER_ID`، `DEFAULT_WORKSPACE_ID` و `OFFLINE_FALLBACK_OWNER_ID` حذف شدند. نبودِ هویت = ۴۰۱. | `identity.test.ts`                                                                                                                 | ندارد                                             |
| BUG-NEW-015 route های فقط‌عضویت   | `VERIFIED_WITH_LIMITATIONS`     | بخش ۳                                                             | ۶ capability تازه، ۱۸ route backend، `/api/sync/push` (۹ موجودیت)، ۴ route محلی                     | `stock-and-licence-route-guards.test.ts` (۳۴)، `sync-security.test.ts`                                                             | ندارد                                             |
| BUG-NEW-011 هم‌پوشانی قرار ملاقات | `IMPLEMENTED_NOT_LIVE_VERIFIED` | `docs/appointment-conflict-02-migration.sql`                      | قید exclusion در دیتابیس + نگاشت `23P01` به `APPOINTMENT_CONFLICT`                                  | `appointment-conflict-sql.test.ts`؛ `appointment-conflict-02.pg.test.ts` اجرا نشد                                                  | ایندکس `01` را **مالک تأیید کرد**؛ `02` اجرا نشده |
| 25C سقف اتمیک دستگاه              | `IMPLEMENTED_NOT_LIVE_VERIFIED` | `docs/device-slot-01-migration.sql`، `offline-license.service.ts` | هر دستگاه فعال یک «جای» شمارهٔ ۱ یا ۲ دارد و ایندکس یکتای جزئی یکی‌بودن را در دیتابیس تضمین می‌کند  | `offline-license-policy.test.ts` (۲ تست همزمانی با خواندن-قبل-از-نوشتن واقعی، ۰ دستگاه پنجم)؛ `device-slot-01.pg.test.ts` اجرا نشد | اجرا نشده                                         |
| سقف ۲۰ نفر آنلاین                 | `VERIFIED_WITH_LIMITATIONS`     | `plan-limit-defaults.ts`                                          | پیش‌فرض ۲۰؛ ادمین در لایهٔ پلن/کسب‌وکار عوض می‌کند                                                  | `online-user-default.test.ts`                                                                                                      | ندارد                                             |
| وب‌هوک Stripe (قفل بعد از شکست)   | `VERIFIED_WITH_LIMITATIONS`     | `webhook.service.ts`                                              | `releaseClaim`                                                                                      | `webhook-stripe-resolution.test.ts` (۱۷: تلاش دوباره، تکرار، همزمان، ری‌استارت، همان id با بدنهٔ دیگر، شکست دائمی)                 | ندارد                                             |
| تاریخ کسب‌وکار                    | `VERIFIED_WITH_LIMITATIONS`     | ۱۲ فایل (بخش ۴)                                                   | `businessDayOf(new Date(), timeZone)` به‌جای تاریخ UTC                                              | `business-day-sites.test.ts` (کابل، لس‌آنجلس، توکیو، DST، مرز نیمه‌شب)                                                             | ندارد                                             |
| دکمهٔ آفلاین ویندوز               | `NOT_VERIFIED` (اجرای واقعی)    | `login-page.tsx`                                                  | `h-full` به‌جای `min-h-screen`؛ دکمه بیرون از ناحیهٔ اسکرول                                         | `login-page-offline-button.test.ts`                                                                                                | —                                                 |
| ۳ تست «استایل ساخته‌شده»          | حل شد (تست خراب)                | `built-css-contains-utilities.test.ts`                            | بررسی `display:flex` به‌جای متن `display: flex`                                                     | ۸ از ۸                                                                                                                             | —                                                 |
| ۱۵ تست قرمز backend               | حل شد                           | بخش ۷                                                             | fakeها + یک باگ واقعی (وب‌هوک)                                                                      | هر ۴ فایل سبز                                                                                                                      | —                                                 |
| `payroll-idempotency-01`          | `LIVE_VERIFIED_BY_HUMAN`        | `docs/payroll-idempotency-01-migration.sql`                       | ستون و ایندکس هر دو `true` (VERIFY را مالک اجرا کرد)                                                | —                                                                                                                                  | بله                                               |
| `appointment-conflict-01`         | `LIVE_VERIFIED_BY_HUMAN`        | `docs/appointment-conflict-01-migration.sql`                      | ایندکس `true`                                                                                       | —                                                                                                                                  | بله                                               |

## ۳. مجوزها

**capability های تازه** (همه پیش‌فرض `manager` یعنی مالک و ادمین، قابل تنظیم در `governance?tab=permissions`): `purchase.write`، `purchase.receive`، `stocktake.write`، `stocktake.complete`، `license.manage`، `workflow.manage`.

| دسته                            | route                                                                      | capability                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `CAPABILITY_GUARDED`            | سفارش خرید (ساخت، ویرایش، دریافت)، پیش‌نویس سفارش مجدد                     | `purchase.write`، `purchase.receive`                                                                                        |
| `CAPABILITY_GUARDED`            | شمارش انبار (ساخت، ثبت، لغو، تکمیل)                                        | `stocktake.write`، `stocktake.complete`                                                                                     |
| `CAPABILITY_GUARDED`            | `POST /api/transactions`                                                   | `payment.record`                                                                                                            |
| `CAPABILITY_GUARDED`            | ارتقا/لغو اشتراک، فعال‌سازی صندلی، connect، گزارش tier1/tier2              | `license.manage`                                                                                                            |
| `CAPABILITY_GUARDED`            | ساخت/ویرایش/حذف تعریف گردش‌کار                                             | `workflow.manage`                                                                                                           |
| `CAPABILITY_GUARDED`            | `POST /api/sync/push` برای ۹ موجودیت                                       | همان capability که route دامنه می‌خواهد (فاکتور، مشتری، کالا، پرداخت، انبار، شعبه، نرخ ارز، موجودی کالا)                    |
| `CAPABILITY_GUARDED` (محلی)     | `fitments`، `vehicles`، `metal-rates`، ابطال سفارش صندوق                   | `product.write`، `payment.cancel`                                                                                           |
| `MEMBERSHIP_ONLY_INTENTIONALLY` | `activities` (خواندن/حذف فید شخصی)، `personalization`، `permissions/check` | داده یا نمای خودِ همان شخص                                                                                                  |
| `MEMBERSHIP_ONLY_INTENTIONALLY` | `ai/ask`، `ai/query`، `ai/translate`                                       | فقط سهمیهٔ AI مصرف می‌کنند؛ نوشتن‌های پایپ‌لاین AI با نشست و capability خودش رد می‌شود                                      |
| `MEMBERSHIP_ONLY_INTENTIONALLY` | CRM (تعامل، فرصت)، پروژه/وظیفه/زمان                                        | دلیل: سرویس‌هایشان هیچ ارجاعی به دفتر، فاکتور، حرکت انبار یا پرداخت ندارند (grep روی `project.service.ts` و `services/crm`) |
| `MEMBERSHIP_ONLY_INTENTIONALLY` | `POST /api/v1/workflows/instances` و `…/action`                            | ساخت درخواست تأیید برای همه؛ اقدام را خودِ سرویس با نقش تأییدکنندهٔ هر مرحله می‌سنجد                                        |
| `MEMBERSHIP_ONLY_INTENTIONALLY` | `sync/lease`                                                               | قفل نرم رکورد                                                                                                               |
| `REQUIRES_PRODUCT_DECISION`     | CRM و پروژه: آیا فروشنده حق ساخت فرصت و پروژه دارد؟                        | الان بله                                                                                                                    |

نکتهٔ مهم: `/api/sync/push` در لیست ۴۸ route قبلی نبود. مستقیم در جدول‌ها می‌نوشت و فقط عضویت می‌خواست: دستگاه فروشنده می‌توانست کالا با هر بها، نرخ ارز، شعبه و تراکنش بسازد.

## ۴. تاریخ کسب‌وکار

با `businessDayOf(new Date(), timeZone)` اصلاح شد: `accounting.routes`، `finance-ops.routes`، `operations.routes`، `analysis.service`، `assets.service`، `promotion.service`، `customer-profile.service`، `financing.service`، `costing.service`، `manufacturing.service`، `orders.service`، `report.service`.

**هنوز تاریخ UTC می‌گیرند** (بررسی‌شده، عمداً دست‌نخورده): `ai.service` (آمار مصرف ماهانه)، `scheduler/index.ts` (کار سیستمی)، `analytics.routes` (نمودار تحلیلی)، `traceability`، `campaign`، `attendance-link.domain`، `device-event.domain`، `automation` (حضور و خودکار ساعت‌دار از قبل منطقهٔ خودشان را دارند)، `offline-license.service`، `migration.domain`. تأثیر مالی ندارند یا از قبل زمان‌دار هستند، ولی `analytics.routes` و `traceability` نیاز به بررسی دوم دارند.

## ۵. آفلاین → ابر: پوشش دقیق

صادرات ۱۸ جدول را در بسته می‌گذارد، ولی `cloud-migration.service.ts` فقط ۸ بخش را بازپخش می‌کند: `inventory_settings`، `warehouse`، `product`، `product_stock`، `customer`، `invoice`، `payment`، `inventory_movement`.

| جدول محلی                                                                                                       | وضعیت                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| inventory_settings، warehouse، product، product_stock، customer، inventory_movement                             | `MIGRATES_TO_CLOUD`                                                                              |
| invoice (+ invoice_item)، payment (+ payment_allocation)                                                        | `MIGRATES_TO_CLOUD` (اقساط، مرجوعی، بیعانه و گارانتی فاکتور منتقل نمی‌شوند: `PARTIAL_MIGRATION`) |
| journal_entry، journal_line، cost_layer، cost_consumption                                                       | سمت ابر از روی فاکتور و کالا دوباره ساخته می‌شوند؛ سند دستی محلی: `DOES_NOT_MIGRATE`             |
| exchange_rate، account (حساب سفارشی)، shelf، branch                                                             | `DOES_NOT_MIGRATE`                                                                               |
| purchase_order (+ item)، supplier                                                                               | `DOES_NOT_MIGRATE`                                                                               |
| employee، employee_branch_assignment، attendance، leave، payroll، work_shift، shift_assignment                  | `DOES_NOT_MIGRATE`                                                                               |
| budget، budget_revision                                                                                         | `DOES_NOT_MIGRATE`                                                                               |
| invoice_installment، late_fee_policy، late_fee_assessment                                                       | `DOES_NOT_MIGRATE`                                                                               |
| invoice_returns (+ lines)، order_deposits، warranties                                                           | `DOES_NOT_MIGRATE`                                                                               |
| pos_session، pos_order، pos_order_payment، pos_cash_movement                                                    | `DOES_NOT_MIGRATE`                                                                               |
| price_list (+ item)، promotion، product_units، product_variants، metal_rates، auto_fitments، vehicle_attributes | `DOES_NOT_MIGRATE`                                                                               |
| local_workspace، local_user                                                                                     | ابر حساب خودش را دارد (`REQUIRES_PRODUCT_DECISION`: نگاشت مالک محلی به حساب ابری)                |

وسعت انتقال تغییر نکرد؛ هر بخش تازه یک کار مستقل با بازپخش و تطبیق خودش است.

## ۶. PostgreSQL

```text
REAL POSTGRES AVAILABLE: NO (initdb: could not change permissions؛ psql و docker هم نصب نیست)
MIGRATIONS EXECUTED: هیچ‌کدام توسط من. مالک payroll-idempotency-01 و appointment-conflict-01 را اجرا کرده است.
VERIFY SQL EXECUTED: فقط نتیجهٔ دو VERIFY مالک (سه مقدار true).
CONCURRENCY TESTS EXECUTED: روی fake با تداخل واقعی خواندن-قبل-از-نوشتن (سقف دستگاه)؛ تست‌های Postgres واقعی (device-slot-01.pg، appointment-conflict-02.pg) نوشته شد ولی اجرا نشد.
```

migration های تازه که منتظر اجرای مالک‌اند، به این ترتیب و با VERIFY مربوط:

1. `docs/device-slot-01-migration.sql` ← `docs/VERIFY-device-slot-01.sql`
2. `docs/appointment-conflict-02-migration.sql` ← `docs/VERIFY-appointment-conflict-02.sql` (اگر قرار هم‌پوشان از قبل باشد، چیزی را تغییر نمی‌دهد و در بلوک ۳ لیستشان می‌کند)

`PENDING HUMAN CONFIRMATION` برای هر دو.

## ۷. ۱۵ تست قرمز backend

| فایل                                          | علت                                                                                                                                                  | حکم                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `tenancy-idor` (۳)                            | fake تابع `invoice_write_document` و دو RPC دیگر را نداشت؛ گارد `ATOMIC_RPC_REQUIRED` در commit `9ab66b94` بعد از آخرین تغییر تست آمد (`git log -S`) | `STALE TEST`                       |
| `parity` (۵)                                  | `payments_record_keyed` و `inventory_release_consumption` در fake نبود                                                                               | `STALE TEST`                       |
| `invoice-return-invalidates-money-caches` (۱) | route حالا با `sendCreated` جواب می‌دهد                                                                                                              | `STALE TEST`                       |
| `webhook-stripe-resolution` (۶)               | fake متد `insert` نداشت؛ یک تست به روز اجرا وابسته بود؛ و **باگ واقعی**: قفل رویداد بعد از شکست آزاد نمی‌شد                                          | `STALE TEST` + `REAL BUG` (رفع شد) |

## ۸. جدول تست

نتایج اجرای نهایی در بخش «اعداد» پایین همین فایل ثبت می‌شود.

## ۹. موانع باقی‌مانده

1. Postgres واقعی (بخش ۶).
2. اجرای واقعی ویندوز: بیلد عادی روی این دستگاه نمی‌سازد (`esbuild … Access is denied` روی فایل موقت). راه‌حل مالک: استثنای Defender برای پوشهٔ Temp، یا بیلد روی دستگاه دیگر.
3. انتقال آفلاین → ابر برای ۱۰ گروه جدول (بخش ۵).
4. `analytics.routes` و `traceability` هنوز تاریخ UTC می‌گیرند.
5. نصاب رسمی NSIS: علت خطای `Uninstall hisabche.exe` ثابت نشده.

## ۱۰. تصمیم‌های محصول

- نگاشت مالک محلی به حساب ابری هنگام ارتقا.
- دسترسی فروشنده به CRM و پروژه (الان آزاد).
- هر بخش انتقال تازه (خرید، حقوق، قسط، شمارش، بودجه): اجرا یا نه، و به چه ترتیب.

## ۱۱. ایمنی Git

```text
Commit: NO
Push: NO
Reset: NO
Rebase: NO
Production SQL: NO
```
