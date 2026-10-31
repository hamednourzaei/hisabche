# ممیزی کشف باگ — گزارش اصلی (BUG-DISCOVERY-100)

> وضعیت کلی: **INCOMPLETE** — فقط‌خواندنی؛ هیچ فایل محصول، تست، migration یا پیکربندی تغییر نکرده است.
> هدف ۱۰۰ باگ بود؛ طبق قاعدهٔ «عدد واقعی، نه عدد پرشده»، فقط موارد دارای شاهد ثبت شده‌اند.

## ۰. هدر

- تاریخ ممیزی: ۱۰ آبان ۱۴۰۵ (2026-10-31)
- شاخه: `main`، HEAD = `527b60bd` (fixed ci 8)
- `git status --short` در شروع: **۰ خط** (درخت کاری تمیز)
- `git diff --stat` در شروع: خالی
- `git log -n 15 --oneline`: 527b60bd, 9ab66b94, 85d79856, 622584d9, b9f90056, f10377d3, 14819767, 3eefb461, 8141db6d, 0b694c23, 7e28bc55, aff2e0c9, f87873ed, 9e003f5d, c5544149
- Code Intelligence در شروع: **PARTIALLY_STALE** (indexed=`9ab66b94`، current=`527b60bd`؛ ۱٬۸۷۸ فایل، ۱۷٬۸۹۷ نماد). نمایه را تازه نکردم (فقط‌خواندنی)؛ همه‌ی ادعاها با خود کد منبع تأیید شده‌اند.
- محدودیت‌های محیط: Android/Windows بومی، PostgreSQL واقعی و چنددستگاهی در دسترس نبود ⇒ همه‌ی موارد `NOT_LIVE_VERIFIED`.

### هدر پیشرفت

| فاز                        | وضعیت                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ۰ — رجیستری یافته‌های قبلی | انجام شد برای ۹۰ سناریو (ردیف‌ها از tracker)؛ بازبینی تک‌به‌تک فقط برای ۸ مورد                                                                                |
| ۱ — نقشه‌ی محصول           | جزئی (local-engine، sync، accounting، payments، invoice، pos)                                                                                                 |
| ۲ — شکار                   | ۶ باگ جدید، ۴ بازگشودن، ۲ شکاف                                                                                                                                |
| ماژول‌های بررسی‌شده        | ۲۰ از ~۴۵ (دور سوم: CRM و قرار ملاقات، ساخت و تولید، ورود داده سرور و محلی، اشتراک و محدودیت پلن، دستگاه‌های لایسنس، اعلان‌ها، جریان realtime، مسیرهای ادمین) |

## ۱. خلاصه‌ی اجرایی

| شاخص                                     | مقدار                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| باگ جدید `CONFIRMED_BUG`                 | 0                                                                         |
| باگ جدید `SOURCE_CONFIRMED`              | 14 (دور اول ۶ + دور دوم ۴ + دور سوم ۴)                                    |
| `HIGH_RISK_GAP`                          | 4                                                                         |
| `POTENTIAL_RISK`                         | 1                                                                         |
| P0 / P1 / P2 / P3                        | 1 / 11 / 2 / 0                                                            |
| آفلاین / آنلاین / هر دو                  | 7 / 6 / 1                                                                 |
| یافته‌های قدیمی که باز مانده یا ناقص‌اند | 9 (۴ `STILL_PRESENT`/ناقص مستقیم + ۳ ناقص بر اثر BUG-NEW-001 + 03B + 25C) |
| رگرسیون                                  | 0 (ولی ادعای «FIXED_TESTED» برای 21B و 13A با کد فعلی نمی‌خواند)          |

سوئیت‌های رگرسیون گیت (۴ فایل) سبز بودند: `Test Files 2 passed`, `Tests 11 passed` برای backend و همین برای local-engine؛ tsc روی ۶ پکیج exit=0.

## ۲. ماتریس پوشش ماژول‌ها

| ماژول                                                 | آنلاین        | آفلاین                  | Cross-Sync    | UI       | Backend  | DB             | تست                                     | پوشش                                             |
| ----------------------------------------------------- | ------------- | ----------------------- | ------------- | -------- | -------- | -------------- | --------------------------------------- | ------------------------------------------------ |
| Sync engine / outbox                                  | —             | بررسی شد                | بررسی شد      | —        | —        | —              | تست سیم‌کشی فقط وجود enqueue را می‌سنجد | جزئی                                             |
| Local-engine authorization                            | —             | بررسی شد                | —             | —        | —        | —              | local-auth.test.ts                      | جزئی                                             |
| Invoices (cancel/reverse)                             | بررسی شد      | بررسی شد                | بررسی شد      | —        | بررسی شد | —              | —                                       | جزئی                                             |
| Payments                                              | بررسی شد      | بررسی شد                | جزئی          | —        | جزئی     | —              | —                                       | جزئی                                             |
| Till / POS                                            | جزئی          | بررسی شد                | بررسی شد      | —        | جزئی     | —              | —                                       | جزئی                                             |
| Accounting (year close، تاریخ سند)                    | بررسی شد      | بررسی شد                | بررسی شد      | —        | بررسی شد | —              | —                                       | جزئی                                             |
| Pricing / Promotions (آفلاین)                         | —             | بررسی شد                | بررسی شد      | —        | —        | —              | —                                       | جزئی                                             |
| Cost layers                                           | بررسی شد      | بررسی شد                | —             | —        | بررسی شد | —              | —                                       | جزئی                                             |
| Payroll / HR (سرور)                                   | بررسی شد      | بررسی نشد (بدون outbox) | —             | —        | بررسی شد | —              | —                                       | جزئی                                             |
| Backup (محلی)                                         | —             | بررسی شد                | —             | —        | —        | —              | —                                       | جزئی                                             |
| Offline licence                                       | بررسی شد      | بررسی شد                | —             | —        | بررسی شد | —              | —                                       | جزئی                                             |
| i18n (fa/af/en)                                       | بررسی شد      | —                       | —             | بررسی شد | —        | —              | —                                       | پاک (۹٬۱۴۹/۹٬۱۵۶/۹٬۱۵۸ کلید؛ بدون باگ اثبات‌شده) |
| Dashboard / گزارش (خواندن‌های سقف‌دار)                | بررسی شد      | —                       | —             | —        | بررسی شد | —              | —                                       | پاک (بدون باگ اثبات‌شده)                         |
| Attendance link (عمومی)                               | جزئی          | —                       | —             | —        | جزئی     | —              | —                                       | RISK-NEW-001                                     |
| CRM + قرار ملاقات                                     | بررسی شد      | —                       | —             | —        | بررسی شد | —              | —                                       | BUG-NEW-011                                      |
| Manufacturing                                         | بررسی شد      | بررسی نشد               | —             | —        | بررسی شد | —              | —                                       | پاک (ایدمپوتنت و `product.write`)                |
| Import (سرور/محلی)                                    | بررسی شد      | بررسی شد                | بررسی شد      | —        | بررسی شد | —              | —                                       | BUG-NEW-013، BUG-NEW-014                         |
| Subscriptions / plan limits / devices                 | بررسی شد      | —                       | —             | —        | بررسی شد | بررسی شد (SQL) | —                                       | BUG-NEW-012، 25C                                 |
| Notifications، Realtime stream، Admin routes          | بررسی شد      | —                       | —             | —        | بررسی شد | —              | —                                       | پاک (scoped به user/عضویت/platformAdminGuard)    |
| RTL/layout بصری، Android/Windows بومی، مقیاس و کارایی | **بررسی نشد** | **بررسی نشد**           | **بررسی نشد** | —        | —        | —              | —                                       | NOT_EXAMINED                                     |

