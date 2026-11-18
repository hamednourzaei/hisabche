# حسابچه — برنامه‌ی فازبندی‌شده‌ی فروش‌پذیری (V74)

**تاریخ:** ۱۷ نوامبر ۲۰۲۶  
**HEAD هنگام اندازه‌گیری:** `9094ec0d` (`main`)؛ مالک در پایان دور، کار را در `f28003e2 fixed ci 20` ثبت کرد.  
**مبنا:** `scripts/industry/sellable-criteria.mjs` (۱۰ معیار رسمی)، `docs/architecture/industry/sellable-industries.json`، `docs/industries/SHARED-CAPABILITY-MATRIX.md`، رجیستری ۶۷ صنف.  
**قاعده:** هیچ عددی در این سند بدون اجرا یا خواندن فایل منبع نوشته نشده است.

## ۱. آنچه عددهای فعلی می‌گویند (اندازه‌گیری‌شده)

| سنجه                                         | مقدار                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| صنف ثبت‌شده / دارای پروفایل / دارای گردش‌کار | ۶۷ / ۶۷ / ۶۷                                                                          |
| صنف با ۸ معیار از ۱۰                         | **۶۷** (توزیع: همه‌ی ۶۷ صنف دقیقاً ۸ معیار)                                           |
| معیارهای غایب                                | فقط `POSTGRES_JOURNEY` و `BROWSER_JOURNEY`                                            |
| صنف با تأیید PostgreSQL                      | ۰                                                                                     |
| صنف با تأیید Browser/Playwright              | ۰                                                                                     |
| وضعیت رسمی `SELLABLE`                        | ۰                                                                                     |
| تازگی شاهد                                   | شاهد روی `98a2520` است و هنوز stale؛ پس از `f28003e2` فقط ۲ سند در working tree مانده |
| endpointهای آفلاین                           | ۶۷۹ = ۲۰۹ available + ۴۵۰ online-required + ۲۰ not-supported                          |

**نکته‌ی مهم:** عددهای ۱۹۱ / ۳۱۰ / ۱۵ که در گزارش‌های قبلی به‌عنوان آفلاین نقل شده‌اند، آفلاین نیستند؛ ۱۹۱ تعداد routeهای نوشتنیِ دارای `requireCapability` در `WRITE-ROUTE-AUTHORIZATION.md` است. تنها منبع آفلاین، `docs/industries/OFFLINE-WORKFLOW-MATRIX.md` است که از `offline-endpoint-matrix.ts` تولید می‌شود. این دو سنجه نباید با هم مقایسه شوند.

**نتیجه‌ی ساختاری:** شکاف رسمی فروش‌پذیری، ۶۷ پیاده‌سازی جداگانه نیست؛ **دو شاهد مشترک** است:

- `backend/src/__tests__/journey-industries-{1..4}.pg.test.ts` روی PostgreSQL واقعی (هر چهار فایل، همه‌ی ۶۷ صنف را پوشش می‌دهند)
- `apps/web/e2e/journey-industries.spec.ts` روی مرورگر واقعی (یک spec برای هر ۶۷ trade)

این یعنی وقتی این دو شاهد اجرا و روی commit ثبت شوند، هر ۶۷ صنف به‌طور هم‌زمان از ۸/۱۰ به ۱۰/۱۰ می‌رسند — مشروط به سبز بودن واقعی.

## ۲. سه لایه‌ی متفاوت که نباید قاطی شوند

| لایه            | تعریف                                                                          | عدد فعلی     |
| --------------- | ------------------------------------------------------------------------------ | ------------ |
| `SELLABLE` رسمی | ۱۰ معیار `sellable-criteria.mjs` با شاهد اجراشده روی commit                    | ۰            |
| لایه‌ی تجاری    | ۶ پایلوت / ۲۱ مشروط / ۴۰ خارج از کمپین (تصمیم فروش، نه معیار کد)               | ۶ / ۲۱ / ۴۰  |
| وضعیت قابلیت    | `EXISTING_AND_VERIFIED` / `EXISTING_BUT_INCOMPLETE` / `CONFIGURATION_REQUIRED` | ۲۸ / ۲۷ / ۱۲ |

