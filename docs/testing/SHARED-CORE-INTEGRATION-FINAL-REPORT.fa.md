# گزارش نهایی — ممیزی اتصال هسته‌های مشترک و حذف شکاف‌های تست

> مأموریت: HISABCHE — SHARED CORE INTEGRATION & TEST GAP ELIMINATION
> ماتریس پوشش: `docs/testing/SHARED-CORE-INTEGRATION-COVERAGE.md`
> این گزارش صرفاً بر اساس شواهد اجراشده نوشته شده؛ هیچ نتیجه‌ای حدس زده نشده است.

---

## A. نتیجه کلی

| شاخص                    | مقدار                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| HEAD شروع               | `d8dfdea3a107055a4a9176f2f7e7c091513c35fc` (main)                                                                   |
| HEAD پایان              | `d8dfdea3a107055a4a9176f2f7e7c091513c35fc` — بدون commit (طبق قانون مأموریت)                                        |
| حفظ working tree        | کامل — تمام تغییرات قبلی کاربر (پروژه reel-113 و فایل‌های پلاگین) دست‌نخورده باقی ماند                              |
| دامنه‌های بررسی‌شده     | ۶ دامنه (A: محصول/انبار، B: فروش/پرداخت، C: حسابداری، D: خدمات/اعتبار پکیج، E: CRM/نیروی کار، F: آفلاین/همگام‌سازی) |
| مرزهای اتصال بررسی‌شده  | ۲۵ مرز (SC-01 تا SC-25 در ماتریس)                                                                                   |
| شکاف تست کشف‌شده        | ۶ شکاف پوشش (SC-01, SC-02, SC-03, SC-04, SC-05, SC-07)                                                              |
| تست ضعیف تقویت‌شده      | ۱ (SC-06 — گارد STATIC_ONLY لغو پرداخت)                                                                             |
| باگ Production تأییدشده | **۰** — شکاف‌ها «نبود پوشش» بودند، نه نقص محصول؛ هیچ تست جدیدی رفتار غلط محصول را نشان نداد                         |
| نقص اصلاح‌شده           | ۱ نقص زیرساخت تست: حذف `await pg.initialise()` در دو فایل PG (جزئیات در بخش B)                                      |
| تست اضافه‌شده           | **۴۲** (۲۴ مسیر push + ۴ pull پرشده + ۹ برابری پرداخت + ۵ roundtrip_PG)                                             |
| تست اجراشده (غیرتکراری) | **۱۱۴۵** = ۱۱۶ (jest sync) + ۳۳۹ (backend unit) + ۶۶۶ (local-engine کامل) + ۲۴ (PG)                                 |
| Passed                  | **۱۱۲۱**                                                                                                            |
| Failed                  | ۱۰ — همه گارد محیطی «postgres بالا نیامد» در PG؛ به‌عنوان BLOCKED طبقه‌بندی شد، نه شکست محصول                       |
| Skipped                 | ۱۴ — سناریوهای `service-delivery-02` که در نبود PG زودهنگام برمی‌گردند                                              |
| Blocked                 | ۳ سوئیت PG (۲۴ تست) — بلاکر محیطی ویندوز، مستند در بخش D                                                            |

نکته صداقتی: اجراها «مجموعه‌های منتخب + یک سوئیت کامل» بودند، نه کل تست‌های مخزن.
ادعای «کل مخزن سبز است» نمی‌شود؛ ادعای دقیق این است: هر دو طرف هر اتصال تغییرکرده
به‌همراه سوئیت کامل local-engine اجرا و سبز شد.

---

## B. یافته‌های اتصال (به‌ازای هر یافته)

### SC-01 · جلسات خدمات ↔ ترنسپورت push (یافته F-001)