## ۳. یافته‌های جدید

##### BUG-NEW-001 — ردیف‌های صف خروجی برای مرجوعی، گردش نقدی صندوق و بستن صندوق «NO_ENDPOINT» می‌دهند

- **Severity:** P0 — مرجوعی فروش آفلاین، ورود/خروج نقد صندوق و بستن شیفت هرگز به سرور نمی‌رسند؛ بعد از ۵ تلاش صف آن ردیف‌ها را رها می‌کند.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Offline Sync / Returns / Till
- **Module:** `packages/app-shell` sync-engine + `packages/local-engine` routes
- **Platform:** Offline
- **Affected Paths:** مرجوعی فاکتور آفلاین، `pos_cash_movement`، بستن `pos_session` در ویندوز و موبایل
- **Exact File:Line:** `packages/app-shell/src/features/sync/sync-engine.ts:557-564` (نقشه‌ی `ENDPOINT_BY_ENTITY`)، `:589-590` (`throw new Error('NO_ENDPOINT:…')`)، `packages/local-engine/src/routes/invoice-returns.ts:154`، `packages/local-engine/src/routes/till.ts:539`، `:805`، `packages/app-bridge/src/push-routing.ts:94-111`
- **Root Cause:** سه route entity های `invoice_returns`، `pos_cash_movement`، `pos_session` را در صف می‌گذارند. `routeFor` آنها را `domain` می‌کند (نه financial و نه descriptive)، اما `ENDPOINT_BY_ENTITY` فقط `invoice, customer, product, transaction, payment, inventory_movement` را می‌شناسد. نتیجه `NO_ENDPOINT:<entity>` است.
- **Preconditions:** دستگاه با `x-hisabche-queue: 1` (حالت آفلاین/صف) و ثبت یکی از این سه عملیات.
- **Steps to Reproduce:** آفلاین یک مرجوعی ثبت کن → `sync_queue` شامل entity=`invoice_returns` → `runSync` → `pushEntry` خطای `NO_ENDPOINT:invoice_returns` می‌دهد؛ خطا HTTP نیست پس `permanent=false`، `attempts` در `database.ts:381` +۱ می‌شود، پس از ۵ بار (`sync-engine.ts:736`) ردیف دیگر ارسال نمی‌شود.
- **Expected Result:** مرجوعی در سرور ثبت و موجودی/دفتر اصلاح شود.
- **Actual Result:** ردیف برای همیشه `failed` می‌ماند.
- **Business Impact:** موجودی و بدهی مشتری سرور هرگز اصلاح نمی‌شود؛ شیفت صندوق در سرور باز می‌ماند.
- **Financial / Data / Security Impact:** اختلاف مالی بین دستگاه و سرور؛ گردش نقد از دفتر سرور بیرون می‌ماند.
- **Evidence:** خطوط بالا؛ تست `offline-outbox-sync-wiring.test.ts` فقط وجود ردیف enqueue را می‌سنجد، نه تحویل آن.
- **Test Evidence:** no executable test; confidence lowered (NOT_LIVE_VERIFIED).
- **Related Previous Findings:** 13B، 02B، 10B (enqueue اضافه شد ولی مسیر تحویل ناقص ماند)
- **Why This Is Not a Duplicate:** آن موارد «enqueue نبود» بودند؛ اینجا enqueue هست و مقصد وجود ندارد.
- **Recommended Fix Direction:** برای هر سه entity نقطه‌ی پایانی دامنه‌ای در `ENDPOINT_BY_ENTITY`/ نگاشت سفارشی بساز، یا route سروری موجود (`/invoices/:id/returns`، pos routes) را با کلید idempotency پایدار صدا بزن؛ تست «تحویل» با سرور fake بنویس.

##### BUG-NEW-002 — اسناد دفتر با «روز UTC» تاریخ می‌خورند، نه روز کسب‌وکار