فروش آزمایشی ۶ صنف با «SELLABLE رسمی» یکی نیست. می‌توان با شاهدِ کمتر و قرارداد محدود فروخت، اما برچسب `SELLABLE` فقط با ۱۰/۱۰ داده می‌شود.

## ۳. فازها

### P0 — تثبیت شاهد (مالک، حدود ۱۰ دقیقه)

**هدف:** خارج‌کردن شاهد از حالت stale و dirty.

**وضعیت فعلی:** مالک ۴۲۲ فایل این دور را در `f28003e2 fixed ci 20` ثبت کرد. درخت کاری الان فقط دو سند دارد: `docs/architecture/V73-PRODUCTION-READINESS.md` (modified) و همین سند (untracked).

1. همین دو سند را commit کنید (بدون amend) تا درخت کاملاً تمیز شود.
2. روی همان commit تمیز: `node scripts/industry/run-acceptance.mjs`
3. commit کردن `docs/architecture/industry/acceptance-results.json` و اسناد generated.

**معیار خروج:** `acceptance-results.json` با `commit === HEAD` و `worktreeDirty === false`.

**نکته‌ی ترتیب:** runner قبل از نوشتن خروجی خودش `git status --porcelain` می‌گیرد؛ اگر حتی یک فایل modified باشد، `worktreeDirty: true` ثبت می‌شود و همه‌ی صنوف `EVIDENCE_NOT_ON_COMMITTED_TREE` می‌گیرند. پس commit باید _قبل_ از اجرا انجام شود، نه بعد از آن.

**وضعیت:** فقط مالک می‌تواند؛ عامل مجاز به commit نیست. تا این فاز انجام نشود، حتی ۸ معیار موجود هم در گزارش رسمی «stale» می‌مانند.

### P1 — شاهد PostgreSQL (BLOCKED_EXTERNAL)

**هدف:** اجرای ۴ فایل journey روی PostgreSQL واقعی برای هر ۶۷ صنف.

**مانع دقیق اندازه‌گیری‌شده:** بسته‌ی `@embedded-postgres/windows-x64` در `.p` نصب است اما فقط DLL دارد؛ `initdb.exe`, `postgres.exe`, `pg_ctl.exe` وجود ندارند (حذف‌شده توسط antivirus). `PGLITE_DIR` هم set نیست و `@electric-sql/pglite` روی ماشین نیست. Docker و WSL نصب نیستند.

**راه‌حل‌های مجاز برای مالک (به ترتیب کم‌ریسک):**

1. بازگردانی همان سه EXE از قرنطینه‌ی antivirus یا نصب مجدد بسته‌ی native (بدون تغییر تنظیمات antivirus توسط عامل).
2. نصب PGlite در یک پوشه و set کردن `PGLITE_DIR` (مسیر باید `node_modules/@electric-sql/pglite` داشته باشد).
3. نصب PostgreSQL 17 محلی؛ سپس استفاده از همان باینری‌ها در مسیر native بسته.

**دستور پس از رفع مانع:**

```bash
node scripts/industry/run-acceptance.mjs --postgres
```

**معیار خروج:** هر ۴ فایل `journey-industries-*.pg.test.ts` با status `passed` و صفر `skipped`.

### P2 — شاهد Browser (وابسته به P1)

**هدف:** اجرای `apps/web/e2e/journey-industries.spec.ts` برای هر ۶۷ trade.

**وضعیت محیط:** `@playwright/test 1.62.1` از `apps/web` resolve می‌شود؛ Chromium (build 1234/1248) نصب است؛ `playwright.journey.config.ts` و `journey-server.ts` موجودند. تنها وابستگی، PostgreSQL واقعی برای journey backend است.

**دستور:**

```bash
node scripts/industry/run-acceptance.mjs --browser
```

**معیار خروج:** spec با صفر skip و همه‌ی attemptها `passed`.

### P3 — بازتولید وضعیت رسمی

```bash
node scripts/industry/generate-sellable.mjs
node scripts/industry/generate-coverage-table.mjs
node scripts/industry/generate-industry-diff.mjs
```

**معیار خروج:** `sellable-industries.json` با `postgresEvidence` و `browserEvidence` > ۰ و `SELLABLE` برابر تعداد صنوفی که واقعاً سبز شده‌اند؛ سپس commit شاهدها.

