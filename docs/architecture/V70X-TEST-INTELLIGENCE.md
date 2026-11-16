# V70.x — Test Intelligence & Performance Engineering

> **وضعیت پرونده:** سفارش کار باز است. هر فاز فقط با شاهد اندازه‌گیری‌شده تیک می‌خورد.
> **ورودی مالک:** پرامپت «ممیزی کامل تست، ماتریس زبان، بهینه‌سازی عملکرد» (۱۶ نوامبر ۲۰۲۶).
> **ممنوع:** حذف تست، ضعیف‌کردن assertion، ماک‌کردن تست یکپارچه برای سرعت،
> تغییر رفتار محصول برای سبز شدن بنچمارک، نصب وابستگی، DDL روی دیتابیس زنده، commit/push.
> **ابزار ممنوع:** subagent، session موازی، عامل پس‌زمینه.

## ۰. دو عدد که هرگز با هم جمع نمی‌شوند

| شاخص                                | چه چیزی را می‌سنجد                                                        | دستگاه اندازه‌گیری                                                 |
| ----------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Test Execution Performance**      | هزینهٔ اجرای خود تست: اسکن AST، خواندن فایل، spawn مولد، راه‌اندازی jsdom | `vitest --reporter=json` (ms هر تست)                               |
| **Application Runtime Performance** | زمان عملیات واقعی محصول: SQLite، HTTP، صف، قفل، شبکه                      | `scripts/measure/core-bench.mjs` و `scripts/measure/http-load.mjs` |

> تست ۱۳ ثانیه‌ای که کل مخزن را می‌خواند، ثابت نمی‌کند فروش ۱۳ ثانیه طول می‌کشد؛
> تست ۲۰۰msای هم ثابت نمی‌کند API سریع است. این دو گزارش جدا نوشته می‌شوند.

## ۱. فازها و دروازه‌ها

| فاز                          | کار                                                                                                                            | دروازهٔ پذیرش                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **X0 — Preflight**           | خواندن `AGENTS.md`، پیکربندی vitest/jest، اسکریپت‌های تست، CI، گزارش‌های قبلی (`docs/audit/`)، `git status`                    | فهرست framework هر پکیج و وضعیت working tree ثبت شده                    |
| **X1 — Discovery**           | `scripts/test-intel/discover-tests.mjs` → `TEST-REGISTRY.json`                                                                 | هر فایل تست یک ردیف با پکیج، framework، سطح، دامنه، هزینه‌های فراخوانده |
| **X2 — Taxonomy**            | سطح (unit/component/contract/integration/pg/e2e/guard/static/perf/security/migration/sync/parity) + دامنه + criticality P0..P4 | هیچ تستی `unknown` بدون توضیح                                           |
| **X3 — Locale matrix**       | پوشش `fa-IR` / `fa-AF` / `en` برای مسیرهای مالی و مجوز                                                                         | ماتریس دامنه×زبان با شاهد تست، نه ادعا                                  |
| **X4 — Duration**            | گزارش ms هر تست، median/p75/p90/p95/p99، ۱۰/۲۵/۵۰ کندترین                                                                      | اعداد از JSON واقعی؛ سوئیت ناتمام «در انتظار» علامت می‌خورد             |
| **X5 — Root cause**          | علت هر گلوگاه با شاهد کد                                                                                                       | هر ردیف: فایل:خط، ms فعلی، علت، شاهد                                    |
| **X6 — Safe optimization**   | فقط هزینه‌های زیرساختی: پارس دوباره، پیمایش تکراری، spawn تکراری، خواندن تکراری                                                | قبل/بعد برای هر فایل، صفر assertion حذف‌شده                             |
| **X7 — Profiles**            | `local-fast` / `local-full` / `linux-ci` / `postgres-integration` / `release-gate` / `performance`                             | هر پروفایل با دستور اجرا و دامنهٔ مشخص                                  |
| **X8 — Runtime performance** | اندازه‌گیری عملیات پرارزش روی هستهٔ خالص                                                                                       | بدون Postgres/دستگاه ⇒ `BLOCKED_EXTERNAL`، نه عدد ساختگی                |
| **X9 — Budgets**             | بودجه فقط پس از baseline واقعی، با آستانهٔ نویز                                                                                | هیچ بودجهٔ دلبخواهی                                                     |
| **X10 — Regression proof**   | اجرای دوبارهٔ همان سوئیت‌ها؛ مقایسهٔ count/pass/skip/ms                                                                        | تعداد تست و assertion کاهش نیافته                                       |
| **X11 — Report**             | گزارش فارسی با ۱۸ بند خواسته‌شده                                                                                               | هیچ PASS بدون اجرا                                                      |