- **Severity:** P1 — سند بین ۰۰:۰۰ تا ۰۴:۳۰ بعد از نیمه‌شب کابل (۰۳:۳۰ تهران) به روز قبل می‌افتد؛ می‌تواند در دورهٔ قفل‌شده یا روز اشتباه بنشیند.
- **Confidence:** SOURCE_CONFIRMED (اثبات عددی: `2026-10-31T21:00:00Z` ⇒ UTC=`2026-10-31`، کابل=`2026-11-01`)
- **Domain:** Accounting / Dates
- **Module:** payments، pos، late-fee، installment، invoice، product، HR
- **Platform:** Both
- **Affected Paths:** تاریخ پیش‌فرض پرداخت، انتقال صندوق، بستن صندوق، جریمه دیرکرد، محاسبه سررسید قسط، ثبت مرجوعی/تعدیل
- **Exact File:Line:** `backend/src/services/payments/payments.service.ts:101,197`؛ `backend/src/services/pos/pos.service.ts:770,1029`؛ `backend/src/services/commerce/late-fee.service.ts:80,234`؛ `backend/src/services/commerce/installment.service.ts:53,97`؛ `backend/src/services/invoice.service.ts:2960,3113,3318,3377`؛ `backend/src/services/product.service.ts:533`؛ `backend/src/services/human-resources.service.ts:794`
- **Root Cause:** `new Date().toISOString().slice(0, 10)` ریشه‌ی مشترک؛ `backend/src/utils/local-day.ts` (BUG-087) فقط برای داشبورد اعمال شد.
- **Preconditions:** سرور UTC، کاربر در Asia/Kabul یا Asia/Tehran، ثبت بین نیمه‌شب محلی و ساعت ۰۴:۳۰/۰۳:۳۰.
- **Steps to Reproduce:** ساعت ۰۱:۰۰ بامداد کابل پرداختی بدون `entryDate` ثبت کن ⇒ `entryDate` برابر روز قبل می‌شود (محاسبه‌ی بالا).
- **Expected Result:** تاریخ به روز تقویمی کسب‌وکار.
- **Actual Result:** روز قبل.
- **Business Impact:** سند در روز/دوره‌ی غلط، گزارش روزانه و اعلام قفل ماه با شب مرزی ناهمخوان.
- **Financial / Data / Security Impact:** جابه‌جایی مبلغ بین روزها/ماه‌ها؛ در آخر ماه جابه‌جایی بین دوره‌ها.
- **Evidence:** خطوط بالا + `local-day.ts` سرصفحه.
- **Test Evidence:** `node -e` عددی بالا (خارج از مخزن)؛ بدون تست محصول.
- **Related Previous Findings:** BUG-087 (داشبورد)
- **Why This Is Not a Duplicate:** BUG-087 فقط برش «امروز» در داشبورد بود؛ این مسیرهای ثبت سند را شامل می‌شود.
- **Recommended Fix Direction:** یک تابع `businessDayOf(timeZone)` از `local-day.ts` در همه‌ی این نقاط؛ منطقه از تنظیم کسب‌وکار.

##### BUG-NEW-003 — لغو فاکتور در موتور محلی پرداخت‌ها را لغو می‌کند ولی سند دفتر آنها را باطل نمی‌کند و تخصیص را حذف سخت می‌کند

- **Severity:** P1 — نقد/مطالبات در دفتر ثبت می‌ماند در حالی که پرداخت لغو است؛ مانده‌ی مشتری و دفتر کل ناسازگار.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Payments / Ledger / Offline
- **Module:** `packages/local-engine/src/routes/invoices.ts`
- **Platform:** Offline
- **Affected Paths:** `POST /invoices/:id/cancel`، `DELETE /invoices/:id`
- **Exact File:Line:** `invoices.ts:1019-1026` (`UPDATE payment SET status='cancelled'` سپس `DELETE FROM payment_allocation WHERE id = ?` در `:1025`)؛ مقایسه با مسیر درست `payments.ts:536-541` که `journal_entry` پرداخت را `reversed` می‌کند و `payments.ts:470` که `payment.journal_entry_id` را می‌گذارد.
- **Root Cause:** مرحله‌ی «۴. Cancel payment allocations» فقط ستون وضعیت را عوض می‌کند، `journal_entry_id` پرداخت را نمی‌خواند.
- **Preconditions:** فاکتور آفلاین با حداقل یک پرداخت.
- **Steps to Reproduce:** فاکتور بساز، پرداخت ثبت کن، فاکتور را لغو کن ⇒ journal_entry پرداخت `posted` می‌ماند، `payment_allocation` فیزیکی حذف شده.
- **Expected Result:** سند پرداخت `reversed` شود، تخصیص soft-delete شود (همان قاعده‌ی 05B).
- **Actual Result:** سند پرداخت مانده، تخصیص از بین رفته؛ هیچ ردیف `payment` delete هم در صف نمی‌رود.
- **Business Impact:** دفتر محلی نقد را نشان می‌دهد که دیگر به پرداخت متصل نیست.
- **Financial / Data / Security Impact:** مغایرت دفتر ↔ پرداخت؛ از دست رفتن تاریخچه‌ی تخصیص.
- **Evidence:** خطوط بالا.
- **Test Evidence:** no executable test; confidence lowered (NOT_LIVE_VERIFIED).
- **Related Previous Findings:** 05B (hard DELETE در `payments.ts` اصلاح شد)، 16B
- **Why This Is Not a Duplicate:** مسیر دیگری از همان جدول با کد جداگانه است؛ اصلاح 05B فقط `payments.ts` را پوشاند.
- **Recommended Fix Direction:** پیش از لغو فاکتور، هر پرداخت را از همان تابع لغو پرداخت عبور بده (دفتر + soft-delete + enqueue).

##### BUG-NEW-004 — لغو فاکتور خرید در موتور محلی لایه‌های بهایی را صفر می‌کند که فروش‌های بعدی مصرفشان کرده‌اند