- دامنه‌ها: Service Delivery ↔ app-shell Sync Engine.
- منبع: `packages/app-shell/src/features/sync/sync-engine.ts:1136-1161` (مسیریابی deliver/cancel/status/create).
- شواهد قبلی: `service-delivery-integrity.test.ts:224-259` فقط شکل outbox؛ `sync-scenarios.test.ts:545-583` فقط رد سرور.
- رفتار تست‌نشده: مسیر موفق هر انتقال وضعیت از `runSync` — انتخاب endpoint، شناسه جلسه در URL، payload دست‌نخورده، Idempotency-Key = clientId، تخلیه صف دقیقاً یک‌بار، retry پس از ack گم‌شده بدون مصرف تکراری، ترتیب create-before-deliver.
- ریسک: High (مسیر اشتباه = جلسه دوم یا مصرفی که هرگز ثبت نمی‌شود).
- اصلاح: تست اضافه شد (بدون تغییر کد محصول).
- تست جدید: `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts:730-828`.
- نتیجه اجرا: سبز (۴۸/۴۸ در اجرای فایل؛ بخشی از ۱۱۶ تست سبز پوشه sync).

### SC-02 · دفتر اعتبار پکیج ↔ ترنسپورت push

- منبع: `sync-engine.ts:1112-1134` (GRANT رد دائم؛ REVERSAL/EXPIRE/ADJUSTMENT/CONSUME).
- شکاف: چهار مسیر موفق از `runSync` تست نشده بود (فقط رد GRANT پوشش داشت).
- ریسک: High.
- تست جدید: `sync-scenarios.test.ts:832-835` (جدول پارامتری چهار مسیر).
- نتیجه اجرا: سبز.

### SC-03 · موجودیت‌های عملیاتی ↔ pull دستگاه (یافته F-002)

- منبع: `sync-pull.test.ts:123-149` صفحات خالی برای sessions/credits/variants/tickets؛ `sync-operational-pull.test.ts:483-530` اثبات متنی mapper.
- شکاف: ردیف‌های واقعی پرشده map و در SQLite دستگاه ذخیره نمی‌شدند در تست؛ فیلدهای settlement (`package_credit_id`, `settlement_method`, customer)، `quantity`/`entry_type` دفتر، replay بدون تکرار، نسخه جدیدتر روی ردیف درست، پیشروی cursor، scoping درخواست delta به پک نصب‌شده.
- ریسک: High (جلسه تحویل‌شده‌ای که به دستگاه نرسد = اسلات دوباره فروخته‌شده).
- تست جدید: `sync-pull.test.ts` — سوئیت SC-03 با fixture پرشده و `FROM_LOG` واقعی.
- نتیجه اجرا: سبز (۱۷/۱۷). یک خطای fixture در حین توسعه پیدا و اصلاح شد (`hasMore: false` صفحه اول pagination را زود متوقف می‌کرد) — خطای تست، نه باگ محصول.

### SC-04 · تراکنش تحویل ↔ change log ↔ تابع واقعی pull (یافته F-003)

- منبع: `operational-pull-02.pg.test.ts` فقط insert/update/delete خام + متن SQL؛ `service-delivery-02.pg.test.ts` تحویل واقعی ولی بدون migrationهای sync.
- شکاف: هیچ تستی `service_delivery_deliver` واقعی را روی migrationهای واقعی sync اجرا نمی‌کرد تا: به‌روزرسانی جلسه + CONSUME در یک تراکنش → ردیف‌های `sync_change_log` با نام‌های PROTOCOL و نسخه افزایش‌یافته → `sync_pull_changes_v2` واقعی هر دو رکورد را برگرداند → ایزولاسیون tenant در سطح تابع pull → reversal لغو هم سفر کند → replay ردیف log اضافه نکند.
- ریسک: High.
- تست جدید: `backend/src/__tests__/service-delivery-sync-roundtrip.pg.test.ts` (۵ سناریو؛ migrationها به ترتیب واقعی: package-credit-ledger-01، service-delivery-01/02/03، sync-engine، sync-commit-horizon، sync-scope-01، operational-pull-02 دوبار برای idempotency).
- نقص زیرساخت اصلاح‌شده: هر دو فایل مرجع (`operational-pull-02.pg.test.ts` و `service-delivery-02.pg.test.ts`) فراخوانی `await pg.initialise()` را نداشتند؛ نسخه pinned `embedded-postgres@17.10.0-beta.17` در `start()` به‌صورت خودکار initialise نمی‌کند. بدون این خط، حتی در CI هم در `postgresql.conf` شکست می‌خوردند. اصلاح: +۱ خط در هر فایل، هم‌راستا با ~۸۰ سوئیت PG دیگر. این تنها تغییر در فایل‌های موجودِ سمت سرور است.
- نتیجه اجرا: **BLOCKED به‌صورت محلی** (بلاکر محیطی ویندوز — بخش D). در CI اجرا می‌شود. هرگز PASS شمرده نشد.