## ۲. مصنوعات (یک جا، بدون تکرار سند موجود)

```
docs/architecture/test-intelligence/
  TEST-REGISTRY.json        ← ماشین‌خوان: هر فایل تست + هزینه‌هایش
  TEST-TAXONOMY.md          ← سطوح، دامنه‌ها، criticality
  TEST-DURATIONS.md         ← ms هر تست، صدک‌ها، ۵۰ کندترین (قبل/بعد)
  TEST-ROOT-CAUSES.md       ← ۵۰ علت اندازه‌گیری‌شده
  LOCALE-MATRIX.md          ← fa-IR / fa-AF / en با شاهد
  PLATFORM-MATRIX.md        ← web / desktop / android / server
  TEST-PROFILES.md          ← شش پروفایل اجرا
  OPTIMIZATION-LOG.md       ← هر تغییر + قبل/بعد + ریسک
  KNOWN-LIMITATIONS.md      ← آنچه اجرا نشد و چرا
  RELEASE-GATE.md           ← چک‌لیست انتشار
scripts/test-intel/
  discover-tests.mjs        ← فقط خواندن درخت؛ چیزی اجرا نمی‌کند
```

سندهای موجود که **بازنویسی نمی‌شوند** و فقط ارجاع می‌گیرند:
`docs/audit/HISABCHE-TEST-QUALITY-AUDIT.md`، `docs/qa/TEST-DATA-LEDGER.md`،
`docs/architecture/universal-business-core/18-TESTING-STRATEGY.md`،
`docs/architecture/MEASUREMENTS.md`، `docs/architecture/V70-PROMPT.md`.

## ۳. قواعد سختِ بهینه‌سازی

1. کش فقط برای دادهٔ **تغییرناپذیر در طول یک اجرا** (فهرست فایل‌ها، محتوای فایل، خروجی پارس AST).
2. هیچ کشی روی دادهٔ مالی/tenant مشترک بین تست‌ها؛ هیچ ترتیبی وابسته به اجرای قبلی.
3. کم‌کردن هزینه هرگز نباید یک assertion را حذف یا یک تست را skip کند.
4. اگر بهینه‌سازی مستلزم تغییر معنای گارد است ⇒ متوقف شو و بنویس، نه اینکه سکوت کنی.
5. هر بهینه‌سازی با «برگرداندن اصلاح، قرمز شدن تست، بازگرداندن» تأیید می‌شود.

## ۴. واژگان وضعیت

`VERIFIED_COMPLETE` (فقط با اجرای واقعی و شاهد زنده) · `IMPLEMENTED_NOT_LIVE_VERIFIED` ·
`PARTIALLY_IMPLEMENTED` · `BLOCKED_EXTERNAL` · `NOT_IMPLEMENTED`

> در این مخزن، بدون Postgres زنده و دستگاه فیزیکی، سقفِ ممکن
> `IMPLEMENTED_NOT_LIVE_VERIFIED` است و بخش pg/android/windows صریحاً `BLOCKED_EXTERNAL`.

## ۵. بند هشتم (معماری) جدا می‌ماند

`X8` دربارهٔ زمان عملیات محصول است و با `V70.10 §8` (بازبینی معماری) قاطی نمی‌شود.
هر عددی که از محیط محلی گرفته شود، در گزارش با نام دستگاه و اندازهٔ دیتاست می‌آید.