- **Severity:** P1 — بهای کالای فروخته‌شده و موجودی منفی بی‌هشدار.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Inventory / Cost
- **Module:** `packages/local-engine/src/routes/invoices.ts`
- **Platform:** Offline
- **Affected Paths:** لغو فاکتور خرید آفلاین
- **Exact File:Line:** `invoices.ts:982` (`UPDATE cost_layer SET remaining_qty = 0, deleted_at = ? … WHERE source_type='invoice' AND source_id=?`)، `:950-957` (کم‌کردن `product.quantity` بدون سنجش موجودی)؛ مقایسه با تصمیم سرور در `backend/src/services/invoice.service.ts:1822-1826` («لایه‌های خرید برگشت نمی‌خورد، چون فروش‌های بعدی ممکن است مصرفشان کرده باشند»).
- **Root Cause:** لایه‌ی خرید بدون بررسی `cost_consumption` حذف نرم می‌شود و تعداد کالا بدون بررسی کسر می‌شود.
- **Preconditions:** خرید ۱۰ عدد، فروش ۶ عدد، لغو خرید.
- **Steps to Reproduce:** مراحل بالا ⇒ `remaining_qty=0` و `deleted_at` پر، مصرف‌ها به لایه‌ی حذف‌شده اشاره می‌کنند، `product.quantity` به -۶ می‌رسد.
- **Expected Result:** رد با پیام، یا همان رفتار سرور.
- **Actual Result:** لایه حذف، موجودی منفی.
- **Business Impact:** COGS و ارزش موجودی بی‌اساس.
- **Financial / Data / Security Impact:** زیان ناخالص نادرست.
- **Evidence:** خطوط بالا.
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** سناریو 04 در ممیزی ۳۰تایی (مسیر سروری)
- **Why This Is Not a Duplicate:** پیاده‌سازی دیگر (SQLite محلی) با کد و ریشه‌ی جدا؛ ممکن است همان نیاز فیکس را داشته باشد.
- **Recommended Fix Direction:** همان قاعده‌ی سرور را در موتور محلی اجرا کن: اگر لایه مصرف‌شده است لغو را رد کن.

##### BUG-NEW-005 — شکست آزادسازی لایه‌های بها بلعیده می‌شود

- **Severity:** P1 — بعد از برگشت دفتر و پرداخت‌ها، خطای آزادسازی فقط `console.error` می‌شود و لغو «موفق» برمی‌گردد.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Inventory Cost / Atomicity
- **Module:** `backend/src/services/invoice.service.ts`
- **Platform:** Online
- **Affected Paths:** حذف/لغو فاکتور، ویرایش فاکتور فروش
- **Exact File:Line:** `invoice.service.ts:1826-1828` و `:2301-2303`
- **Root Cause:** `.catch((err) => console.error(…))` روی `costing.releaseDocument`.
- **Preconditions:** خطای DB در لحظه‌ی آزادسازی.
- **Steps to Reproduce:** جعل خطا در `releaseDocument` پس از `ledger.reverseDocument`.
- **Expected Result:** خطا به کلاینت برسد تا اجرای دوباره (که مستندات خود تابع آن را idempotent می‌داند) کار را تمام کند.
- **Actual Result:** پاسخ موفق؛ لایه‌ها مصرف‌شده می‌مانند.
- **Business Impact:** کالا موجود ولی بی‌بها/کم‌بها برای فروش بعدی.
- **Financial / Data / Security Impact:** سود فروش بعدی غلط.
- **Evidence:** خطوط بالا و کامنت `:1786-1790` («اجرای دوباره کار را تمام می‌کند»).
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** 06A (promise های unawaited؛ اینجا await هست ولی خطا بلعیده)
- **Why This Is Not a Duplicate:** مورد 06A «await نبود» بود؛ اینجا await هست و خطا عمداً بلعیده می‌شود.
- **Recommended Fix Direction:** throw کن یا وضعیت «نیاز به اتمام» ذخیره کن.

##### BUG-NEW-006 — نقش موتور محلی از «اولین ردیف local_user» می‌آید و کاربر/فضای کار از هدر

- **Severity:** P1 — سقف نقش ربطی به کاربر واقعی ندارد؛ هدر می‌تواند تا سقف همان ردیف بالا برود و `x-workspace-id` بدون سنجش به `local_workspace` پذیرفته می‌شود.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Security / Authorization
- **Module:** `packages/local-engine/src/context.ts`
- **Platform:** Offline
- **Affected Paths:** همه‌ی routeهای موتور محلی
- **Exact File:Line:** `context.ts:30,36` (`… LIMIT 1`)، `:22-24` (هدرها)، `:39-41` (ws/user از هدر یا پیش‌فرض)، `:56-62` (سقف نقش)
- **Root Cause:** `local_user LIMIT 1` به هیچ `userId` مرتبط نمی‌شود.
- **Preconditions:** دستگاه با بیش از یک کاربر محلی یا فضای کار.
- **Steps to Reproduce:** کاربر اول owner؛ درخواست با `x-user-role: owner` و `x-user-id` کاربر seller ⇒ نقش owner.
- **Expected Result:** نقش از ردیف همان `userId` در همان workspace.
- **Actual Result:** سقف همان ردیف اول.
- **Business Impact:** فروشنده با دست‌کاری IPC/هدر به اقدامات مالک می‌رسد.
- **Financial / Data / Security Impact:** افزایش امتیاز محلی.
- **Evidence:** خطوط بالا.
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** 30B
- **Why This Is Not a Duplicate:** 30B «بدون میدل‌ور» بود؛ این ریشه‌ی منبع هویت است.
- **Recommended Fix Direction:** نقش را با `WHERE id = :userId AND workspace_id = :ws` از DB بخوان؛ workspace هدر را با ردیف‌های `local_workspace` تطبیق بده.

### دور دوم

##### BUG-NEW-007 — مسیرهای ثبت/تسویهٔ حقوق، کارمند و مرخصی هیچ کنترل نقش یا مجوزی ندارند

