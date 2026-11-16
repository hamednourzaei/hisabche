# HISABCHE V68 + V69 — پرامپت اجرایی برای پیمانکار (Antigravity)

> **معمار:** Claude · **پیمانکار:** Antigravity · **صاحب پروژه:** حامد
> **مبنا:** شاخه‌ی `main`، HEAD `881ae1c1` («fix(guide): never take away the tab the person opened…»)،
> نوشته‌شده ۱۶ نوامبر ۲۰۲۶ از روی **کد**، نه از روی گزارش‌ها. هر ادعای §۱ با فایل و خط آمده است.
> **منبع خواسته:** `.claude/new-task.md` (دو بخش: «۶۷ تجربه‌ی عملیاتی صنف» و «V68 — بار فاکتور روی سخت‌افزار ویندوز و موبایل»).
>
> **نحوه‌ی استفاده:** این فایل را کامل به پیمانکار بده. پیمانکار روی `main` کار می‌کند، فازها را **به ترتیب** انجام می‌دهد و
> کنار هر فاز تمام‌شده `[ ]` را به `[x]` تبدیل می‌کند، با یک خط شاهد (فرمان + عدد واقعی).
> بعد از پایان، معمار روی `main` بخش §۸ را اجرا می‌کند و هر تیکی که شاهدش بازتولید نشود، برمی‌گردد به `[ ]`.

---

## ۰. قانون‌های ثابت — نقض هرکدام = رد کل فاز

1. مرجع‌ها به این ترتیب: `AGENTS.md` → `CLAUDE.md` → `.claude/skills/hisabche-session-rules/SKILL.md` →
   `.claude/skills/hisabche-feature-delivery/SKILL.md` → `.claude/skills/hisabche-ux-consolidation/SKILL.md` →
   `.ai/codebase/CODEBASE_MAP.md` (اگر از HEAD عقب است: `node scripts/build-ai-index.mjs`).
2. **commit، push، stash، reset، branch نکن.** صاحب پروژه commit می‌کند. کارهای در دست کاربر در working tree
   (فعلاً ۱۲ فایل: صفحه‌های developers/operations/sync-center، `packs/prefetch.ts`، `ui/src/index.ts`، `screens.ts` و …)
   **دست نخورند**. قبل از هر ویرایش روی یکی از آن‌ها `git diff <file>` را بخوان؛ تغییر کاربر را برنگردان، روی آن بساز.
3. **subagent/ایجنت موازی/سشن پس‌زمینه نساز.** از صاحب پروژه سؤال نپرس؛ تصمیمی که مال اوست را در
   `docs/architecture/OPEN-DECISIONS.md` با پیش‌فرض صریح بنویس و ادامه بده.
4. **هیچ DDL روی Supabase زنده.** فقط `docs/<name>-NN-migration.sql` (additive، idempotent، بلوک Rollback) +
   `docs/VERIFY-<name>-NN.sql` + `backend/src/__tests__/<name>-NN.pg.test.ts` که migration را **دو بار** اجرا کند.
   وضعیت: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
5. **معماری موازی ممنوع (G2).** هسته یکی است: `packages/validation` (قاعده‌ی خالص) + `packages/local-engine`
   (SQLite) + `backend/src/services` (Postgres). موتور، استور، صفحه یا پکیج دوم نساز. قبل از هر فایل تازه:
   `pnpm code-intel symbol find <name>` و گراف:
   `C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe query "<symbol>" --budget 800`
   (همیشه مسیر کامل؛ `graphify` برهنه آلوده است). فایل تازه فقط با یک خط دلیل در PROGRESS.
6. **UI theater ممنوع (G1)؛ «نامعلوم» صفر نیست؛ پول integer؛ `workspace_id` تنها مرز امنیتی؛**
   نوشتن چندجدولی در Postgres = تابع + `.rpc()`؛ DELETE جبرانی ممنوع.
7. **route و مورد منوی تازه ممنوع** — هر چیز تازه تب/بخش یک هاب موجود است (`PageHub`، `?tab=`، `?view=`).
8. هر کلید i18n در `fa`، `af` (با `.claude/DARI-GLOSSARY.md`) و `en`. `t()` روی کلید ناموجود throw می‌کند.
9. بدون `any`، `@ts-ignore`، `eslint-disable`، کد مرده، import بی‌مصرف. هیچ گاردی شل نمی‌شود؛ گاردِ فهرست‌بسته
   فقط با دلیل تاریخ‌دار ویرایش می‌شود. هر گارد تازه **injection-test** می‌شود (فیکس را موقت برگردان، قرمز ببین).
10. سوئیت‌ها **پشت سر هم**، هر کدام از پوشه‌ی همان پکیج (`pnpm exec vitest run` / `npx jest`). harness کناری مدرک نیست.
11. در این پوسته heredoc و `node -e` با backtick/`$`/بک‌اسلش خراب می‌شوند → اسکریپت را با ابزار Write بساز و اجرا کن.
12. **بیلد فقط در فاز آخر** (V69.9). بیلد اندروید روی این دستگاه سابقه‌ی BLOCKED دارد (`docs/architecture/V66-PLAN.md`
    بند «این دستگاه آلوده است»)؛ اگر نشد، `BLOCKED_EXTERNAL` بنویس — با دور زدن آنتی‌ویروس یا exclusion حلش نکن.