### P4 — گیت تجاری ۶ صنف پایلوت

برای هر صنف، پیش از دریافت پول، این چک‌لیست روی نسخه‌ی قابل عرضه اجرا می‌شود:

- ثبت‌نام → workspace → انتخاب همان صنف → اولین کالا → اولین فروش نقدی
- یک فروش نسیه + دریافت پرداخت + گزارش مانده
- یک برگشت کالا و بازگشت موجودی
- گزارش سود با حالت «نامشخص» درست
- قطع اینترنت → فروش آفلاین → همگام‌سازی بدون گم‌شدن داده
- بازیابی از پشتیبان

| صنف              | محدودیتی که نباید وعده داده شود      |
| ---------------- | ------------------------------------ |
| `grocery`        | گردش کامل بچ/انقضا                   |
| `fruitVegetable` | گردش کامل بچ/انقضا                   |
| `nuts`           | —                                    |
| `fabric`         | برش رول و محاسبه‌ی متری پیچیده       |
| `hardware`       | قیمت‌گذاری پله‌ای (`tiered_pricing`) |
| `stationery`     | —                                    |

> **به‌روزرسانی پس از رجیستری `d1b2bd21`:** فقط `nuts` و `stationery` هیچ مانع قابلیت ثبت‌شده‌ای
> ندارند. `fruitVegetable` و `hardware` در این رجیستری مانع پیدا کردند و `grocery` و `fabric` از قبل
> مشروط بودند. «بدون مانع ثبت‌شده» هم به معنی `SELLABLE` نیست؛ `sellable-industries.json` هنوز
> `SELLABLE=0` است.

**معیار خروج:** برای هر ۶ صنف یک فروش واقعی + برگشت + پرداخت + گزارش سود + سناریوی آفلاین اجرا و امضا شود.

### P5 — ۲۱ صنف مشروط: گیت قابلیت

هر صنف فقط وقتی از «مشروط» خارج می‌شود که قابلیت مانعش از `partial/planned` به `available` برسد و journey خودش سبز شود:

| قابلیت مانع                             | صنوفی که با آن قفل‌اند                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `variants`                              | پوشاک، کفش، موبایل، کامپیوتر، قطعات، الکترونیک، لوازم خانگی، رنگ، فرش، اسباب‌بازی، مبل |
| `serialized_items` + `warranty_claims`  | موبایل، کامپیوتر، الکترونیک، لوازم خانگی، ساعت، عینک                                   |
| `batch_expiry`                          | داروخانه، کلینیک، خواروبار، لبنیات، قصابی، عطاری                                       |
| `gold_purity` + `making_charges`        | طلا و جواهر، صرافی                                                                     |
| `package_credits`                       | آموزشگاه، کورس                                                                         |
| `resource_capacity`                     | آرایشگاه، سالن زیبایی                                                                  |
| `work_queue_sla`                        | مکانیکی، تعمیرات، خدمات کامپیوتری                                                      |
| `recipe_bom` + `table_service`          | رستوران، کافه، نانوایی                                                                 |
| `project_costing` + `timesheet_billing` | پیمانکاری، مشاوره، چاپ، عکاسی                                                          |
| `delivery_pod` + `fleet_dispatch`       | باربری، مسافربری، پیک، ترانسپورت                                                       |
| `asset_rental`                          | املاک، اجاره                                                                           |
| `livestock_register`                    | دامداری                                                                                |
| `crop_cycle`                            | زراعت، تخم و کود                                                                       |
| `room_nights`                           | اقامت/تالار (در صورت ورود به دامنه)                                                    |

**معیار خروج هر ردیف:** قابلیت `available` + تست journey همان خانواده + خروج از فهرست مشروط در `generate-sellable`.

### P6 — ۴۰ صنف خارج از کمپین

قاعده‌ی ارتقا (بدون استثنا):

1. قابلیت مسدودکننده به `available` برسد (کد + تست + شاهد).
2. صنف در `INDUSTRY_ACCEPTANCE_TESTS` فایل journey داشته باشد.
3. journey روی PostgreSQL و مرورگر سبز شود.
4. فقط پس از ۱–۳ وارد فهرست فروش شود.

