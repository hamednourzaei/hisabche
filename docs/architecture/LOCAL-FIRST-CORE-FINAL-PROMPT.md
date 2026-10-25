# پرامپت نهایی — بستن هسته‌ی Local-First (آخرین دور)

> این آخرین دور است. هدف: هر چیزی که «ساخته شده ولی اثبات نشده» است یا **اثبات شود** یا **صریح با دلیل** در وضعیتش بماند.
> هیچ مسیر موازی نساز. هیچ عددی بدون فرمانی که ساختش گزارش نکن.

## ۰. قواعد ثابت (نقض هرکدام = رد کل تحویل)

1. **commit و push نکن.** subagent نساز. وسط کار نپرس «کدام فاز».
2. HEAD الان `7f2081f3190432258b76692b4f35056d8fffab10` است. در گزارش پایانی با `git rev-parse HEAD` تأییدش کن.
3. **هسته یکی است:** `packages/validation` (قواعد خالص) + `packages/local-engine`. پکیج `packages/domain` یا هر لایه‌ی دوم نساز. `domain-ports.ts` و `domain-events.ts` عمداً حذف شده‌اند؛ برنگردانشان (گارد: `architecture-boundaries.test.ts`).
4. هیچ DDL مستقیم روی دیتابیس زنده. فقط فایل SQL در `docs/` (additive، idempotent، با Rollback) + فایل VERIFY جدا. تا انسان اجرا نکرده، بنویس `PENDING HUMAN CONFIRMATION`.
5. **فقط با vitest/jest خود پروژه سبز اعلام کن.** هر harness کناری (`.agent-notes/*`) مدرک سبزی نیست. دو دور پیش همین باعث دروغ شد.
6. سوئیت‌ها را **پشت سر هم** اجرا کن (embedded-postgres موازی timeout می‌دهد). اجرا از پوشه‌ی همان پکیج با `pnpm exec vitest run`.
7. در این شل heredoc و `node -e` با backtick/بک‌اسلش خراب می‌شوند → اسکریپت را با Write بساز.
8. وضعیت‌های مجاز: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED_EXTERNAL_CREDENTIAL` · `BLOCKED_BY_EXISTING_SYSTEM` · `NOT_APPLICABLE` · `FAILED`. بدون HTTP یا دیتابیس واقعی، چیزی `VERIFIED_COMPLETE` نیست.

## ۱. خط پایه‌ی تأییدشده (دوباره کشف نکن، فقط در ابتدا یک بار اجرا و ثبت کن)

| مورد                  | مقدار فعلی                                                             |
| --------------------- | ---------------------------------------------------------------------- |
| ماتریس                | ۴۶۲ ردیف: ۱۶۰ available / ۲۸۷ online_required / ۱۵ not_supported       |
| validation            | ۴۶۵ تست                                                                |
| local-engine          | ۱۵۲ تست                                                                |
| backend               | ۴۵۶۰ پاس، ۷۴۳ skip، بدون شکست؛ فایل‌های `\|pg\|` به‌خاطر محیط می‌ریزند |
| ui `no-import-cycles` | ۴/۴                                                                    |
| tsc بک‌اند            | فقط خطای قدیمی `warehouse-summary.domain.ts:62`                        |
| Shadow                | فقط روی `POST /api/payments` (`core-shadow.ts` → `core_divergence`)    |

اگر عددی با این‌ها نمی‌خواند، اول بگو چرا، بعد ادامه بده.

## ۲. کارهای این دور (به‌ترتیب؛ هر کدام با شرط «انجام‌شده»)

### A. آلارم واگرایی (الان وجود ندارد)

- داده هست: جدول `core_divergence` + `CoreDivergenceService` (kill switch هم هست).
- بساز: یک **خواندنی** برای نرخ واگرایی به‌ازای هر capability در بازه‌ی زمانی، و یک شرط آستانه‌ی صریح (مقدار پیش‌فرض صریح، حالت «غیرفعال» شرط جدا، نه آستانه‌ی صفر).
- اجرا فقط روی **job runtime موجود** (`distributed-work.ts` / `email-outbox.ts`). job یا scheduler دوم نساز (گارد: `job-authority-guard.test.ts`).
- خروجی به نوتیفیکیشن/اعلان موجود می‌رود؛ سیستم اعلان دوم نساز. خطای ارسال اعلان هرگز نباید نوشتن اصلی را برگرداند.
- تست: واگرایی ساختگی در fixture → آلارم می‌خورد؛ بدون واگرایی → نمی‌خورد؛ آستانه روی مرز (`<` نه `<=`)؛ **injection-test** (حذف شرط → تست قرمز شود).
- هر جدول/ستون تازه = migration در `docs/` + VERIFY + RLS (زنجیره‌ی عضویت workspace، نه `app.current_workspace_id`) و ردیف در `rls-coverage`.

### B. اجرای golden vectors روی Electron main و React Native

- corpus: `packages/validation/src/__golden__/vectors.json` با runner `run-vectors.ts` (با import مستقیم ماژول‌ها، نه barrel).
- یک تست در `apps/desktop` (jest) و یکی در `apps/mobile` (jest) بنویس که **همان runner** را import کند و همان ۱۴ بردار را پاس کند. کپی دوم corpus ممنوع.
- اگر jest به `@noble/*` یا ESM گیر کرد، `transformIgnorePatterns` موجود را گسترش بده (قبلاً حل شده).
- شرط انجام: `cd apps/desktop && npx jest` و `cd apps/mobile && npx jest` هر دو سبز با شمار تست واقعی. اگر mobile به‌خاطر محیط اجرا نشد، دقیقاً همان خروجی را بیاور و وضعیت `BLOCKED_BY_EXISTING_SYSTEM` بزن؛ ادعای سبزی نکن.

### C. اثبات pg (مایگریشن `core-divergence`)

- مشکل محیط: `initdb` روی `%TEMP%` دسترسی عوض نمی‌کند و shared memory خطای ۱۳۱۴ می‌دهد. `helpers/pg-temp-dir.ts` هست.
- کار تو: (۱) اگر روی این ماشین نشد، **دور نزن**؛ (۲) یک اسکریپت یک‌فرمانی بنویس که انسان روی ماشین دیگر/سرویس Postgres واقعی اجرا کند و همان ۱۳ تست را بزند؛ (۳) `docs/VERIFY-core-divergence.sql` را بازبینی کن که فقط SELECT باشد و `ok: true/false` به‌ازای هر قید بدهد.
- وضعیت نهایی این مورد `IMPLEMENTED_NOT_LIVE_VERIFIED` می‌ماند تا انسان نتیجه را گزارش کند.

### D. پوشش shadow: هر مسیر پولی یا حکم صریح

جدولی بساز (در `docs/architecture/CORE-READINESS.md`): برای هر مسیر پولی زیر یکی از دو چیز:
`wired` (محل فراخوانی + تستی که با HTTP/inject واقعی واگرایی را می‌گیرد) یا `out-of-scope` (دلیل از کد، نه حدس):
`POST /api/invoices`، حذف/لغو فاکتور (`reverseEffects`)، `POST /api/payments` (هست)، تخصیص پرداخت، مصرف لایه‌ی بها (FIFO/avco)، قفل دوره، حقوق (`PayrollOutcome`).

- فقط مسیری را wired کن که قاعده‌اش **واقعاً** در `packages/validation` است و دو خواننده دارد (سرور + موتور). اگر قاعده فقط در سرور است، آن را اول به validation ببر (یک تعریف، دو خواننده) و بعد shadow بزن. دو نسخه از یک قاعده ممنوع (گارد: `one-rule-each.test.ts`).
- shadow هرگز پاسخ کاربر را عوض نمی‌کند و هرگز نوشتن را متوقف نمی‌کند؛ kill switch هر capability را به `SERVER_LEGACY` برمی‌گرداند.

### E. اندازه‌گیری زیر بار (الان «NOT MEASURED»)

- seed واقعی یک workspace (چند مشتری/کالا/فاکتور)، سرور واقعی، **HTTP واقعی** (autocannon یا k6 اگر نصب است؛ وگرنه اسکریپت Node با `fetch`).
- یک سناریو روز-فروشگاه، دوبار: مسیر فعلی سرور و مسیر با shadow. هر دو ستون با شش عدد: درخواست در کاربر-ساعت، CPU-ms بک‌اند، پرس‌وجو در ردیف، p50/p95/p99، بایت sync.
- هر عدد کنار فرمانی که ساختش بیاید و فایل اسکریپت. عددی که اندازه نگرفته‌ای را ننویس؛ خالی بگذار با «NOT MEASURED».
- اگر محیط اجازه‌ی اجرای سرور واقعی با Supabase/Postgres نداد، همین را صریح بنویس و اسکریپت را برای اجرای انسان بگذار.

### F. کاهش ردیف‌های `unproven` در CSV (۲۰۵ ردیف)

- فقط با شواهد کد: برای هر ردیف بخوان handler سرور همان endpoint را و بگو یکی از: `none` (می‌تواند محلی شود → در ماتریس هم مسیر محلی یا دلیل نگذاشتن)، یا یکی از دلایل بسته‌ی `webhook-delivery | file-storage | ai-provider | subscription-billing | auth`، یا بماند `unproven`.
- مدرک `reason@` باید به فایل‌هایی اشاره کند که **handler همان endpoint** می‌بیند، نه کلیدواژه‌ی دامنه. `reason~` برای مدرک ضعیف‌تر.
- عدد `unproven` را فقط اگر مدرک داری کم کن. هدف عدد خاصی نیست؛ دقت هدف است.
- `capability-matrix-csv.test.ts` باید همچنان ۴۶۲ ردیف و ۴۶۲ evidence یکتا را بسنجد.

## ۳. گاردهای یکپارچگی که باید در پایان سبز باشند

```bash
cd packages/validation && pnpm exec vitest run
cd packages/local-engine && pnpm exec vitest run
cd packages/api && pnpm exec vitest run
cd packages/formatting && pnpm exec vitest run
cd packages/ui && pnpm exec tsc --noEmit && pnpm exec vitest run
cd backend && pnpm exec tsc --noEmit && pnpm exec vitest run
cd apps/desktop && npx tsc --noEmit && npx jest
cd apps/mobile && npx tsc --noEmit && npx jest
```

- دقیقاً این گاردها را نام ببر و خروجی را بیاور: `no-import-cycles`، `unwired-capability`، `rls-coverage`، `offline-matrix-guard`، `job-authority-guard`، `architecture-boundaries`، `one-rule-each`، `capability-matrix-csv`.
- برای هر گاردی که تازه می‌سازی یا لمس می‌کنی **injection-test** کن: فیکس را موقتاً بردار، قرمز شدن را نشان بده، بازگردان (بایت‌به‌بایت؛ `git diff` خالی برای آن فایل).
- eslint روی فایل‌های تغییرکرده، از پوشه‌ی همان پکیج: ۰ خطا، ۰ اخطار.
- فایل‌های `|pg|` که به‌خاطر محیط می‌ریزند را در یک جدول جدا بشمار (تعداد + علت دقیق)؛ در عدد «پاس» قاطی نکن.

## ۴. تله‌های شناخته‌شده‌ی این ریپو (قبلاً گاز گرفته‌اند)

- barrel خودِ پکیج را داخل همان پکیج import نکن (چرخه/TDZ). کد تست‌ساپورت (runner) از barrel تولیدی export نشود.
- `vi.mock` با `{...actual.Class}` متدهای static را گم می‌کند → subclass یا `vi.importActual` با `Object.assign`.
- `vi.mock` نسبت به **فایل تست** resolve می‌شود.
- سیاست RLS روی `workspace_id` با زنجیره‌ی عضویت؛ `app.current_workspace_id` در این پروژه وجود ندارد.
- `.eq('col', null)` ممنوع؛ `.is('col', null)`.
- ستون جدید اختیاری را جدا بخوان؛ روی `42703`/`PGRST204` «فعال نیست».
- پول همیشه integer minor؛ هیچ float در مسیر مالی؛ مبلغ را سرور از خطوط درمی‌آورد.
- کد مرده نگه نداری (§۱۴): چیزی که مصرف‌کننده ندارد یا وصل شود یا حذف.
- تست‌های source-assertion اول کامنت‌ها را حذف کنند.

## ۵. مستندات و درس‌ها

- `docs/architecture/PROGRESS.md`، `CORE-READINESS.md`، `MEASUREMENTS.md`، `OPEN-QUESTIONS.md` را با نتیجه‌ی واقعی به‌روز کن. هر ادعای قبلی که این دور رد شد، در همان فایل **اصلاح** شود، نه حذف بی‌صدا.
- یک `ADR-007` برای تصمیم‌های این دور (آلارم، پوشش shadow، سیاست `unproven`).
- درس‌های تازه را در `.claude/lessons-learned.md` (شماره‌ی بعدی) و بخش مربوط در `CLAUDE.md` اضافه کن.
- `node scripts/build-ai-index.mjs` را اجرا کن.
- **بیلد نگیر.**

## ۶. شکل گزارش پایانی (فارسی، جدول، عدد واقعی)

۱. جدول: بخش A..F → وضعیت (از فهرست مجاز) → مدرک (فرمان + خروجی خلاصه).
۲. جدول سوئیت‌ها: قبل / بعد / تفاوت. فایل‌های pg جدا.
۳. فهرست فایل‌های ساخته‌شده/تغییرکرده.
۴. آنچه **انجام نشد** و دلیل دقیق (نه «به‌خاطر زمان»).
۵. آنچه انسان باید اجرا کند: SQL، VERIFY، تست pg روی ماشین بدون محدودیت.
۶. بیان صریح: هسته‌ی موازی ساخته شد یا نه؛ `git rev-parse HEAD`؛ commit نشده.

اگر در حین کار با یک ابهام روبه‌رو شدی که پاسخش در کد هست، کد را بخوان. اگر پاسخش تصمیم محصول است، در `OPEN-QUESTIONS.md` بنویس و با پیش‌فرض امن (کمترین دسترسی، بدون حدس) جلو برو.