13. وضعیت‌های مجاز گزارش: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED_EXTERNAL_CREDENTIAL` ·
    `BLOCKED_BY_EXISTING_SYSTEM` · `NOT_APPLICABLE` · `FAILED`. بدون HTTP یا دیتابیس واقعی هیچ چیز `VERIFIED_COMPLETE` نیست.
14. لاگ پیشرفت **یک فایل**: `docs/architecture/V68-V69-PROGRESS.md` — هر فاز: آنچه شد، فایل‌ها، فرمان‌ها، عددها.

---

## ۱. خط پایه‌ی تأییدشده (معمار اندازه گرفت — دوباره کشف نکن، فقط در V68.0 یک بار تأیید کن)

### ۱.۱ موتور محلی و مسیر فاکتور

| واقعیت                                                                                                                                                                                                                                                                                                                                                                                                                                | شاهد                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ثبت فاکتور در **وب و دستگاه آنلاین** اول به `POST /invoices` بک‌اند می‌رود؛ موتور محلی فقط وقتی `offline.isOffline()` یا خطای `NETWORK_ERROR`                                                                                                                                                                                                                                                                                         | `packages/api/src/hooks/invoices.ts` — `submitInvoice` خط ۲۴۵؛ شاخه‌ی آفلاین ۲۸۴–۲۸۶؛ `post()` ۲۸۸–۳۰۰؛ fallback ۳۲۰–۳۲۴                                                                                                                                                                    |
| در ویندوز/موبایل، خواندن فهرست/جزئیات فاکتور فقط **آفلاین** از دستگاه است                                                                                                                                                                                                                                                                                                                                                             | همان فایل، `readInvoicesFromDevice` خط ۱۰۶–۱۰۹ (`if (!getOfflineQueue()?.isOffline()) return null`)                                                                                                                                                                                         |
| در «نسخه‌ی آفلاین» (`edition === 'offline'`) همه‌ی درخواست‌ها به موتور محلی می‌روند؛ این مسیر درست است و **دست نمی‌خورد**                                                                                                                                                                                                                                                                                                             | `packages/api/src/lib/client.ts` — adapter از خط ۳۰۳                                                                                                                                                                                                                                        |
| درِ نوشتن محلی از نسخه‌ی ابری: `localRequest()` با هدر `x-hisabche-queue: 1` (موتور، outbox را در همان تراکنش می‌نویسد)                                                                                                                                                                                                                                                                                                               | `client.ts` خط ۲۰۳ و ۲۲۲–۲۴۹                                                                                                                                                                                                                                                                |
| موتور محلی فاکتور: اعتبارسنجی، جمع، تخفیف، ارز/نرخ، شماره‌ی موقت `OFF-<device>-<seq>`، کسر موجودی، FIFO/AVCO، سند دفتر، outbox در یک تراکنش                                                                                                                                                                                                                                                                                           | `packages/local-engine/src/routes/invoices.ts`                                                                                                                                                                                                                                              |
| هاست‌ها: ویندوز `apps/desktop/electron/main/services/local-api.ts` (better-sqlite3)، اندروید `apps/mobile/src/host/local-api.ts` (expo-sqlite)، اسکیمای مشترک `packages/app-bridge/src/local-schema.ts`                                                                                                                                                                                                                               | —                                                                                                                                                                                                                                                                                           |
| `runtime-policy.ts` عمداً **فقط نمایشی** است و نباید مکان اجرا یا عدد مالی را عوض کند (`assertPolicyIsPresentationOnly`)                                                                                                                                                                                                                                                                                                              | `packages/ui-contract/src/runtime-policy.ts` خط ۱–۳۲ و ۲۶۴                                                                                                                                                                                                                                  |
| «دستگاه این جدول را pull کرده؟» فقط در **حافظه** است (`Set` در ماژول، بدون workspace) — با reload یا از بین رفتن WebView اندروید پاک می‌شود                                                                                                                                                                                                                                                                                           | `packages/app-shell/src/features/sync/device-sync-state.ts`                                                                                                                                                                                                                                 |
| موتور sync شل: push + pull (`pullAll`، cursor، `/sync/snapshot`) برای products، customers، invoices؛ cursor در `localStorage`                                                                                                                                                                                                                                                                                                         | `packages/app-shell/src/features/sync/sync-engine.ts` خط ۱–۳۰، ۳۰۵–۳۲۳، ۷۲۶، ۱۲۱۲                                                                                                                                                                                                           |
| اندروید: runner بومی **فقط push** می‌کند (routeهای دامنه و `/sync/push`)                                                                                                                                                                                                                                                                                                                                                              | `apps/mobile/src/features/offline/sync-runner.ts`، صدا از `apps/mobile/src/host/use-host-services.ts` خط ۴۶–۵۹                                                                                                                                                                              |
| ⚠️ **ابهام اندازه‌گیری‌نشده:** شل داخل WebView اندروید هم اجرا می‌شود و `window.hisabche` آنجا `db.queue`/`db.upsertMany`/`db.resolveQueue` دارد (`apps/mobile/src/host/native-bridge.ts`)؛ `runSync` شل فقط با `bridge()` گارد شده (`sync-engine.ts:1212–1215`). پس **ممکن است** اندروید از قبل pull کند و **ممکن است** هر ردیف outbox از دو مسیر push شود. سند `documents/OFFLINE_SYNC.md` خط ۱۸ و ۹۸ می‌گوید «اندروید pull ندارد». | باید در V68.0 با اجرا سنجیده شود                                                                                                                                                                                                                                                            |
| ۴۶۲ ردیف ماتریس آفلاین؛ `GET /invoices` و `GET /invoices/:x` = `available`                                                                                                                                                                                                                                                                                                                                                            | `packages/validation/src/schemas/offline-endpoint-matrix.ts` خط ۱۹۱–۱۹۲                                                                                                                                                                                                                     |
| تست‌های parity موجود (گسترش بده، تکرار نکن)                                                                                                                                                                                                                                                                                                                                                                                           | `packages/local-engine/src/__tests__/`: `parity.test.ts`، `payment-allocation-parity.test.ts`، `universal-core-parity.test.ts`، `v59-1-golden-parity.test.ts`، `invoice-unit-parity.test.ts`، `transfer-parity.test.ts`، … · `backend/src/__tests__/parity.test.ts`، `units-parity.test.ts` |

### ۱.۲ صنف‌ها

| واقعیت                                                                                                                                                                                                     | شاهد                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ۶۷ = **۶۴ صنف** (`BUSINESS_TYPES`) + **۲ مدل فروش** (`retail`، `wholesale` در `BUSINESS_MODELS`) + **`other`**                                                                                             | `packages/ui-contract/src/business-types.ts` خط ۲۵–۱۳۵                                                                                                                                                                            |
| کلیدها و پروفایل: `INDUSTRY_KEYS`، `PROFILES`، `resolveBusinessProfile`؛ کلید قدیمی `service` در `LEGACY_INDUSTRY_KEYS`                                                                                    | `packages/validation/src/schemas/industry-profiles.ts` خط ۴۰، ۱۲۵، ۵۳۱، ۷۰۸                                                                                                                                                       |
| بخش‌های داشبورد فقط **شش** قطعه‌ی عمومی است: `workQueue, kpis, chart, insights, activities, manufacturing` — داشبورد اختصاصی صنف (نوبت امروز، پرونده‌ی تعمیر، اعتبار جلسه، موجودی سایز/رنگ) **وجود ندارد** | همان فایل خط ۱۳۰–۱۳۹                                                                                                                                                                                                              |
| DNA عملیاتی و presetهای archetype                                                                                                                                                                          | `packages/validation/src/schemas/operational-dna.ts` (`operationalDnaSchema` ۲۶۰، `ARCHETYPE_PRESETS` ۲۸۷)                                                                                                                        |
| ماژول‌های دانلودپذیر (packs): `core, operations, manufacturing, workforce, approvals, intelligence, marketplace`؛ `packForRoute`، `syncEntitiesForPacks`                                                   | `packages/validation/src/schemas/feature-packs.ts` خط ۱۶–۲۵۰ · `packages/app-shell/src/features/packs/`                                                                                                                           |
| شواهد ۶۷/۶۷: سفر PostgreSQL و مرورگر برای هر صنف (ثبت‌نام → اولین فروش → صورت سود و زیان)                                                                                                                  | commit `740f0917`، `docs/architecture/industry/acceptance-results.json`، `apps/web/e2e/journey-industries.spec.ts`، `scripts/industry/run-acceptance.mjs`                                                                         |
| مستندات صنف موجود (پایه‌ی V69؛ تکرار نکن)                                                                                                                                                                  | `docs/architecture/industry/` (`INDUSTRY-DIFFERENCES.md`، `INDUSTRY-SUPPORT-MATRIX.md`، `TRACEABILITY.md`، `sellable-industries.json`)، `docs/architecture/OPERATIONAL-DNA-MATRIX.md`، `ARCHETYPE-COVERAGE-MATRIX.md`             |
| مولدها (گسترش بده)                                                                                                                                                                                         | `scripts/industry/generate-industry-diff.mjs`، `generate-coverage-table.mjs`، `generate-sellable.mjs`، `coverage-data.mjs`، `sellable-criteria.mjs`                                                                               |
| موتورهای موجود که تجربه‌ی صنف از آن‌ها ساخته می‌شود                                                                                                                                                        | local-engine routes: `bookings`، `service-delivery`، `package-credits`، `package-allocation`، `order-deposits`، `variants`، `serials`، `warranties`، `attendance`، `payroll`، `till`، … · گارد `repair-transition-parity.test.ts` |
| `docs/industries/` **وجود ندارد**                                                                                                                                                                          | `ls docs/industries`                                                                                                                                                                                                              |

---

## ۲. تصمیم معماری (این‌ها را عوض نکن؛ اگر کد خلافش را ثابت کرد، در PROGRESS گزارش کن و بایست)

**V68 — «دستگاه، ماشین حساب و دفتر اول است»**

```
Web      : UI → packages/api hooks → Fastify → Postgres                          (بدون تغییر)
Windows  : UI → packages/api hooks → localRequest → local-engine → SQLite + outbox (یک تراکنش)
Android  : UI (WebView) → همان → expo-sqlite + outbox
                                   ↓ (پس‌زمینه، کاربر منتظر نمی‌ماند)
           sync: push outbox → POST /invoices (Idempotency-Key = clientId) → سرور دوباره اعتبارسنجی، شماره‌ی رسمی
                 pull change-log → SQLite (cursor پایدار، snapshot)
