# HISABCHE — BUSINESS OS EXECUTION PROTOCOL

> این فایل **قانون** است. `BUSINESS-OS-SPEC.md` نقشه است.
> هر قابلیتی که طبق این پروتکل پیاده نشود، انجام‌نشده حساب می‌شود.

---

## ۱. قانون حاکم هر قابلیت

```
INSPECT → PROVE → GAP → REUSE → EXTEND → BUILD → TEST → VERIFY
```

| گام     | معیار قبولی                              | اگر رد شد                                       |
| ------- | ---------------------------------------- | ----------------------------------------------- |
| INSPECT | فایل واقعی خوانده شده، نه اسمش           | ادامه نده                                       |
| PROVE   | `grep` نشان داده caller دارد یا ندارد    | اگر صفر caller → کار **وصل‌کردن** است، نه ساختن |
| GAP     | دقیقاً کدام رفتار کم است، با `file:line` | اگر نتوانی بگویی → هنوز نفهمیدی                 |
| REUSE   | Engine موجودی که مالک رفتار است          | —                                               |
| EXTEND  | فقط چیزی که واقعاً کم است                | —                                               |
| BUILD   | —                                        | —                                               |
| TEST    | هر لایه‌ی تست                            | —                                               |
| VERIFY  | خروجی واقعی                              | —                                               |

**قانون طلایی (درس ۸۴):** اولین دستور هر قابلیت
`grep -rn "<نام تابع/endpoint/engine>" backend/src packages | grep -v test`
است. **صفر نتیجه یعنی کار «وصل‌کردن» است، نه «ساختن».**

---

## ۲. سه حالت مجاز

| حالت            | شرط                | اقدام                                   |
| --------------- | ------------------ | --------------------------------------- |
| **EXISTS**      | رفتار کامل هست     | ❌ هیچ کاری. در گزارش بنویس «موجود بود» |
| **PARTIAL**     | بخشی هست           | EXTEND همان Engine. Engine جدید ⛔      |
| **CONSOLIDATE** | چند پیاده‌سازی هست | اول مالکیت را تعیین کن، بعد رفتار جدید  |

**اگر برای یک قابلیت «EXISTS» تشخیص دادی، بنویس و رد شو.** این موفقیت است،
نه شکست. گزارش نهایی باید این را صادقانه بگوید.

---

## ۳. چه چیزی ممنوع است

```
⛔ ۱۵۰ سرویس جدید
⛔ ۱۵۰ domain module
⛔ ۱۵۰ scheduler / cron مستقل
⛔ ۱۵۰ سیستم notification
⛔ ۱۵۰ سیستم permission
⛔ ۱۵۰ سیستم AI
⛔ یک Engine جدید بدون شاهد کد
⛔ یک جدول جدید بدون پاسخ به ۵ سؤال بند ۵
⛔ حذف یا rename یک Engine موجود
⛔ DELETE جبرانی
⛔ `any` · `@ts-ignore` · `eslint-disable`
⛔ ادعای PASS بدون خروجی واقعی
⛔ گارد شل‌شده برای سبز شدن
```

**نسبت‌سنج:** اگر Engine جدیدِ ساخته‌شده ÷ قابلیتِ پیاده‌شده > ۱ شد، یک Engine
را دوباره ساخته‌ای. برگرد و `SPEC` §3 را بخوان.

---

## ۴. مسیر امن برای پول

هر قابلیت مالی **دقیقاً** از این مسیر عبور می‌کند:

```
UI / API / AI / Integration
  → domain command
  → authorization (requireWorkspaceContext → requireCapability)
  → domain validation (pure, testable)
  → authoritative engine (Ledger / Costing / Payments / Stock / Budget)
  → Postgres function (atomic) + .rpc()
  → projection trigger
  → audit + event/outbox
```

**هر انحرافی از این مسیر یک باگ است، حتی اگر تست سبز باشد.**

مثال‌های ملموس از این پروژه که با همین قانون گرفته شدند:

- `paid_amount` روی PATCH مستقیم نوشته می‌شد
- `DELETE /api/transactions/:id` به‌جای `cancelPayment`
- `POST /api/upgrade` بدون پرداخت فعال می‌کرد
- `total` از body کلاینت

---

## ۵. مسیر امن برای AI

```
Intent → Plan → typed domain command → existing engine → audit
```