### SC-05 · برابری مالی دستگاه ↔ سرور برای پرداخت (یافته F-004)

- منبع: `payment-posting-parity.test.ts` و `payment-allocation-parity.test.ts` (فقط دستگاه)، `till-on-payments.test.ts` (فقط سرور)، golden corpus (۱۹ بردار، ۲ پرداخت — فقط حساب shared core).
- شکاف: هیچ تستی هر دو پیاده‌سازی واقعی را با یک ورودی مشترک اجرا و خروجی مالی نرمال‌شده را مقایسه نمی‌کرد — دقیقاً مثال «۴ تست سبز در چهار لایه» مأموریت.
- ریسک: High.
- تست جدید: `backend/src/__tests__/payment-device-server-parity.test.ts` — موتور واقعی دستگاه روی `node:sqlite` واقعی + `PaymentsService` واقعی با portهای ضبط‌کننده؛ ۹ سناریو: رسید ارزی با نرخ منجمد و gap، بانک در برابر نقد، پرداخت جزئی و مانده، سمت خرید، replay = یک ثبت در هر دو طرف، لغو = reversal در هر دو طرف، fail-closed در دوره قفل. AFN صفر-اعشاری حفظ شد؛ هیچ `/100` ضمنی معرفی نشد.
- نتیجه اجرا: سبز (۹/۹). یک خطای fixture در حین توسعه اصلاح شد (stub سرور `amount: 0` برمی‌گرداند و گارد replay محصول به‌درستی رد کرد — محصول درست کار می‌کرد).

### SC-06 · لغو پرداخت ↔ reversal دفتر (تست ضعیف)

- منبع: `payment-cancel-reversal.test.ts` — STATIC_ONLY (فقط ترتیب متن منبع).
- تقویت: رفتار fail-closed (اگر reversal خطا دهد، پرداخت cancelled نمی‌شود) و ترتیب reverse-before-cancel اکنون با فراخوانی واقعی در سوئیت SC-05 اثبات می‌شود؛ propagation خطای PERIOD_CLOSED و عدم فراخوانی `repo.cancelPayment` در شکست. گارد استاتیک دست‌نخورده ماند.
- نتیجه اجرا: سبز (بخشی از ۹/۹).

### SC-07 · سایر مسیرهای push پارامتری

- منبع: `sync-engine.ts:1164-1365`.
- شکاف (با grep اثبات شد): مسیر موفق برای courier (close/assign/create)، resource_bookings، serials issue، journal reverse، price-list items/active، promotion active، payment delete→cancel وجود نداشت. مسیرهای conflict (409) برای serials/bookings از قبل پوشش داشت.
- ریسک: Medium-High (هم‌کلاس با باگ NO_ENDPOINT که این مسیرها برای رفع آن ساخته شدند).
- تست جدید: `sync-scenarios.test.ts:909-987`.
- نتیجه اجرا: سبز.

---

## C. شواهد تست — دستورات واقعاً اجراشده