- **Severity:** P1 — هر عضو workspace (فروشنده، بیننده) می‌تواند حقوق «پرداخت‌شده» بسازد که در دفتر ثبت می‌شود و حقوق کارمند را تغییر دهد.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Security / Payroll
- **Module:** `backend/src/routes/human-resources.routes.ts`، `services/human-resources.service.ts`
- **Platform:** Online
- **Affected Paths:** `POST /api/payrolls`، `PATCH /api/payrolls/:id`، ساخت/ویرایش کارمند، مرخصی (۱۱ route نوشتنی)
- **Exact File:Line:** `human-resources.routes.ts:377-401` و `:403-424` (`preHandler: [authenticate, requireWorkspaceContext]` فقط)؛ سرویس `human-resources.service.ts:316,476,608,674` بدون `holds`/`assertMay`/`requireRole`
- **Root Cause:** `requireWorkspaceContext` فقط عضویت را می‌سنجد؛ هیچ capability یا `requireRole` برای حقوق تعریف نشده (در همین پوشه `attendance.routes.ts` از `requireRole(…,'manager')` استفاده می‌کند ولی HR نه؛ شمارش: `requireCapability` = 0 در این فایل).
- **Preconditions:** کاربر با نقش پایین در یک workspace.
- **Steps to Reproduce:** با توکن seller: `POST /api/payrolls` با `status:'paid'`.
- **Expected Result:** 403.
- **Actual Result:** ۲۰۱ و سند دفتر.
- **Business Impact:** پرداخت حقوق جعلی، تغییر حقوق.
- **Financial / Data / Security Impact:** هزینهٔ جعلی در دفتر؛ افشا/تغییر حقوق.
- **Evidence:** خطوط بالا؛ جست‌وجوی `payroll\.` در capability ها بدون نتیجه.
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** 30A/30B (مجوز)، یادداشت CLAUDE دربارهٔ routeهای بدون `requireCapability`
- **Why This Is Not a Duplicate:** آن موارد فاکتور/مشتری/موتور محلی بودند؛ حقوق و HR ثبت نشده بود.
- **Recommended Fix Direction:** capability های `payroll.*`/`employee.*` تعریف و در route و سرویس اعمال شود؛ نقش نامعتبر ⇒ 403.

##### BUG-NEW-008 — حقوقِ «پرداخت‌شده» می‌تواند بدون سند دفتر بماند و راهی برای ثبت دوباره نیست

- **Severity:** P1 — هزینهٔ حقوق و خروج نقد از دفتر بیرون می‌ماند و گزارش سود بزرگ‌نمایی می‌شود.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Accounting / Payroll
- **Module:** `backend/src/services/human-resources.service.ts`
- **Platform:** Online
- **Affected Paths:** ثبت حقوق با `status:'paid'`، تغییر وضعیت به paid
- **Exact File:Line:** `:659-668` (خطای `bookPayroll` فقط `console.error`)، `:760-784` (حساب نبود/ناترازی ⇒ `console.warn` و `return`)، `:690-725` (PATCH روی paid ⇒ `PAYROLL_ALREADY_PAID`)، فقط دو فراخوان `bookPayroll` در `:661,:723`
- **Root Cause:** ثبت دفتر best-effort است، و چون حقوق paid نهایی است (`isPayrollFinal`) فراخوانی دوباره‌ای که `bookPayroll` را اجرا کند وجود ندارد.
- **Preconditions:** نبود حساب با نقش `salary_expense`/`cash`/`bank` یا خطای موقت دفتر.
- **Steps to Reproduce:** workspace بدون حساب هزینهٔ حقوق ⇒ حقوق paid ثبت می‌شود و `bookPayroll` برمی‌گردد.
- **Expected Result:** وضعیت «ثبت‌نشده در دفتر» قابل مشاهده و قابل تکرار.
- **Actual Result:** ردیف paid بدون سند؛ فقط لاگ سرور.
- **Business Impact:** سود ماهانه بیش از حد.
- **Financial / Data / Security Impact:** مغایرت حقوق پرداخت‌شده با دفتر.
- **Evidence:** خطوط بالا؛ `payroll_posting_readiness` فقط در `docs/phase-j-04-payroll-ledger-migration.sql` و کامنت است و هیچ فراخوانی در backend ندارد (grep).
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** سناریو 30 در ممیزی ۳۰تایی (Silent Payroll Ledger Omission)
- **Why This Is Not a Duplicate:** ریشهٔ آن «سرفصل نبود» بود؛ اینجا نبودِ مسیر ثبت مجدد پس از رفع حساب است. اگر آن مورد در عمل با همین رفتار «فعلی» بسته شده باشد، این مورد همان را باز می‌کند و باید در رجیستری با آن یکی شود.
- **Recommended Fix Direction:** endpoint ثبت مجدد idempotent برای حقوق paid بدون سند + شاخص «ثبت‌نشده» در UI.

##### BUG-NEW-009 — پشتیبان محلی ناقص است و فراداده‌اش کامل‌بودن را می‌گوید

- **Severity:** P1 — کسی که با این پشتیبان دستگاه را عوض کند، لایه‌های بها، موجودی هر انبار، مرجوعی‌ها، صندوق و تغییرات همگام‌نشده را از دست می‌دهد.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Backup / Data loss
- **Module:** `packages/local-engine/src/routes/backup.ts`
- **Platform:** Offline
- **Affected Paths:** `GET /workspaces/backup`
- **Exact File:Line:** `backup.ts:19-61` (۱۲ جدول)، `:78-87` (`restorable: false`, `truncatedTables: []`, `failedTables: []` ثابت)
- **Root Cause:** فهرست جدول‌ها دستی و ناقص است: `cost_layer`، `cost_consumption`، `product_stock`، `pos_session`، `pos_cash_movement`، `invoice_returns`، `invoice_return_lines`، `branch`، `shelf`، `inventory_settings`، `invoice_counter`، `sync_queue`، employee و … (همه در `contract.ts:98-126` وجود دارند) در خروجی نیستند.
- **Preconditions:** استفاده از پشتیبان برای جابه‌جایی/بازیابی.
- **Steps to Reproduce:** پشتیبان بگیر و کلیدهای JSON را با لیست جدول‌های `contract.ts` مقایسه کن.
- **Expected Result:** همه‌ی جدول‌های مالی/موجودی/صف، یا `truncatedTables` پر.
- **Actual Result:** `meta` ادعای خالی‌بودن خطا دارد.
- **Business Impact:** از دست رفتن فاکتورهای همگام‌نشده.
- **Financial / Data / Security Impact:** از دست رفتن داده؛ ارزش موجودی بازسازی‌ناپذیر.
- **Evidence:** خطوط بالا؛ هیچ route بازیابی در local-engine نیست (`grep restore`).
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** ندارد.
- **Why This Is Not a Duplicate:** بک‌آپ در ممیزی‌های قبلی ثبت نشده بود.
- **Recommended Fix Direction:** فهرست جدول را از `localTableSchema` بساز؛ `sync_queue` را وارد کن؛ `meta` را از نتیجهٔ واقعی پر کن.