⛔ `AI → Database` — هرگز.
⛔ مدل هرگز `workspace_id` را به‌عنوان آرگومان نمی‌گیرد
⛔ مدل هرگز SQL نمی‌نویسد
⛔ هر action مولد AI: authorization + validation + idempotency + transaction + audit + event

`reporting-reader.ts` این را «closed set of four views» می‌نامد. **گسترش آن
نیازمند بازبینی هر view جدید است، نه یک خط اضافه.**

---

## ۶. مسیر امن برای Import

```
Input → Parse → Normalize → Validate → Preview → Resolve → Authorize
      → domain command → transaction → audit → result
```

⛔ هرگز مستقیم به جدول مالی نوشته نشود.
⛔ `migration_records` کلید idempotency است — re-run باید update کند نه insert.
⛔ مانده‌ی اول دوره **هرگز** بازنویسی نمی‌شود.
⛔ سلول خالی یعنی «منبع نگفت»، نه «خالی کن».

---

## ۷. مسیر امن برای Export

هر exporter باید:

- `workspace_id` را از `ctx` بگیرد، هرگز از پارامتر
- field-level restrictionهای `deniedFields` را رعایت کند
- snapshot سازگار بگیرد (یک cursor، نه چند query جدا)
- audit بنویسد
- سقف ردیف نداشته باشد (`selectAllPages`، نه `.limit(5000)`)

---

## ۸. مسیر امن برای Automation

هر کار زمان‌بندی‌شده **باید** از این‌ها استفاده کند:

```
claim_scheduled_run  ·  FOR UPDATE SKIP LOCKED  ·  complete_scheduled_run
fail_background_job  ·  idempotency key  ·  execution history
enable/disable  ·  scope  ·  failure state  ·  audit
```

⛔ `setInterval` جدید
⛔ `node-cron` جدید
⛔ صف جدید جدا از `email_outbox` / `background_jobs`

---

## ۹. مسیر امن برای Integration

```
Connector → Credential → Scopes → Rate Limit → Retry → Event Mapping
          → domain command
```

⛔ `WhatsAppService` / `TelegramService` / `GmailService` جداگانه
⛔ auth اختصاصی برای هر connector
⛔ connector که مستقیم به جدول مالی می‌نویسد

هر connector یک **adapter** است روی N5، نه یک subsystem.

---

## ۱۰. درباره‌ی دیتابیس

پنج سؤال قبل از هر migration:

1. آیا جدول/ستون موجود می‌تواند این state را نگه دارد؟
2. آیا Engine موجود می‌تواند این رفتار را مالک شود؟
3. آیا مدل event/workflow موجود نمایشش می‌دهد؟
4. آیا زیرساخت metadata موجود نمایشش می‌دهد؟
5. آیا واقعاً جدول جدید لازم است؟

اگر پاسخ ۱–۴ «بله» است، **جدول جدید ممنوع**.

**قواعد SQL:**

- `add column if not exists` · `create index if not exists`
- فقط additive. هرگز drop در همان migration که استفاده را متوقف می‌کند
- `not null` بدون default ممنوع
- ایندکس همان query در همان فایل
- کامنت سر فایل: **چرا** این ستون هست، شکلش، و نبودنش یعنی چه
- بلوک Rollback/Mitigation

**⛔ DDL روی دیتابیس زنده اجرا نمی‌شود.** فایل می‌نویسم، انسان اجرا می‌کند.
تا وقتی نتیجه‌ی واقعی گزارش نشده:
`Post-migration verification query generated — PENDING HUMAN CONFIRMATION`

---

## ۱۱. تست — شرط کامل‌بودن

هیچ قابلیتی بدون این‌ها کامل نیست:

| لایه          | چه چیزی                                        |
| ------------- | ---------------------------------------------- |
| Domain        | مسیر خوش‌بینانه + ورودی نامعتبر + لبه‌ها       |
| Invariant     | فرمول مالی، دقیق نه تقریبی                     |
| Authorization | بدون capability رد شود                         |
| Tenancy       | workspace دیگر صفر ردیف                        |
| Idempotency   | همان ورودی دوبار = همان نتیجه (اگر applicable) |
| Concurrency   | دو درخواست هم‌زمان (اگر applicable)            |
| Audit         | رکورد نوشته می‌شود                             |
| Event         | رویداد منتشر می‌شود                            |
| Rollback      | شکست نیمه‌کاره چه می‌کند                       |

**گاردهای استاتیک** باید `injection-tested` باشند: فیکس را برگردان، تست باید
قرمز شود. گاردی که امتحان نشده، گاردی است که تصادفی پاس می‌شود.