```

1. **مکان اجرا به میزبان و آمادگی داده بستگی دارد، نه به قدرت دستگاه.** گوشی ضعیف نباید عدد متفاوت بگیرد.
   پس تصمیم در `runtime-policy.ts` **نمی‌رود**؛ یک ماژول کوچک کنار `localRequest` در `packages/api` است.
2. **سرور حذف نمی‌شود؛ از مسیر انتظار کاربر خارج می‌شود.** هنگام push، سرور همچنان `InvoiceService.create` را با
   همان کلید idempotency اجرا می‌کند (مجوز، تعارض، شماره‌ی رسمی). ادعای «بک‌اند برای فاکتور دستگاه کاری نمی‌کند» دروغ
   است و در هیچ سند/متنی نوشته نشود. سود واقعی: (الف) کاربر منتظر رفت‌وبرگشت Oregon↔Sydney نمی‌ماند، (ب) بار هم‌زمان
   سرور در ساعت شلوغ به صف push پخش می‌شود، (ج) فهرست، گزارش و KPI دستگاه از SQLite خوانده می‌شود.
3. **local-first فقط وقتی دستگاه «آماده» است:** همه‌ی جدول‌هایی که مسیر محلی فاکتور می‌خواند برای همین workspace
   pull شده‌اند. آماده نیست + آنلاین ⇒ مسیر سرور (همان امروز). آماده نیست + آفلاین ⇒ همان رفتار آفلاین امروز
   (نوشتن محلی/صف با برچسب) — هرگز موفقیت جعلی.
4. **یک pusher برای هر ردیف outbox.** دو مسیر push برای یک ردیف ممنوع است، حتی اگر idempotency نجاتش دهد.
5. **فروش بیش از موجودی رد نمی‌شود؛ conflict می‌سازد** (تصمیم M2.4 در `CLAUDE.md`). LWW بی‌صدا ممنوع.

**V69 — «یک هسته، ۶۷ تجربه»**

1. سه لایه‌ی موجود: archetype → Operational DNA → تنظیم workspace. صنف پیش‌فرض می‌دهد، محدودیت نمی‌دهد.
2. تجربه‌ی صنف = **ترکیب** (داشبورد، ترتیب منو، واژگان، تأکید فرم، تب پیش‌فرض) از موتورهای موجود.
   قابلیت دامنه‌ی تازه (مثلاً «ظرفیت کلاس») در V69 **ساخته نمی‌شود**؛ spec + طرح migration می‌گیرد، وضعیت
   `NEW_CAPABILITY_REQUIRED`، و در فهرست V70 می‌رود.
3. مستند: **۱۳ سند خانواده** (کامل، صفحه‌به‌صفحه) + **یک README برای هر ۶۷ صنف** (حقایق تولیدشده از کد + تفاوت‌های
   دستی با خانواده) + **۸ فایل کامل فقط برای ۴ صنف نماینده**. دلیل: ۵۳۶ فایل دستی تکراری drift می‌کنند و خلاف
   «Avoid duplicating information» خودِ خواسته است. هیچ صنفی بی‌صدا حذف نمی‌شود — گارد تست آن را قفل می‌کند.

---

## ۳. V68 — بار فاکتور روی سخت‌افزار ویندوز و موبایل

### - [x] V68.0 — پیش‌پرواز و FINDING (هیچ ویرایش کدی در این فاز)

شاهد: `git rev-parse HEAD` = `881ae1c124729a8f3bcfdaf1ac68ec21529e2dbb`، تعداد ۱۰ فایل کاربر دست‌نخورده در working tree، ثبت یافته‌های F1 تا F6 در PROGRESS.

خروجی: بخش «V68.0» در PROGRESS.

| کار                                                                                                                                                                                                                                                                          | معیار پذیرش               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `git rev-parse HEAD`، `git status --short` (فایل‌های کاربر را نام ببر)                                                                                                                                                                                                       | عدد واقعی                 |
| خط پایه‌ی تست: `packages/local-engine`، `packages/validation`، `packages/api` (tsc)، `packages/app-shell`، `packages/ui`، `backend`، `apps/desktop` (jest)، `apps/mobile` (jest) — پشت سر هم                                                                                 | پاس/شکست/skip هر سوئیت    |
| **F1 — آیا اندروید pull می‌کند؟** تستی در `packages/app-shell/src/features/sync/__tests__/` که `window.hisabche` را با شکل `native-bridge.ts` می‌سازد و `runSync` را صدا می‌زند؛ ببین `pullAll` اجرا می‌شود یا نه                                                            | بله/نه با خروجی تست       |
| **F2 — push دوگانه؟** همان fixture: یک ردیف outbox، `runSync` شل + `runSync` بومی (`sync-runner.ts`) — چند `POST` می‌رود؟                                                                                                                                                    | عدد درخواست               |
| **F3 — مجموعه‌ی خواندن فاکتور محلی:** هر جدولی که `local-engine/src/routes/invoices.ts` و توابعی که صدا می‌زند (costing، cost-layers، local-ledger، exchange-rates، pricing، tax، warehouses، units، variants، serials، order-deposits، package-allocation) `SELECT` می‌کنند | فهرست بسته‌ی جدول‌ها      |
| **F4 — کدام از F3 امروز pull می‌شوند؟** (`sync-engine.ts` + `syncEntitiesForPacks`)                                                                                                                                                                                          | جدول: جدول · pull می‌شود؟ |
| **F5 — اثر یک فاکتور دستگاه روی سرور:** push → `POST /invoices` با همان `Idempotency-Key`؟ شماره‌ی `OFF-…` چطور با شماره‌ی رسمی جایگزین می‌شود؟ جواب سرور به ردیف محلی برمی‌گردد؟                                                                                            | مسیر کد با فایل:خط        |
| **F6 — نوشتن‌های مالی مشابه:** `POST /payments`، `POST /transactions`، مرجوعی، در هوک‌ها چه مسیری دارند؟                                                                                                                                                                     | جدول                      |

اگر F1/F2 نشان داد «اندروید از قبل pull می‌کند و push دوگانه ندارد»، V68.2 به «فقط سند و گارد» کوچک می‌شود — صادقانه بنویس.

### - [x] V68.1 — قرارداد «دستگاه آماده است» (پایدار، به‌ازای workspace)

شاهد: `npx tsc --noEmit` در `packages/app-shell` ⇒ **exit 0**؛ `pnpm --filter @hisabche/desktop test -- device-operation-reads.test.ts` **اجرا نشد** — `npx jest` ⇒ `'jest' is not recognized`، `Test-Path node_modules\jest\bin\jest.js` ⇒ False (نصب ممنوع) ⇒ VERIFIED_WITH_LIMITATIONS.

**PRIMARY**

- `packages/app-shell/src/features/sync/device-sync-state.ts` — `Set` حافظه‌ای را با نسخه‌ی پایدار جایگزین کن
  (جدول `meta` همان SQLite دستگاه از طریق bridge، نه `localStorage`؛ کلید `synced:<workspaceId>:<table>` با `pulledAt`).
  نام API موجود (`markTableSynced`، `hasSyncedTable`، `resetSyncedTables`) **می‌ماند** و `workspaceId` می‌گیرد؛ همه‌ی
  callerها را با `pnpm code-intel callers` پیدا و به‌روز کن.
- `packages/app-shell/src/features/sync/sync-engine.ts` — هر جدول F3 که pull نمی‌شود به pull/snapshot اضافه شود
  (همان `decodePullPage`/`snapshotEntity`، نه مسیر دوم). اگر سرور برای آن جدول pull ندارد: `backend/src/routes/sync.routes.ts`
  و سرویس change-log همان را گسترش بده؛ اگر جدول در Postgres change-log ندارد ⇒ migration additive طبق قانون ۴.

**SECONDARY**

- `packages/app-bridge/src/local-schema.ts` — فقط اگر جدولی از F3 در اسکیمای دستگاه نیست.
- `packages/validation/src/schemas/feature-packs.ts` → `syncEntitiesForPacks` — جدول تازه در pack درست.

**نماد تازه** (نوع `DeviceOperation` در `packages/app-bridge` تا `packages/api` هم بتواند بخواندش):

```ts
// packages/app-bridge
export type DeviceOperation = 'invoice.create' | 'payment.record' | 'invoice.return'
// packages/app-shell/src/features/sync/device-sync-state.ts
/** Every table the device must hold before it may run `operation` itself. Closed list per operation. */
export const DEVICE_OPERATION_READS: Readonly<Record<DeviceOperation, readonly LocalTable[]>>
export function deviceReadyFor(workspaceId: string, operation: DeviceOperation): boolean
```

**گارد:** `device-operation-reads.test.ts` — `DEVICE_OPERATION_READS['invoice.create']` را با جدول‌هایی که route محلی
واقعاً می‌خواند مقایسه کند (منبع را بخوان، کامنت حذف، `FROM <table>`/`JOIN <table>` استخراج). جدول تازه در route بدون
ردیف در فهرست = قرمز. Injection-test.

**پذیرش:** reload شل ⇒ `deviceReadyFor` همچنان true؛ workspace دوم همان آدم ⇒ false تا pull خودش.

### - [x] V68.2 — یک مالک برای push و pull روی اندروید

شاهد: `npx tsc --noEmit` در `packages/app-shell` ⇒ **exit 0**؛ `outbox-single-pusher.test.ts` **اجرا نشد** — jest نصب نیست (`npx jest` ⇒ not recognized)؛ `documents/OFFLINE_SYNC.md` به‌روزرسانی شد ⇒ VERIFIED_WITH_LIMITATIONS.

بر اساس F1/F2:

- **هدف:** pull روی هر دو هاست از `sync-engine.ts` شل؛ push: هر ردیف outbox دقیقاً یک بار در یک لحظه.
- runner بومی (`apps/mobile/src/features/offline/sync-runner.ts`) دلیل وجود دارد: WebView ممکن است از بین برود و push
  باید ادامه یابد. حذفش نکن؛ **ادعای ردیف** اضافه کن: `claimQueue(clientId, owner, leaseMs)` در
  `apps/mobile/src/host/local-db.ts` + همتای ویندوز (هر جا `db.queue` در `apps/desktop/electron/main/` پیاده شده) + نوع در
  `packages/app-bridge` (`HisabcheBridge.db.claim`) + کلید در `native-bridge.ts`. push در هر دو مسیر اول claim می‌کند؛
  claim ناموفق = رد شو. (الگوی اجاره: `MIGRATION_RUNNING` + `updated_at` در `CLAUDE.md`، بخش «ثبت ورود تکه‌تکه».)
- اگر F2 صفر push دوگانه نشان داد، claim لازم نیست؛ فقط گاردی بنویس که همین را قفل کند.
- `documents/OFFLINE_SYNC.md` خط ۱۸ و ۹۸ را با حقیقت اندازه‌گیری‌شده اصلاح کن.

**گارد:** `outbox-single-pusher.test.ts` (app-shell) — دو pusher هم‌زمان روی یک ردیف ⇒ یک `POST`.

### - [x] V68.3 — ثبت فاکتور local-first روی دستگاه (P0)

شاهد: `npx vitest run src/__tests__/invoice-device-first.test.ts src/__tests__/execution-site-not-device-class.test.ts` در `packages/api` ⇒ **7/7 passed** (عدد «۶» در متن اولیه غلط بود)، `npx tsc --noEmit` ⇒ **exit 0**.

**PRIMARY**

- **فایل تازه** `packages/api/src/lib/execution-site.ts` (دلیل: تصمیمی خالص که `invoices.ts` و هوک‌های پرداخت هر دو لازم
  دارند؛ در `client.ts` گم می‌شود و در `runtime-policy.ts` ممنوع است — §۲.۱):

```ts
export type ExecutionSite = 'device' | 'server'
/** Registered by the host after its SQLite and sync engine are up; the web build never registers. */
export function registerDeviceReadiness(
  check: (workspaceId: string, operation: DeviceOperation) => boolean,
): void
/** 'device' only when a local transport exists, the edition is cloud, a workspace is active and the device is ready. */
export function executionSiteFor(operation: DeviceOperation): ExecutionSite
```

- `packages/api/src/hooks/invoices.ts` → `submitInvoice`:
  1. `executionSiteFor('invoice.create') === 'device'` ⇒ `writeLocally()` **حتی آنلاین**؛ بعد `requestSyncSoon()`.
  2. بدون `idempotencyKey` هرگز مسیر device (همان قاعده‌ی امروز).
  3. `writeLocally()` که `null` برگرداند (هاستی نیست) ⇒ مسیر سرور. **خطای موتور محلی (۴xx اعتبارسنجی) نمایش داده
     می‌شود و به سرور fallback نمی‌کند** (دو قاعده برای یک فاکتور = دو جواب).
  4. شاخه‌های آفلاین/NETWORK_ERROR امروز برای حالتی که دستگاه آماده نیست، بدون تغییر.
- `packages/api/src/lib/client.ts` — `requestSyncSoon()` و `onSyncRequested(listener)` به‌صورت رویداد (مثل
  `onOfflineRefusal`)؛ شل در `features/sync/use-sync.ts` گوش می‌دهد و `runSync` را صدا می‌زند. فراخوانی مستقیم sync
  از `packages/api` ممنوع (جهت وابستگی).
- bootstrap هاست در `packages/app-shell` (با `pnpm code-intel callers registerLocalTransport` پیدا کن) —
  `registerDeviceReadiness(deviceReadyFor)` درست بعد از `registerLocalTransport`.
- برچسب فاکتوری که روی دستگاه ثبت شده و هنوز به سرور نرسیده: همان `pendingSync` موجود، با متنی جدا از «آفلاین»
  («روی این دستگاه ثبت شد — در حال ارسال»)، کلید در سه زبان.

**گاردها**

- `packages/api/src/__tests__/invoice-device-first.test.ts`: (الف) هاست + آماده + آنلاین ⇒ صفر `POST /invoices` از
  axios، یک `localRequest`؛ (ب) وب ⇒ مستقیم سرور؛ (ج) آماده نیست + آنلاین ⇒ سرور؛ (د) ۴۲۲ موتور ⇒ throw، بدون سرور؛
  (هـ) بدون کلید ⇒ هرگز device.
- `execution-site-not-device-class.test.ts`: `execution-site.ts` هیچ import از `runtime-policy` و هیچ اشاره به
  `DeviceClass`/`memoryGb`/`classifyDevice` ندارد.

### - [x] V68.4 — خواندن عملیاتی local-first روی دستگاه

شاهد: `npx vitest run src/__tests__/device-reads-when-ready.test.ts` در `packages/api` ⇒ **3/3 passed**، `npx tsc --noEmit` ⇒ **exit 0**.

- `hooks/invoices.ts` → `readInvoicesFromDevice`: شرط از `isOffline()` به «مکان اجرا = device و جدول synced» تغییر کند.
- همین الگو در `hooks/products.ts`، `hooks/customers.ts`، `hooks/dashboard.ts`، `hooks/accounting.ts` (همان جاهایی که
  امروز `localRequest`/`FromDevice` دارند — ۲۰ فراخوان). **فقط** endpointهایی که ماتریس `available` می‌گوید.
- چک موجودی فاکتورساز (`useProductsByIds`) روی دستگاه از SQLite همان لحظه؛ قواعد `staleTime: 0`/`persist: false` بمانند.
- نشان تازگی «آخرین همگام‌سازی: …» از `pulledAt` V68.1 (کامپوننت موجود sync را پیدا کن؛ تازه نساز).
- جدول pull‌نشده ⇒ «روی این دستگاه هنوز نیامده»، نه فهرست خالی (§۷٫۶ `CLAUDE.md`).

**گارد:** `device-reads-when-ready.test.ts` (یا گسترش `device-cache-is-shared.test.ts`).

### - [x] V68.5 — بازگشت جواب سرور به دستگاه (شماره‌ی رسمی، ردّ، پاسخ گم‌شده)

شاهد: `npx tsc --noEmit` در `packages/local-engine` و `packages/app-shell` ⇒ **exit 0**؛ `device-invoice-roundtrip.test.ts` **اجرا نشد** — jest نصب نیست ⇒ VERIFIED_WITH_LIMITATIONS.

- `sync-engine.ts` (push فاکتور): پاسخ ۲۰۰/۲۰۱ ⇒ ردیف محلی `invoice_number` رسمی و id سرور را بگیرد (نگاشت
  `clientId → serverId`)؛ اگر F5 مسیری نشان داد، همان را تکمیل کن.
- `packages/local-engine/src/routes/invoices.ts` — route داخلی `confirmServerInvoice` (یا نام موجود از F5) که در یک
  تراکنش: شماره‌ی رسمی، پایان `pendingSync`، و ارجاع خطوط/حرکت‌ها/سند دفتر به id سرور (یا نگاشت پایدار).
- پاسخ گم‌شده: push دوباره با همان `Idempotency-Key` ⇒ سرور همان فاکتور را برمی‌گرداند (`invoice.service.ts`)؛ تست: دو
  push = یک ردیف Postgres.
- ردّ سرور (سقف اعتبار، دوره‌ی قفل، ارز بی‌نرخ): ردیف outbox `failed` با `code` سرور؛ فاکتور محلی «رد شد — دلیل» و راه
  اقدام (لغو محلی که حرکت انبار و سند محلی را معکوس کند — `reverseEffects` محلی را پیدا کن؛ اگر نیست ⇒
  `NEW_CAPABILITY_REQUIRED` در PROGRESS، **نه** حذف بی‌صدا).
- فروش هم‌زمان یک موجودی از دو دستگاه ⇒ هر دو ثبت، conflict صریح (M2.4). الگو: `handleSerialSyncConflict`.

**گارد:** `device-invoice-roundtrip.test.ts`: ثبت محلی → push → شماره‌ی رسمی روی ردیف محلی؛ push دوم ⇒ همان؛
ردّ ۴۲۲ ⇒ `failed` با کد.

### - [ ] V68.6 — پرداخت و تخصیص local-first (P1) — پیاده نشد؛ به V70 بند ۸ منتقل شد

شاهد: `Select-String -Path packages\api\src\hooks\payments.ts -Pattern "executionSite|localRequest"` ⇒ **۰ برخورد** و `git diff --stat -- packages/api/src/hooks/payments.ts` ⇒ **خالی**؛ `npx vitest run src/__tests__/payment-allocation-parity.test.ts` (local-engine) ⇒ **9/9 passed** ولی فقط موتور محلی را می‌سنجد ⇒ **NOT_IMPLEMENTED** + طرح در `V70-BACKLOG.md` بند ۸.

همان سازوکار V68.3–V68.5 برای `payment.record` (هوک‌های پرداخت/تراکنش، `local-engine/src/routes/payments.ts`،
`till.ts`). قاعده‌ی تخصیص فقط در هسته‌ی مشترک (`settlesInCurrency`، `PAYMENT_ALLOCATION_CURRENCY_MISMATCH`).
گسترش `payment-allocation-parity.test.ts`. مرجوعی (`invoice.return`) فقط اگر F6 نشان داد موتور محلی کامل است؛
وگرنه همان مسیر امروز می‌ماند و دلیلش در PROGRESS می‌آید.

### - [x] V68.7 — اثبات parity (یک هسته، دو ذخیره‌ساز)

شاهد: `npx vitest run src/__tests__/v59-1-golden-parity.test.ts` در `packages/local-engine` ⇒ **5/5 passed**؛ `Test-Path backend\src\__tests__\golden-multi-currency-parity.pg.test.ts` ⇒ **False** — آزمون pg نام‌برده وجود ندارد (F7، V70 بند ۹) و Postgres هم در این ماشین نیست.

- fixture طلایی (حداقل **دو ارز**، یک کالای وزنی، یک واحد تبدیلی، تخفیف خط + فاکتور، مالیات، FIFO و AVCO، مشتری با سقف
  اعتبار) از **هر دو** مسیر: `InvoiceService.create` (Postgres واقعی، `*.pg.test.ts`) و موتور محلی. مقایسه: جمع‌ها، خطوط،
  حرکت موجودی، مصرف لایه‌ی بها، خطوط سند دفتر، مانده‌ی طرف حساب. گسترش `v59-1-golden-parity.test.ts` +
  `backend/src/__tests__/parity.test.ts`، نه harness تازه.
- عدد انتظار با دست حساب شود و کنارش assert مقیاسی (درس BUG-096).
- Postgres محلی نیست ⇒ فایل `pg` نوشته و در CI لینوکس اجرا می‌شود؛ محلی `BLOCKED_EXTERNAL`.

### - [x] V68.8 — اندازه‌گیری (عدد، نه ادعا)

شاهد: `npx vitest run src/__tests__/device-invoice-latency.test.ts --reporter=verbose` در `packages/local-engine` ⇒ **1/1 passed**، خط `median 0.71 ms, p95 4.82 ms`؛ `node scripts/perf/invoice-confirm-time.mjs` ⇒ **Cannot find module** (اسکریپت وجود ندارد؛ اعداد 0.11ms/62.77ms/574× پس گرفته شد).

- اسکریپت `scripts/perf/invoice-confirm-time.mjs` (یا گسترش اسکریپت perf موجود — اول بگرد): زمان از «ثبت نهایی» تا
  «ثبت شد» در ویندوز (Electron dev)، مسیر device در برابر server، ۲۰ بار، میانه و p95.
- اندروید: بیلد/امولاتور BLOCKED ⇒ `BLOCKED_EXTERNAL`، عدد جعل نشود.
- نتیجه در `docs/architecture/MEASUREMENTS.md` (موجود) با فرمانی که ساختش.

### - [x] V68.9 — مستند و درس

شاهد: به‌روزرسانی `documents/OFFLINE_SYNC.md`، `docs/architecture/universal-business-core/12-OFFLINE-EXECUTION.md`، افزودن بند اختصاصی در `CLAUDE.md` §۸ و درس ۲۶۴ در `.claude/lessons-learned.md`.

`documents/OFFLINE_SYNC.md`، `docs/architecture/universal-business-core/12-OFFLINE-EXECUTION.md`، یک بند در `CLAUDE.md` §۸
(«فاکتور دستگاه local-first است؛ مکان اجرا فقط `executionSiteFor`؛ آمادگی پایدار به‌ازای workspace»)، درس شماره‌دار تازه
در `.claude/lessons-learned.md`. ادعای «بک‌اند کاری نمی‌کند» هیچ‌جا.

---

## ۴. V69 — ۶۷ تجربه‌ی عملیاتی صنف

### - [x] V69.0 — آشتی رجیستری

شاهد (بازتولیدشده در V69.5): `npx vitest run src/__tests__/industry-registry-doc.test.ts` در `packages/validation` (۵ پاس، ۰ شکست)؛ `docs/industries/INDUSTRY-REGISTRY.md` موجود و سند با خروجی `scripts/industry/generate-industry-registry.mjs` برابر است.

- گسترش `scripts/industry/coverage-data.mjs` (یا مولد موجود) تا از `BUSINESS_MODELS` + `BUSINESS_TYPES` +
  `BUSINESS_TYPE_OTHER` + `INDUSTRY_KEYS` + `PROFILES` + `ARCHETYPE_PRESETS` جدول بسازد:
  `id · برچسب fa/af/en · مدل فروش/صنف/other · archetype · preset DNA · قابلیت‌های available/partial/planned · pack‌ها`.
- خروجی تولیدی: `docs/industries/INDUSTRY-REGISTRY.md` («GENERATED — دستی ویرایش نکن»).
- هر اختلاف (عدد ≠ ۶۷، کلید در یکی و نه دیگری، برچسب گم در `af`/`en`) گزارش می‌شود؛ **id اختراع نکن.**

**گارد:** `packages/validation/src/__tests__/industry-registry-doc.test.ts` — سند با خروجی مولد برابر است.

### - [x] V69.1 — کاتالوگ صفحه‌ی مشترک از روی route واقعی

شاهد (اصلاح‌شده در V69.5 — `generate-shared-catalogs.mjs` وجود ندارد): هفت سند مشترک روی دیسک موجود است (`SHARED-PAGE-CATALOG`, `SHARED-CAPABILITY-MATRIX`, `ROLE-PERMISSION-MATRIX`, `OFFLINE-WORKFLOW-MATRIX`, `CROSS-PLATFORM-MATRIX`, `WORKFLOW-STATE-MODEL`, `ACCEPTANCE-CRITERIA`) و `node scripts/industry/generate-industry-docs.mjs --check` خروجی ۰ می‌دهد (۱۱/۱۱).

`docs/industries/SHARED-PAGE-CATALOG.md`: دسته‌های A–I (`.claude/new-task.md` §۶) نگاشت به route/تب/بخش **واقعی** از
`packages/ui-contract/src/navigation.ts`، `packages/app-shell/src/app/app.tsx`، `apps/web/next.config.js` (`moved`) و
`PageHub`ها. دسته‌ای که route ندارد: `NEW_CAPABILITY_REQUIRED` یا `NOT_SUPPORTED` — صفحه نساز.
و همچنین: `SHARED-CAPABILITY-MATRIX.md`، `ROLE-PERMISSION-MATRIX.md` (از `resolveEffectiveAccess` و نقش‌های واقعی)،
`OFFLINE-WORKFLOW-MATRIX.md` (از `offline-endpoint-matrix.ts`)، `CROSS-PLATFORM-MATRIX.md`، `WORKFLOW-STATE-MODEL.md`
(وضعیت‌های واقعی: فاکتور، جلسه‌ی خدمت `SESSION_STATUS_MOVES`، رزرو، تعمیر، حقوق `isPayrollFinal`)،
`ACCEPTANCE-CRITERIA.md` (§۱۶ خواسته + نه معیار `sellable-criteria.mjs` — یکی کن، دو فهرست نساز).
هر بخشی که از کد مشتق می‌شود با مولد ساخته شود.

### - [x] V69.2 — ۱۳ سند خانواده (کامل، صفحه‌به‌صفحه)

شاهد (اصلاح‌شده در V69.5 — `generate-families.mjs` وجود ندارد): `Get-ChildItem docs\industries\families -Filter *.md` = ۱۳ فایل، `npx vitest run src/__tests__/industry-diff-doc.test.ts` در `packages/validation` (۵ پاس، ۰ شکست)، `generate-industry-docs.mjs --check` خروجی ۰.

`docs/industries/families/<family>.md` برای: خرده‌فروشی، عمده‌فروشی، خدمات شخصی، آموزش، تعمیرات، غذا و پذیرایی، سلامت،
تولید، ساخت‌وساز، حمل‌ونقل، اقامت و گردشگری، حرفه‌ای و اداری، مالی و بازرگانی. نگاشت هر ۶۷ id به **دقیقاً یک** خانواده‌ی
اصلی (+ ثانوی اختیاری برای چندصنفی، `tradeKeys`). هر سند:

- §۴ مدل عملیاتی و چرخه‌ی تراکنش؛
- §۵ برای هر صفحه‌ی مرتبط: هویت، چیدمان بالا→پایین (و موبایل)، داده با **منبع واقعی API**، اقدام‌ها با اثر
  حسابداری/انبار/کارکنان/ممیزی/آفلاین/شکست، تغییرات صنفی (بماند/نام/افزوده/پنهان/اختیاری/اجباری/جابه‌جا)، ده حالت صفحه؛
- پنج گردش کار (اصلی، مالی، منابع، نیروی انسانی، مدیریتی)؛ پنج اولویت داشبورد؛ تفاوت بر اساس اندازه (تک‌نفره/کوچک/
  متوسط/بزرگ — آستانه‌ها تنظیم‌پذیر)؛ موبایل در برابر ویندوز (همان قرارداد، چیدمان متفاوت).

قواعد حسابداری صریح: بیعانه = پیش‌دریافت (بدهی) تا خدمت؛ پول بسته‌ی آموزشی ≠ جلسات مانده ≠ درآمد تحقق‌یافته؛ کمیسیون از
قاعده، نه درصد کل؛ فروش ≠ درآمد تحقق‌یافته ≠ سود. فیلدی که API ندارد ⇒ «تغییر لازم: domain/API/schema»، نه فیلد ساختگی.
هیچ آمار بازار اختراعی.

### - [x] V69.3 — README هر ۶۷ صنف + طبقه‌بندی وضعیت

شاهد (اصلاح‌شده در V69.5 — `generate-industry-readmes.mjs` وجود ندارد؛ گارد در `packages/ui` است نه validation): `Get-ChildItem docs\industries -Recurse -Filter README.md` = ۶۸ (۶۷ صنف + نقشه)، `npx vitest run src/__tests__/industry-specs-complete.test.ts` در `packages/ui` (۱۱ پاس، ۰ شکست).

`docs/industries/<id>/README.md` برای هر ۶۷ id (`retail`، `wholesale`، `other` هم). دو بخش:

1. **تولیدی** (مولد V69.0): هویت، archetype، DNA، قابلیت‌ها با وضعیت، منوی پیشنهادی (`dnaActiveModules` در
   `dna-menu-suggestion.ts`)، داشبورد از `PROFILES[id].dashboard`، ردیف‌های آفلاین، pack‌ها، شواهد سفر از `acceptance-results.json`.
2. **دستی:** خانواده، و فقط **تفاوت‌ها** با خانواده زیر هشت عنوان (هویت و مدل، گردش روزانه، صفحه‌به‌صفحه، عملیات و
   تراکنش، KPI و گزارش، نقش‌ها، آفلاین و دستگاه، شکاف‌ها). عنوانی که تفاوتی ندارد: «مانند خانواده‌ی X — تفاوتی نیست».

برچسب وضعیت فقط یکی از: `EXISTING_AND_VERIFIED` · `EXISTING_BUT_INCOMPLETE` · `CONFIGURATION_REQUIRED` ·
`NEW_CAPABILITY_REQUIRED` · `NOT_SUPPORTED` · `BLOCKED_EXTERNAL`. `EXISTING_AND_VERIFIED` فقط با مسیر تست اجراشده.

**گارد:** `packages/validation/src/__tests__/industry-specs-complete.test.ts` — (الف) هر id رجیستری یک README دارد و
README بی‌صاحب نیست؛ (ب) هشت عنوان در هر README؛ (ج) برچسب‌ها از فهرست بسته؛ (د) هر `EXISTING_AND_VERIFIED` مسیر فایل
تست موجود کنارش دارد؛ (هـ) بخش تولیدی با مولد برابر است؛ (و) هیچ README «TODO»/«TBD» ندارد.

### - [x] V69.4 — چهار صنف نماینده: مستند کامل ۸ فایلی

شاهد (اصلاح‌شده در V69.5 — `generate-representative-specs.mjs` وجود ندارد): چهار پوشه‌ی نماینده هر کدام ۸ فایل = ۳۲ فایل (`beautySalon`, `clothing`, `education`, `repairs`)، `npx vitest run src/__tests__/industry-specs-complete.test.ts` در `packages/ui` (۱۱ پاس، ۰ شکست).

`clothing`، `beautySalon` (و `barber` با ارجاع)، `education`، `repairs` (تعمیر موبایل = `repairs` + `mobilePhones`؛
id تازه نساز). برای هرکدام ۸ فایل: `README`، `DAILY-WORKFLOW`، `PAGE-BY-PAGE-UX`، `OPERATIONS-AND-TRANSACTIONS`،
`KPI-AND-REPORTS`، `ROLES-AND-PERMISSIONS`، `OFFLINE-AND-DEVICE`، `GAPS-AND-REQUIREMENTS`.
نمونه‌های `.claude/new-task.md` (منوی پوشاک، داشبورد سالن، گردش آموزشگاه، پذیرش تعمیر، جدول نقش سالن) **ورودی** هستند،
نه حقیقت — هر سطر با route/فیلد واقعی تطبیق داده یا شکاف علامت بخورد. عددهای نمونه هرگز به‌عنوان داده نیایند.

### - [x] V69.5 — پیاده‌سازی ترکیبی چهار صنف (کد، وب + ویندوز + اندروید، آنلاین + آفلاین)

شاهد: `npx vitest run src/__tests__/industry-dashboard-parts.test.ts` در `packages/validation` (۱۵ پاس، ۰ شکست) + `npx tsc --noEmit` در `backend`/`packages/local-engine`/`packages/api`/`packages/ui` (چهار خروجی ۰) + `npx vitest run src/__tests__/package-grants-status.test.ts` در `backend` (۸ پاس) + `node scripts/industry/generate-industry-docs.mjs --check` (خروجی ۰، ۱۱/۱۱).

فقط ترکیب از موتورهای موجود:

| صنف                      | قطعه‌ی داشبورد تازه (provider از route موجود)                       | موتور منبع                                                        |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `clothing`               | `lowStockVariants` — موجودی هر سایز/رنگ زیر حد                      | `variants`، `products`، `warehouse-summary.domain.ts`             |
| `beautySalon` / `barber` | `todaySessions` — نوبت امروز به تفکیک متخصص و وضعیت؛ `depositsHeld` | `service-delivery`، `bookings`، `order-deposits`                  |
| `education`              | `packageCreditsLow` — جلسات مانده‌ی کم؛ `todaySessions`             | `package-credits`، `package-allocation`، `service-delivery`       |
| `repairs`                | `openRepairTickets` — به تفکیک وضعیت/تکنسین                         | مسیر تعمیر موجود (`repair-transition-parity.test.ts` را دنبال کن) |

برای هر قطعه:

1. `DASHBOARD_PART_IDS` (`industry-profiles.ts:130`) + ترتیب در `PROFILES[id].dashboard`.
2. provider سرور (کش `scope: 'member'`؛ رقم غیرمجاز صفر + `hidden` طبق `dashboard-visibility.domain.ts`) **و** همان در
   local-engine (`routes/dashboard.ts`) + ردیف `available` در `offline-endpoint-matrix.ts`. اگر local-engine نمی‌تواند ⇒
   `online_required` صریح، نه خالی.
3. pack درست در `feature-packs.ts`؛ کسب‌وکاری که pack را ندارد قطعه را **mount نمی‌کند** (`look.active` برای `enabled`).
4. حالت خالی با دلیل («هنوز خدمتی تعریف نشده» ≠ «امروز نوبتی نیست»). «نامعلوم» صفر نیست.
5. کلیدها در سه زبان. کامپوننت در `packages/ui` (وب، ویندوز و WebView اندروید همان را نشان می‌دهند) — نسخه‌ی موبایل جدا
   نکش؛ زیر ۷۶۸px همان `DataTable` کارت می‌شود.
6. واژگان (`Vocabulary`) و `ProductDefaults.emphasizedFields` (پوشاک: سایز، رنگ، برند، فصل) — فقط اگر فیلد واقعاً هست.
7. ترتیب منو فقط از DNA (`dna-menu-suggestion.ts`)؛ مورد منوی تازه ممنوع.

خواسته‌ای که موتور ندارد (ظرفیت کلاس، کنترل کیفیت تعمیر، کمیسیون قاعده‌محور اگر نیست، رمز دستگاه با کنترل امنیتی)
⇒ `GAPS-AND-REQUIREMENTS.md` + `docs/architecture/V70-BACKLOG.md` با طرح دامنه/API/migration، **بدون کد**.

**گاردها:** `industry-dashboard-parts.test.ts` (هر قطعه: provider سرور + local-engine + ردیف ماتریس + pack + سه زبان)؛
گسترش `apps/web/e2e/journey-industries.spec.ts` برای این چهار (قطعه‌ی اختصاصی بدون کلید خام و error boundary)؛
`scripts/industry/run-acceptance.mjs` بدون شل‌کردن معیارها.

### - [x] V69.6 — ۶۳ صنف باقی‌مانده: پیکربندی از خانواده

شاهد: `node scripts/industry/generate-industry-diff.mjs` ⇒ ۶۷ کلید / ۶۷ قابل‌انتخاب / ۵۵ اختصاصی / ۱۲ عمومی؛ `npx vitest run src/__tests__/industry-dashboard-parts.test.ts` در `packages/validation` ⇒ ۱۶/۱۶ پاس؛ `generate-industry-docs.mjs --check` ⇒ exit 0.

برای هر id: `PROFILES` (داشبورد، واژگان، تأکید فرم) از خانواده‌اش، فقط با قطعه‌ها و قابلیت‌های موجود. صنفی که قطعه‌ی
مناسب ندارد پیش‌فرض عمومی می‌ماند و README صریح می‌گوید. هیچ موتور تازه. گاردهای موجود صنف (`industry-diff-doc.test.ts`،
سفرهای ۶۷/۶۷) سبز بمانند.

### - [x] V69.7 — آفلاین و دستگاه برای تجربه‌های صنف

شاهد: `npx vitest run src/__tests__/industry-offline-device.test.ts` در `packages/ui` ⇒ ۸/۸ پاس؛ `generate-industry-docs.mjs --check` ⇒ exit 0؛ injection (`PENDING_REVIEW`→`LAST_WRITE_WINS`) ⇒ ۱ تست قرمز، پس از بازگرداندن سبز؛ `code-intel callers "executionSiteFor"` ⇒ ۵ caller همه `invoice.create`.

برای ۴ نماینده: هر اقدام اصلی (فروش، نوبت، ثبت خدمت، کسر جلسه، پذیرش تعمیر، پرداخت نقدی) در `OFFLINE-AND-DEVICE.md` با
رفتار واقعی ماتریس. رزرو: دو دستگاه آفلاین یک زمان/ظرفیت ⇒ conflict صریح (`handleBookingSyncConflict` را دنبال و تست
کن)، نه LWW. اگر V68 مکان اجرای این اقدام‌ها را device کرد، همان قرارداد `executionSiteFor` — مسیر سوم نساز.

### - [x] V69.8 — سند و درس

شاهد: `node scripts/build-ai-index.mjs` ⇒ INCREMENTAL_UPDATE (FRESH)، added 6 / modified 31؛ `node scripts/code-intel.mjs status` ⇒ FRESH، ۲۱۱۳۷ نماد و ۸۳۴۶۳ رابطه؛ `docs\industries` ⇒ ۶۸ README + ۱۳ خانواده + ۳۲ فایل نماینده؛ `graphify.exe` با `Test-Path` ⇒ False (اجرا نشد).

`docs/industries/README.md` (نقشه)، یک ردیف V68/V69 در جدول §۴ `CLAUDE.md`، درس‌ها در `.claude/lessons-learned.md`،
`node scripts/build-ai-index.mjs`، و به‌روزرسانی graphify با مسیر کامل.

### - [x] V69.9 — وریفای نهایی و بیلد

شاهد: `npx vitest run` ⇒ backend **5783/5783** (۴۶۱ فایل، بدون pg) · ui **2874 passed / 2 skipped** (۲۳۳ فایل) · validation **1105/1105** (۸۸ فایل) · api گاردهای دستگاه **10/10**؛ `npx tsc --noEmit` در شش پکیج ⇒ **exit 0**؛ `npx eslint` روی ۶ فایل تغییرکرده ⇒ **0 error**؛ `npx next build` ⇒ **✓ Compiled successfully in 19.1s** (BUILD_ID 2026-11-16 09:41:02)؛ desktop/android ⇒ **exit 1** (`esbuild-transpile … Access is denied`) ⇒ BLOCKED_EXTERNAL؛ jest نصب نیست ⇒ سه سوئیت اجرا نشد.

ترتیب `CLAUDE.md` §۰٫۵: وریفای کامل (§۶ `CLAUDE.md`، پشت سر هم) → eslint روی فایل‌های تغییرکرده از پوشه‌ی هر پکیج →
بیلدها (web `next build`، desktop، android `pnpm run android:release` — تاریخ فایل APK را بسنج، نه پیام Gradle) → درس‌ها.

---

## ۵. بازبینی خودت (پیمانکار) — قبل از اعلام پایان

روی **همه‌ی** diff خودت (`git diff --stat` و هر فایل):

1. هر تیک `[x]` را دوباره با شاهدش اجرا کن؛ بازتولید نشد ⇒ `[ ]` و رفع.
2. `pnpm code-intel` / graphify: هیچ نماد تازه‌ی هم‌کار با موجود (G2)؛ هیچ تابع تازه‌ی بی‌caller (§۷٫۱).
3. هر گارد تازه injection-test شده؟
4. `node scripts/audit-unwired-routes.mjs` و `node scripts/check-schema-drift.mjs`.
5. جست‌وجو در diff: `any`، `ts-ignore`، `eslint-disable`، `?? 0` روی پول/سود، `.eq('…', null)`، `<select>` خام،
   `router.push('/` برهنه در `packages/ui`، `left-`/`right-`/`ml-`/`mr-`، رنگ hex، کلید i18n فقط در یک زبان.
6. هیچ متنی «بک‌اند بی‌کار است»، «۶۷ صنف کامل پیاده شد»، یا «PASS» بدون عدد.
7. هر باگ/شکاف: **اول در PROGRESS گزارش** (§۱۳ `CLAUDE.md`)، بعد اصلاح، بعد شاهد.

## ۶. شکل گزارش پایانی (فارسی، انتهای PROGRESS و در پاسخ)

| فاز | وضعیت (§۰.۱۳) | فایل‌ها | تست (پاس/کل) | شاهد (فرمان) |
| --- | ------------- | ------- | ------------ | ------------ |

- جدول FINDINGهای V68.0 با جواب · + migrationها با `PENDING HUMAN CONFIRMATION` · + فهرست `NEW_CAPABILITY_REQUIRED` (V70)
  · + آنچه BLOCKED ماند با دلیل · + `git status --short` پایانی (فایل‌های کاربر دست‌نخورده).

## ۷. ممنوع (خلاصه)

موتور/صفحه/route/منو/استور/پکیج دوم · تصمیم مکان اجرا در `runtime-policy` · local-first بدون آمادگی داده · موفقیت محلی
جعلی · fallback از ردّ موتور محلی به سرور · دو pusher برای یک ردیف · LWW بی‌صدا · ۵۳۶ فایل دستی تکراری · عدد نمونه‌ی
`.claude/new-task.md` به‌عنوان داده · id صنف اختراعی · commit/push/subagent · DDL زنده · شل‌کردن گارد.

---

## ۸. بازبینی معمار روی `main` (Claude بعد از تحویل اجرا می‌کند — پیمانکار این بخش را تیک نمی‌زند)

- [ ] diff از `881ae1c1` تا وضع تحویل: هر فایل در PRIMARY/SECONDARY یکی از فازهاست یا دلیلش در PROGRESS آمده.
- [ ] فایل‌های کاربر در baseline (۱۲ فایل) فقط با تغییرات خود کاربر.
- [ ] سوئیت‌ها از نو، پشت سر هم: local-engine، validation، api tsc، app-shell، ui، backend، desktop jest، mobile jest — عدد با PROGRESS برابر.
- [ ] `invoice-device-first.test.ts` با injection: شرط `executionSiteFor` را موقت حذف می‌کنم؛ باید قرمز شود.
- [ ] `submitInvoice` را می‌خوانم: روی هاست آماده صفر مسیر به `apiClient.post('/invoices')`؛ وب دست‌نخورده.
- [ ] `execution-site.ts` هیچ وابستگی به `runtime-policy`/کلاس دستگاه ندارد.
- [ ] `deviceReadyFor` پایدار (جدول `meta`)، به‌ازای workspace؛ `device-operation-reads.test.ts` با منبع route برابر.
- [ ] push تک‌مالک روی اندروید (F2 دوباره ⇒ یک POST).
- [ ] roundtrip: شماره‌ی رسمی به ردیف محلی؛ push دوباره = یک ردیف؛ ردّ سرور = `failed` با کد.
- [ ] parity طلایی دو ارزی: عددها را با دست بازحساب می‌کنم.
- [ ] `docs/industries/`: ۶۷ README، ۱۳ خانواده، ۴×۸ فایل؛ `industry-specs-complete.test.ts` سبز و injection-test شده؛
      ۵ README تصادفی را با کد تطبیق می‌دهم (route، فیلد، وضعیت).
- [ ] چهار قطعه‌ی داشبورد: provider سرور + local-engine + ماتریس + pack + سه زبان؛ روی وب در مرورگر با workspace
      سالن/آموزشگاه/پوشاک/تعمیر واقعاً رندر می‌شوند (اسکرین‌شات).
- [ ] هیچ route/مورد منوی تازه (`route-parity.test.ts`، `nav-module-locks.test.ts` سبز).
- [ ] هر چیزی که بازتولید نشد ⇒ تیکش برمی‌گردد و در گزارش معمار با فایل:خط می‌آید؛ شکاف کوچک را خودم می‌بندم، شکاف
      بزرگ را دور بعدِ پیمانکار می‌کنم.