##### BUG-NEW-010 — ثبت حقوق idempotent نیست؛ دوبار ارسال دو حقوق و دو سند می‌سازد

- **Severity:** P1 — پرداخت دوبارهٔ حقوق و هزینهٔ دوبل.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Payroll / Idempotency
- **Module:** `createPayrollSchema` + `createPayroll`
- **Platform:** Online
- **Affected Paths:** `POST /api/payrolls`
- **Exact File:Line:** `packages/validation/src/schemas/human-resources.schema.ts:220-226` (بدون `clientRequestId`)، `human-resources.service.ts:613-647` (insert ساده)، `:790-791` (`sourceId = payroll.id`)
- **Root Cause:** نه کلید تکرار و نه یکتایی (کارمند، دوره)؛ هر ردیف `id` جدید می‌گیرد و سند دفترش هم یکتا به همان id است.
- **Preconditions:** timeout/دوبار کلیک.
- **Steps to Reproduce:** دو `POST` یکسان ⇒ دو ردیف و دو سند.
- **Expected Result:** یک ردیف.
- **Actual Result:** دو ردیف.
- **Business Impact:** پرداخت دوبل.
- **Financial / Data / Security Impact:** هزینهٔ دوبل.
- **Evidence:** خطوط بالا؛ در SQL مخزن یکتایی روی `payrolls` پیدا نشد (جدول پایه در `docs/` نیست؛ دیتابیس زنده بررسی نشد ⇒ `NOT_LIVE_VERIFIED`).
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** 11A/11C (پرداخت‌ها)، 29B (کلید پایدار برای حقوق در صف سینک؛ ولی routeهای حقوق محلی اصلاً به صف نمی‌روند — GAP-NEW-001)
- **Why This Is Not a Duplicate:** مسیر حقوق از مسیر پرداخت‌ها جداست.
- **Recommended Fix Direction:** `clientRequestId` و ایندکس یکتا `(workspace_id, client_request_id)` (migration در docs + VERIFY)؛ سپس هشدار برای دورهٔ تکراری.

### دور سوم

##### BUG-NEW-011 — بررسی تداخل قرار ملاقات فقط ۱۰۰۰ ردیفِ قدیمی را می‌بیند

- **Severity:** P2 — بعد از ۱۰۰۰ قرار، قراردادن دو قرار روی یک کارمند در یک زمان ممکن می‌شود.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** CRM / Appointments
- **Module:** `backend/src/services/crm/appointment.service.ts`
- **Platform:** Online
- **Affected Paths:** `POST` قرار ملاقات (`routes/appointment.routes.ts:30-41`)
- **Exact File:Line:** `appointment.service.ts:17-26` (خواندن بدون صفحه‌بندی)، `:39-55` (تداخل روی همان آرایه)، `:63` (insert بعد از بررسی)
- **Root Cause:** خواندن بدون صفحه‌بندی؛ PostgREST پیش‌فرض ۱۰۰۰ ردیف برمی‌گرداند و ردیف‌ها از قدیمی‌ترین شروع می‌شوند، پس قرارهای جدید در بررسی نمی‌آیند (الگوی §۷٫۴). همچنین check-then-insert بدون قید دیتابیس.
- **Preconditions:** بیش از ۱۰۰۰ قرار در workspace، یا دو درخواست هم‌زمان.
- **Steps to Reproduce:** ۱۰۰۱ قرار بساز و قرار تازه را روی زمان قرار آخر برای همان کارمند بفرست.
- **Expected Result:** رد با تداخل.
- **Actual Result:** پذیرفته می‌شود.
- **Business Impact:** دو مشتری هم‌زمان برای یک کارمند.
- **Financial / Data / Security Impact:** داده‌ی زمان‌بندی نادرست.
- **Evidence:** خطوط بالا؛ در SQL مخزن قید یکتایی/exclusion برای appointments پیدا نشد.
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** ندارد.
- **Why This Is Not a Duplicate:** ماژول قرار ملاقات در هیچ ممیزی قبلی نبود.
- **Recommended Fix Direction:** بررسی تداخل را با فیلتر کارمند و بازهٔ زمانی در SQL انجام بده و یک قید exclusion اضافه کن (migration در docs + VERIFY)؛ `Error('APPOINTMENT_CONFLICT')` ساده را به خطای 409 تبدیل کن (route هیچ catch ندارد).

##### BUG-NEW-012 — فعال‌سازی دستگاه لایسنس سقف صندلی ندارد، با upsert روی کلید اصلی ردیف workspace دیگر را برمی‌دارد و برای هر عضوی باز است