| دستور (محل اجرا)                                                                                                | نتیجه واقعی                                                      |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npx jest --testPathPattern "sync-scenarios"` (apps/desktop)                                                    | ۴۸/۴۸ سبز                                                        |
| `npx jest --testPathPattern "sync-pull"` (apps/desktop)                                                         | ۱۷/۱۷ سبز (پس از اصلاح fixture)                                  |
| `npx jest --testPathPattern "features/sync"` (apps/desktop)                                                     | ۱۱ سوئیت، **۱۱۶ سبز**                                            |
| `npx vitest run src/__tests__/payment-device-server-parity.test.ts --project unit` (backend)                    | ۹/۹ سبز                                                          |
| `npx vitest run --project unit payments sync service-delivery package-credit parity` (backend)                  | ۲۵ فایل، **۳۳۹ سبز**                                             |
| `npx vitest run` (packages/local-engine — کامل)                                                                 | ۱۰۵ فایل، **۶۶۶ سبز**                                            |
| `npx vitest run --project pg service-delivery-sync-roundtrip service-delivery-02 operational-pull-02` (backend) | ۱۰ شکست = گارد «postgres بالا نیامد»؛ ۱۴ skip → **BLOCKED محلی** |
| `npx tsc --noEmit` (backend)                                                                                    | ۰ خطا                                                            |
| `npx tsc --noEmit` (packages/app-shell)                                                                         | ۰ خطا                                                            |
| `npx eslint <۴ فایل تغییرکرده backend>`                                                                         | ۰ خطا (۱ warning از قبل موجود، خط دست‌نخورده)                    |
| `npx eslint <۲ فایل تغییرکرده app-shell>`                                                                       | ۰ خطا                                                            |
| `git diff --check` (فایل‌های تغییرکرده)                                                                         | پاک                                                              |
| `git status --short` + `git rev-parse HEAD` (پایان)                                                             | HEAD بدون تغییر؛ تغییرات قبلی کاربر کامل حفظ شد                  |

تشخیص بلاکر PG (اجراشده، نه حدس): `initdb` در `.pgtest/` موفق؛ `postgres.exe` با
`FATAL: could not create shared memory segment: error code 1314` خارج می‌شود.
توکن لاگین، Administrators فیلترشده («deny only»، Medium integrity) است؛ PostgreSQL
در ویندوز توکن خودش را محدود می‌کند و `SeCreateGlobalPrivilege` را می‌اندازد —
حتی با وجود اینکه توکن والد آن را دارد (mapping سراسری ۱۴۴MB از PowerShell موفق،
از postgres ناموفق). در ویندوز فقط `shared_memory_type=windows` وجود دارد، پس
mapping سراسری نام‌دار اجتناب‌ناپذیر است. این همان شکستی است که
`helpers/pg-binaries.ts` مستند کرده. رفع آن نیازمند تغییر سیاست امنیتی
(اعطای privilege + sign out/in) است که قوانین مخزن و مأموریت ممنوع کرده‌اند.

---

## D. شکاف‌های باقی‌مانده

| مورد                                                                                                                                 | شدت                          | دلیل دقیق                                                                                      | شواهد                                                                     | وابستگی                    | اقدام بعدی                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------- |
| اجرای محلی ۳ سوئیت PG (SC-04 + دو فایل مرجع)                                                                                         | High (از نظر اثبات، نه پوشش) | error 1314 — توکن فیلترشده ویندوز؛ `SeCreateGlobalPrivilege` توسط خود postgres انداخته می‌شود  | لاگ واقعی `pg.start()`؛ probeهای اندازه mapping؛ مستندات `pg-binaries.ts` | CI با توکن دارای privilege | اجرای `--project pg` در CI؛ نتیجه هرگز محلی PASS شمرده نشود |
| ۵ موجودیت pull فقط-خواندنی (`cost_layer`, `stock_batches`, `stock_serials`, `inventory_settings`, `account`) هنوز fixture خالی دارند | Medium/Low                   | داده مرجع بدون mutation مالی دستگاه؛ چهار موجودیت عملیاتیِ مجموعه F-002 اکنون پرشده پوشش دارند | `sync-pull.test.ts`                                                       | ندارد                      | در صورت نیاز، fixture پرشده مشابه SC-03                     |
| `payment-cancel-reversal.test.ts` همچنان گارد متنی است                                                                               | Low                          | رفتار اکنون جداگانه با تست رفتاری SC-05 اثبات می‌شود؛ گارد متنی به‌عنوان محافظ اضافه ماند      | فایل + سوئیت parity                                                       | ندارد                      | اختیاری: تبدیل کامل به رفتاری                               |
| harness یکپارچه device-outbox→server→pull برای stock/returns/transfers                                                               | Low                          | پوشش کانونی موجود است (۶۶۶ + ۳۳۹ سبز)؛ این یک consolidation آینده است نه invariant جاافتاده    | ماتریس SC-11/SC-12/SC-24                                                  | ندارد                      | تصمیم معماری آینده                                          |
| خارج از مجموعه شکاف قابل‌اقدام: payroll/attendance، مصرف تولید، FX trade drafts، سمت سرور courier POD/COD                            | Low                          | توسط این مأموریت بازاثبات نشد؛ مسیرهای push موجودشان در SC-07 پوشش گرفت                        | بخش B ماتریس                                                              | ندارد                      | ممیزی جداگانه در صورت درخواست                               |

هیچ مورد BLOCKED یا NOT_RUN به PASS تبدیل نشد.

---

## E. اثر معماری

- **کد محصول: صفر تغییر.** هیچ مالکیت کانونی، قرارداد مشترک، مسیر sync، mapping داده
  یا مرز تراکنش تغییر نکرد.
- تنها تغییرات: ۲ فایل تست app-shell (توسعه سوئیت‌های کانونی موجود)، ۲ فایل تست جدید
  backend، ۲ فایل تست PG موجود (+۱ خط `pg.initialise()` در هرکدام — اصلاح زیرساخت تست،
  نه رفتار محصول)، و `docs/testing/`.
- هیچ موتور کسب‌وکار، موتور sync، resolver یا پیاده‌سازی موازی ساخته نشد.
- رفتار offline-first و invariantهای مالی (۱۵گانه مأموریت) دست‌نخورده ماند و توسط
  تست‌های جدید محافظت می‌شود.
- وابستگی جدید اضافه نشد؛ فریمورک تست جدید معرفی نشد (jest/vitest/embedded-postgres موجود).

---

## F. حکم نهایی

**IMPLEMENTED_AND_TESTED**

برای تمام محدوده قابل‌اجرای محلی: هر شکاف High کشف‌شده با تست واقعیِ اجراشده و سبز
بسته شد (۱۱۲۱ تست سبز در دو طرف هر اتصال تغییرکرده + سوئیت کامل local-engine)،
بدون هیچ رگرسیون، بدون نقض type/lint، بدون تغییر کد محصول.

بخش PostgreSQL (SC-04 و دو فایل مرجع): **IMPLEMENTED_NOT_LIVE_VERIFIED** —
تست‌ها نوشته و اصلاح زیرساخت انجام شد، اما اجرای محلی به‌دلیل بلاکر مستند محیطی
ویندوز ممکن نیست و به CI وابسته است. این تنها آیتم باز است و به‌صورت صریح BLOCKED
گزارش شد، نه PASS.

توصیه مطابق درخواست کاربر: این گزارش و ماتریس پوشش را **پیش از شروع بازطراحی
Warehouse** نگه دارید؛ اتصال موجودی/حسابداری/فروش/Sync اکنون برای مسیرهای بحرانی
اثبات‌شده است و تنها اثبات PG آن به CI منتظر است.