**کار در این فاز، توسعه‌ی قابلیت است، نه نوشتن بروشور.**

### P7 — یکسان‌سازی اسناد و پایداری

- تنها منبع عدد آفلاین: `OFFLINE-WORKFLOW-MATRIX.md`؛ عددهای ۱۹۱/۳۱۰/۱۵ از این سند حذف/تفکیک شوند.
- `generate-sellable.mjs` و `generate-coverage-table.mjs` پس از هر تغییر رجیستری اجرا شوند (با `.prettierignore` فعلی، drift تکرار نمی‌شود).
- شاهد عملکرد: زمان اجرای ۴ فایل PG و spec مرورگر ثبت شود؛ بهینه‌سازی فقط با before/after.

## ۴. ترتیب و وابستگی

```text
P0 (مالک: commit + acceptance)
   ↓
P1 (مالک: PG) ──→ P2 (مرورگر) ──→ P3 (SELLABLE)
   ↓
P4 (۶ پایلوت: فروش واقعی)
   ↓
P5 (۲۱ مشروط: تکمیل قابلیت‌ها)
   ↓
P6 (۴۰ صنف: قابلیت‌محور)
   ↓
P7 (اسناد و پایداری، موازی با همه)
```

P0 و P7 همین حالا قابل انجام‌اند. P1/P2 فقط با محیط مالک. P4–P6 کار توسعه‌ی واقعی است و باید قابلیت‌به‌قابلیت پیش برود.

## ۵. کارهای انجام‌شده در همین دور (شاهد)

| کار                        | نتیجه                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/validation`      | ۹۱ فایل، **۱۱۲۴ تست سبز**                                                                                                            |
| `packages/api`             | ۴۴ فایل، **۳۲۰ تست سبز**                                                                                                             |
| `backend` (project `unit`) | ۴۶۳ فایل، **۵۸۲۵/۵۸۲۶** — یک timeout ۵ ثانیه‌ای در `referral-programme.test.ts` که در اجرای تک‌فایل **۲۹/۲۹ سبز** شد (flake، نه نقص) |
| `packages/ui`              | ۲۳۳ فایل (۲۳۲ passed، ۱ skipped)، **۲۸۷۴ passed، ۲ skipped**                                                                         |
| `packages/local-engine`    | ۹۰ فایل، **۵۸۴/۵۸۶** — دو timeout زیر بار هم‌زمانی؛ هر دو فایل تنها **۸/۸ سبز** شدند (flake)                                         |
| `tsc --noEmit`             | backend، api، ui، web هر چهار **EXIT=0**                                                                                             |
| گاردهای generated          | registry/sellable/capability/competitor **۳۳/۳۳**، واژگان **۲۰/۲۰**                                                                  |
| PostgreSQL                 | **BLOCKED** — هیچ `initdb.exe`/`postgres.exe` در Program Files، Program Files (x86)، ProgramData، Programs، tools و scoop نیست       |
| Browser                    | **BLOCKED** — Playwright و Chromium موجود، ولی journey به PostgreSQL واقعی وابسته است                                                |

## ۶. تصمیم‌های لازم از مالک

1. کدام روش P1 (بازگردانی EXE / PGlite / PostgreSQL محلی) را مجاز می‌دانید؟
2. آیا شاهد مرورگر باید روی همین ماشین اجرا شود یا CI؟
3. تأیید فهرست ۶/۲۱/۴۰ به‌عنوان لایه‌ی تجاری (نه معیار `SELLABLE`).
4. اولویت P5: کدام قابلیت اول؟ پیشنهاد: `variants` (بیشترین تعداد صنف) سپس `batch_expiry`.

## ۷. معیار پایان کل برنامه

- ۶۷/۶۷ صنف `SELLABLE` با شاهد PG و مرورگر روی commit تمیز؛ یا
- فهرست صریح صنوفی که با دلیل تجاری به‌صورت `EXCLUDED_BY_DECISION` خارج شده‌اند.
- صفر عدد stale در اسناد generated.
- صفر صنف با «۸/۱۰» که در بازاریابی «آماده» نامیده شود.