- **Severity:** P1 — صندلی پولی بی‌حد مصرف می‌شود و یک دستگاه مشترک بین دو کسب‌وکار صندلی دیگری را بی‌صدا می‌دزدد.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Licensing / Tenant isolation
- **Module:** `backend/src/services/offline-license.service.ts`، `routes/billing.routes.ts`
- **Platform:** Online
- **Affected Paths:** `POST /api/billing/devices/activate`، `/devices/:deviceId/release`
- **Exact File:Line:** `billing.routes.ts:771-784` (`authenticate, requireWorkspaceContext` فقط)، `offline-license.service.ts:946-972` (`upsert` بدون `onConflict`)، `docs/entitlement-01-migration.sql:104` (`device_id uuid PRIMARY KEY`)
- **Root Cause:** upsert روی کلید اصلی `device_id` ستون `workspace_id` را بازنویسی می‌کند؛ هیچ شمارش صندلی در `activateDevice` یا route نیست؛ هیچ capability.
- **Preconditions:** دو workspace که یک `device_id` را فعال کنند، یا هر عضو که چند شناسه بفرستد.
- **Steps to Reproduce:** workspace A دستگاه X را فعال کند؛ workspace B همان X را فعال کند ⇒ ردیف X به B می‌رود، A صندلی را ندارد.
- **Expected Result:** رد با تداخل، یا رعایت سقف طرح.
- **Actual Result:** انتقال بی‌صدا.
- **Business Impact:** قفل شدن دستگاه مشتری الف؛ دور زدن محدودیت دستگاه.
- **Financial / Data / Security Impact:** تغییر مالکیت ردیف بین مستأجرها.
- **Evidence:** خطوط بالا؛ grep سقف دستگاه (`maxDevices|device_limit|seatLimit`) در backend نتیجه‌ای نداد.
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** سیاست صندلی/انتقال در CLAUDE (سقف ۳ انتقال در سال)
- **Why This Is Not a Duplicate:** ماژول دستگاه‌ها ثبت نشده بود.
- **Recommended Fix Direction:** insert با `onConflict` ایمن (یا رد اگر `workspace_id` فرق کند)، شمارش صندلی اتمیک در تابع SQL، و `requireCapability('workspace.manage')`.

##### BUG-NEW-013 — ورود داده در موتور محلی ردیف‌ها را «local_only» می‌نویسد و هرگز به صف نمی‌گذارد

- **Severity:** P1 — مشتری و کالای وارد‌شده هرگز به سرور نمی‌رسند؛ فاکتور وابسته به آنها `INVOICE_REFERENCE_MISSING` می‌خورد و پس از ۵ تلاش می‌ماند.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Import / Offline Sync
- **Module:** `packages/local-engine/src/routes/import.ts`
- **Platform:** Offline
- **Affected Paths:** `POST /migrations/commit` (customers، products)
- **Exact File:Line:** `import.ts:147,168` (`local_only`)، نبود `buildEnqueue` در فایل (grep)
- **Root Cause:** هیچ مسیری که `sync_state='local_only'` را به صف تبدیل کند وجود ندارد؛ همگام‌سازی فقط از `sync_queue` می‌خواند (`sync-engine.ts:700-740`).
- **Preconditions:** دستگاه همگام‌سازی‌شونده (هیبرید).
- **Steps to Reproduce:** مشتری را وارد کن؛ بعد فاکتور آفلاین برایش بزن؛ فاکتور در صف می‌رود ولی والد در صف نیست.
- **Expected Result:** والد پیش از فرزند ارسال شود.
- **Actual Result:** فاکتور رد/معطل.
- **Business Impact:** مشتریان واردشده در سرور و دستگاه‌های دیگر نیستند.
- **Financial / Data / Security Impact:** مغایرت دستگاه ↔ سرور.
- **Evidence:** خطوط بالا + `push-order.ts` که فقط ردیف‌های صف را مرتب می‌کند.
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** 14A/14B (ترتیب والد-فرزند)، GAP-NEW-001
- **Why This Is Not a Duplicate:** آن موارد ترتیب ردیف‌های صف بودند؛ اینجا ردیف اصلاً به صف نمی‌رسد و راه ورود داده است.
- **Recommended Fix Direction:** هر ردیف واردشده را با `buildEnqueue` و کلید پایدار صف کن، یا ورود را در حالت هیبرید از مسیر API بفرست.

##### BUG-NEW-014 — ورود محلی گزارش «۰ ناموفق» ثابت می‌دهد، تکراری را نمی‌شناسد و موجودی را بی‌صدا دور می‌ریزد

- **Severity:** P2 — ورود دوباره‌ی همان فایل تکراری می‌سازد و موجودی اول از دست می‌رود، بدون هشدار.
- **Confidence:** SOURCE_CONFIRMED
- **Domain:** Import
- **Module:** `packages/local-engine/src/routes/import.ts`
- **Platform:** Offline
- **Affected Paths:** `POST /migrations/commit`
- **Exact File:Line:** `import.ts:179` (`failed: 0` ثابت)، `:164-170` (`quantity` همیشه ۰)، `:140-153` (`id = r.id || uuid` بدون بررسی تکرار)
- **Root Cause:** مقدار `quantity` ردیف خوانده نمی‌شود و ردیف‌های بدون نام بی‌صدا رد می‌شوند (`continue`) بدون شمارش؛ شناسه تکراری کل تراکنش را می‌اندازد.
- **Preconditions:** فایل با ستون موجودی یا اجرای دوباره.
- **Steps to Reproduce:** دو بار همان فایل را commit کن.
- **Expected Result:** تشخیص تکراری و گزارش دقیق.
- **Actual Result:** تکراری یا خطای کل تراکنش؛ `failed:0`.
- **Business Impact:** کاتالوگ آلوده.
- **Financial / Data / Security Impact:** موجودی/بهای اولیه ثبت نمی‌شود.
- **Evidence:** خطوط بالا؛ نسخهٔ سرور (`migration.routes.ts`) مسیر دیگری با `ProductService.recordOpeningStock` دارد.
- **Test Evidence:** no executable test; confidence lowered.
- **Related Previous Findings:** ندارد.
- **Why This Is Not a Duplicate:** ریشه‌ای جدا از BUG-NEW-013 (گزارش‌دهی و اعتبارسنجی، نه صف).
- **Recommended Fix Direction:** از همان domain سرور (`prepareRows`) استفاده یا ردیف‌های رد شده را بشمار و گزارش بده.