**گاردِ سورس‌خوان باید اول کامنت‌ها را حذف کند** — وگرنه کامنتی که همان باگ را
توضیح می‌دهد، گارد را قرمز می‌کند.

---

## ۱۲. Performance

⛔ N+1 · ⛔ per-row AI call · ⛔ per-record background job
⛔ `.limit(N)` روی خواندنی که تصمیم می‌سازد · ⛔ `count: 'estimated'`
⛔ بدون pagination · ⛔ subscription تکراری realtime

✅ `callAggregate` · `selectAllPages` · `count: 'exact', head: true`
✅ batch (مثل `useBulkAction` با ۵تایی) · idempotency key

**⛔ هرگز برای پرفورمنس، درستی حسابداری را قربانی نکن.**

---

## ۱۳. Mobile / Offline

⛔ ارتقای Expo / React Native
⛔ `react-native-web` یا WebView جدید

هر قابلیت offline-sensitive باید تعریف کند:

- نمایش محلی
- رفتار sync
- معنی conflict
- idempotency
- مرجع نهایی (سرور)

**قانون مرز (`push-routing.ts`):** هر چیزی که اثر مالی دارد → **فقط** مسیر
دامنه. مسیر نسخه‌دار فقط برای فیلد توصیفی.

---

## ۱۴. گزارش — بدون استثنا

```
Engines reused:
Engines extended:
New engines created (with code evidence):
Capabilities implemented:
Capabilities already existing (no work needed):
Database migrations (PENDING HUMAN CONFIRMATION):
Tests added:
Verification (actual output):
Real blockers:
```

⛔ بدون زبان بازاریابی
⛔ بدون «تقریباً کامل»
⛔ «کامل» فقط وقتی backend + تست + مجوز + persistence + یکپارچگی تأیید شده

---

## ۱۵. ترتیب اجرای فازها

```
فاز ۰  رفع بدهی زیربنایی       ← بدون قابلیت جدید
فاز ۱  Financial Core          62 65 69 70 128
فاز ۲  Commerce Core           19 109 114 115 116 117 120 123 124
فاز ۳  Treasury               38 51 53 55 56 66 125 126
فاز ۴  Supply Chain           10 15 19 59 60 61
فاز ۵  Automation Platform    57 58 63 64 68 81 87 89 112
فاز ۶  Intelligence           1-5 7 10-14 16 18 20 30 121 129-135
فاز ۷  Customer Intelligence  3 9 13 18 106 107 108 109 111
فاز ۸  Data Ownership         36-50 61
فاز ۹  Integration Platform   21-35 137 147 148 149
فاز ۱۰ Advanced Platform      104 141 142 143 144 145 146 150
فاز ۱۱ Experience             71-80 82-84 86 88 90-97 100-103
فاز ۱۲ Hardening              audit امنیتی + performance + audit مالی
```

هر فاز یک PR. فاز بعدی تا سبزشدنی قبلی شروع نمی‌شود.

⚠️ ترتیب فاز ۸ بعد از ۹ است عمداً: Data Ownership زیربنای Connectors است
(هر connector داده می‌آورد). اما فاز ۸ به Engine جدید نیاز ندارد، پس اگر
بخواهی زودتر شروع شود، فقط باید `SPEC` §5 را به‌روز کنی و دلیل بنویسی.

---

## ۱۶. چیزهایی که این پروتکل اجازه نمی‌دهد

| اقدام                                           | چرا                          |
| ----------------------------------------------- | ---------------------------- |
| ساختن Engine جدید چون «اسمش قشنگ‌تر است»        | G4                           |
| تغییر نام Engine برای sophisticated‌تر دیده شدن | صریحاً ممنوع در پرامپت       |
| rename یا حذف Engine موجود                      | مهاجرت ≠ نوشتن از اول        |
| شل‌کردن گارد برای سبزشدن                        | درس ۵۴                       |
| «تست دامنه پاس شد» = قابلیت هست                 | درس ۴۲                       |
| «سند گفت این‌طور است» = واقعیت است              | درس ۵۳ — **دیتابیس را بپرس** |
| حدس‌زدن نقش یا مقدار برای داده‌ی ناقص           | §۱۲                          |
| تعمیر بی‌صدا                                    | §۱۳ — **اول گزارش**          |
| ساختن feature با Policy تعریف‌نشده              | G4                           |
| DDL روی دیتابیس زنده                            | §۰                           |