## ۴. موارد باز یا ناقص از یافته‌های قبلی (Old Findings Reopened)

| شناسه           | وضعیت           | شاهد                                                                                                                                                                                            |
| --------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21B             | STILL_PRESENT   | `routes/pricing.ts` هیچ `buildEnqueue` ندارد (`INSERT INTO price_list` در `:174`، `price_list_item` `:247`، `promotion` `:310`)؛ `price_list` در `localTableSchema` و `ENDPOINT_BY_ENTITY` نیست |
| 13A             | STILL_PRESENT   | `routes/accounting.ts` سند دستی/حساب/قفل دوره را بدون صف می‌نویسد (`:142,300,382,422`)                                                                                                          |
| 17B             | STILL_PRESENT   | `sync-engine.ts:736` رد می‌کند اگر `attempts >= 5`؛ بازنشانی خودکار با اتصال دوباره وجود ندارد (فقط upsert `buildEnqueue` و retry دستی)                                                         |
| 30B             | PARTIALLY_FIXED | از ۱۳ capability تعریف‌شده در `auth.ts:36-58`، ۱۲ تا هیچ فراخوان ندارند؛ `till.ts` (۱۱ route)، `accounting.ts` (قفل دوره `:556-560`)، `transfers.ts`، `payroll.ts` بی‌محافظ‌اند                 |
| 13B / 02B / 10B | PARTIALLY_FIXED | اینها در BUG-NEW-001 توضیح داده شد                                                                                                                                                              |
| 03B             | PARTIALLY_FIXED | `packages/app-shell/src/features/auth/offline-license.ts:107-127`: نقطهٔ بالاترین زمان فقط از کلید `SEEN_KEY` می‌آید؛ مقایسه با زمان تراکنش‌های محلی (ادعای tracker) در کد نیست                 |
| 25C             | STILL_PRESENT   | plan-limits.service.ts:247-306: سقف فاکتور/کاربر با شمارش و سپس ثبت بررسی می‌شود، نه با افزایش اتمیک که tracker ادعا کرده؛ دو درخواست هم‌زمان در آخرین جا هر دو می‌گذرند                        |

## ۵. شکاف‌های پرخطر (Gap)

- **GAP-NEW-001** — purchasing، payroll، installments، attendance، warehouses، branches، exchange-rates، budgets در موتور محلی بدون outbox می‌نویسند و در `localTableSchema` نیستند (`grep` تعداد `buildEnqueue` = ۰ در ۲۳ فایل route). تا تصمیم محصول («فقط محلی» یا «همگام») معلوم نیست باگ است یا طراحی.
- **GAP-NEW-002** — `context.ts:11-12,39-40`: بدون ردیف `local_workspace`/`local_user` از شناسه‌های ثابت `1111…`/`2222…` استفاده می‌شود؛ نوشته‌ها به یک کسب‌وکار/کاربر مجازی نسبت داده می‌شوند.

- **GAP-NEW-003** — `offline-license.ts:42-48`: `read()` خطای secure store را `null` می‌کند؛ `seen` خالی یعنی محافظ بازگشت ساعت بی‌صدا خاموش می‌شود (fail-open). همچنین پاک‌شدن `SEEN_KEY` همان اثر را دارد.
- **GAP-NEW-004** — بک‌آپ محلی راه بازیابی ندارد (`meta.restorable=false`، و در local-engine route بازیابی نیست)؛ تا بازیابی تست‌نشده، «بک‌آپ» فقط خروجی است.
- **RISK-NEW-001** (`POTENTIAL_RISK`) — `attendance_links.token` متن ساده در ستون ذخیره و در `SELECT` سرویس خوانده می‌شود (`attendance-link.service.ts:87`)، در حالی که کلید دستگاه‌ها فقط hash است؛ نشت خواندنی DB همه‌ی لینک‌های فعال را فاش می‌کند. rate limit روی route عمومی هست (`attendance-link.routes.ts:248-275`).

## ۶. بررسی‌نشده

Android/Windows بومی، مقیاس و کارایی، بازبینی بصری RTL/layout، و بازبینی تک‌به‌تک ~۱۱۲ مورد قبلی (فقط ۱۰ بازبینی شد). بدون یافتهٔ دور سوم: ساخت و تولید (ایدمپوتنت و `product.write` درست است)، اعلان‌ها (همه با `user_id`)، جریان `/api/sync/stream` (احراز با subprotocol، بازبینی عضویت هر ۵ دقیقه)، مسیرهای ادمین (`platformAdminGuard`)، مسیرهای ورود داده سرور (`data.import`).

## ۷. خلاصه‌ی شواهد تست

جزئیات در `BUG-DISCOVERY-100-TEST-EVIDENCE.md`.

## ۸. ۲۰ ریسک برتر (فقط موارد شاهددار؛ ۱۸ مورد)

1. BUG-NEW-001 · 2. 30B ناقص · 3. BUG-NEW-007 · 4. BUG-NEW-006 · 5. BUG-NEW-012 · 6. BUG-NEW-009 · 7. BUG-NEW-013 · 8. 21B · 9. 13A · 10. BUG-NEW-010 · 11. BUG-NEW-008 · 12. BUG-NEW-003 · 13. BUG-NEW-004 · 14. 25C · 15. 17B · 16. BUG-NEW-005 · 17. BUG-NEW-002 · 18. GAP-NEW-001

## ۹. ترتیب پیشنهادی رفع

BUG-NEW-001 → 30B/NEW-006/NEW-007 → NEW-012 → NEW-009/NEW-013 → 21B/13A → NEW-010/NEW-008 → NEW-003/004 → 25C → 17B → NEW-005 → NEW-002 → NEW-011/NEW-014 → 03B/GAP-NEW-003.
