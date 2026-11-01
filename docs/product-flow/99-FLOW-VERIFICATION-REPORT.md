# 99 — FLOW VERIFICATION REPORT

commit: `05f749a2818299d5c0995d557cc0ec40c1bd5740` · date: 2026-11-01
**وضعیت نهایی: `INCOMPLETE` (با دلیل دقیق در بخش ۷)** — هر ۲۳ سند و `flow-index.json` ساخته شد، ولی عمق بررسی همهٔ ماژول‌ها یکسان نیست.
مرتبط: [00-MASTER-FLOW-TREE](00-MASTER-FLOW-TREE.md) · [20](20-ANSWERS-TO-THE-FOUR-QUESTIONS.md) · [flow-index.json](flow-index.json)

## ۱. Git baseline (قبل/بعد)

- قبل: `M apps/desktop/electron-builder.yml`, `M docs/qa/BUG-DISCOVERY-100-REGISTRY.json`, `M docs/qa/FINAL-STABILIZATION-VERIFICATION.fa.md`, `?? apps/desktop/resources/installer.nsh`.
- بعد: همان چهار مورد + `?? docs/product-flow/`. هیچ فایل محصول/تست/migration/config/.env تغییر نکرد. `git diff --check`: خروجی خالی. اسکریپت‌های موقت در `%TEMP%` (scratchpad) ماندند، نه در ریپو.
- Code Intelligence: `FRESH` (git head مطابق، ۱۸۷۹ فایل، ۱۷٬۹۲۷ نماد، ۶۴٬۳۱۷ رابطه، ۳ چرخهٔ فایل)؛ `graph.json` gitignore است و refresh نشد. به‌عنوان راهنما استفاده شد، نه اثبات.

## ۲. معیارهای واقعی

| معیار                                      | عدد                                                                                          | روش                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| صفحه‌های وب (`page.tsx` کل `apps/web/app`) | 67 (30 در گروه dashboard)                                                                    | `find`                             |
| صفحه‌های ادمین                             | 26                                                                                           | `find apps/admin/app`              |
| route صفحهٔ app-shell (Windows/Android)    | ۳۵ صفحهٔ واقعی + ۲۹ ریدایرکت                                                                 | `app.tsx:100-207`                  |
| فایل route بک‌اند / ثبت route              | 105 فایل / 814 (get 397، post 269، patch 59، put 49، delete 40)                              | grep `fastify.<verb>(`             |
| فایل route موتور محلی / ثبت route          | 42 / 202 (get 111، post 54، patch 18، put 12، delete 7)                                      | grep `router.<verb>(`              |
| ردیف ماتریس آفلاین                         | 495 = available 175 + online_required 305 + not_supported 15                                 | regex روی فایل                     |
| پوشه‌های سرویس بک‌اند                      | 115                                                                                          | `ls`                               |
| فایل‌های SQL migration در docs/            | 195 `*-migration.sql`                                                                        | `ls`                               |
| زبان‌ها                                    | 3 (fa, af, en)                                                                               | `ls packages/i18n/messages`        |
| capability (سرور) / نقش                    | 41 / 3 (`owner                                                                               | manager                            | seller`) | `authorization.domain.ts:36,50-106` |
| `requireCapability(`                       | 259 استفاده در 63 فایل route                                                                 | grep                               |
| دسته‌های کسب‌وکار                          | 66 کلید؛ 23 override؛ 43 generic                                                             | اسکریپت روی `industry-profiles.ts` |
| تست‌ها                                     | backend `__tests__` 428 فایل؛ packages 372 فایل                                              | `find` (اجرا نشد)                  |
| core اثبات‌شده                             | 12                                                                                           | [04](04-CORE-DEPENDENCY-GRAPH.md)  |
| شناسه‌ها در `flow-index.json`              | screens 35 · flows 29 · cores 12 · entities 18 · mutations 13 · permissions 10 · journeys 38 | اسکریپت                            |

شمارش وضعیت (از `flow-index.json`): screens → VERIFIED_SOURCE 10 / PARTIAL 11 / NOT_VERIFIED 14؛ flows → 20 / 7 / 2؛ journeys → 15 / 16 / 7؛ cores → 12 VERIFIED_SOURCE؛ permissions → 10 VERIFIED_SOURCE. **`VERIFIED_RUNTIME`: صفر.** (شمارش‌های سربرگ هر سند دستی و تقریبی‌اند؛ مرجع، همین جدول است.)
فلوها بر اساس دسته: جریان‌های جهش (mutation flows) 13 نوع در صف (MUT-001…013)؛ جریان‌های آفلاین FLOW-002/020…026/072؛ حسابداری FLOW-001/003/004/005/006/010/011/012/060؛ موجودی FLOW-040…044؛ مجوز PERM-001…010.

## ۳. ادعاهای مستند در برابر کد (کد برنده)

| مستند                                                                                              | کد                                                                                    | اثر                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `docs/audit/evidence/return-flow-map.md:100` — برگشت فروش موجودی را `stock_movements` برمی‌گرداند  | `invoice-return-02…sql` (CREATE OR REPLACE جدیدتر) هیچ `INSERT stock_movements` ندارد | کدام نسخه روی دیتابیس زنده است؟ NOT_VERIFIED |
| `pos.service.ts postSession` کامنت: تفاوت شمارش به «حساب جدا»، نه sales                            | `till-view.ts sessionPostingLines`: خط variance روی `accounts.sales`                  | درآمد با تفاوت صندوق تغییر می‌کند            |
| `ui-contract/business-types.ts:10` و `auth.routes.ts:760-764`: دسته روی workspace/تصمیم workspace  | آنلاین روی `profiles.business_types` (کاربر)                                          | دو مدل ذخیره‌سازی                            |
| `BUG-DISCOVERY-100-DECISIONS-APPLIED.fa.md`: payroll-idempotency-01 و appointment-conflict-01 معلق | کاربر در همین نشست VERIFY هر دو را `true` گزارش کرد                                   | به‌روزرسانی سند نیاز دارد                    |
| CLAUDE.md: «POST /api/invoices در route گارد capability ندارد»                                     | route در این فاز خوانده نشد                                                           | NOT_VERIFIED                                 |

## ۴. جریان‌های وابسته به کد کامیت‌نشده یا migration اجرانشده

- کد: پوشهٔ کاری فقط ۳ فایل پیکربندی/گزارش و `installer.nsh` را تغییر داده؛ هیچ جریان محصولی به کد کامیت‌نشده وابسته نیست.
- migration معلق (PENDING HUMAN CONFIRMATION، طبق CLAUDE.md و گزارش‌ها): `device-slot-01` (سقف ۲+۲ دستگاه در DB)، `appointment-conflict-02`، `shelf-capacity-01`، `till-payments-01`، `invoice-exchange-rate-01`، `dashboard-fx-01`، `custom-units-01`، `attendance-devices-01`، `attendance-02`. اثر: FLOW-001 (ارز خارجی: `canStoreExchangeRate`)، FLOW-010/012 (صندوق)، SCR-002 (داشبورد چندارزی)، قفسه‌ها، لایسنس آفلاین.
- `invoice-return-01` در برابر `-02`: نسخهٔ فعال نامعلوم.

## ۵. ۲۰ مشاهدهٔ معماری (فقط حقایق؛ هر کدام با ارجاع)

1. ساخت اولین workspace آنلاین: هیچ فراخواننده/تریگری در ریپو (`useCreateWorkspace` بی‌caller؛ `workspace.service.ts:133`).
2. گیت onboarding وب فقط از localStorage می‌خواند؛ `onboardingCompleted` سرور خوانده نمی‌شود (`dashboard-layout.tsx:174`, `auth.routes.ts:261`).
3. دسته: آنلاین `profiles.business_types[]` ≠ آفلاین `workspace.business_types` رشته‌ای (`workspace.ts:163-193`).
4. شخصی‌سازی دسته محدود: 23/66 کلید، فقط ترتیب داشبورد/واحد/۳ واژه/ستون/تب‌ها (`industry-profiles.ts`).
5. دو `CREATE OR REPLACE` برای `invoice_return_create` با رفتار موجودی متفاوت (`docs/invoice-return-01…:243`, `…-02…`).
6. برگشت فروش مالیات را جدا برنمی‌گرداند (`02…sql:306-318`).
7. برگشت هیچ بازپرداخت/لغو پرداختی نمی‌سازد.
8. KPI داشبورد از جدول `invoices` و بدون کسر برگشت‌ها (`analytics.service.ts:212`, `dashboard-fx-01-migration.sql`).
9. ارزش انبار داشبورد = `quantity × buy_price` فعلی، نه لایه‌های بها (`dashboard-fx-01…:139`).
10. مانده مشتری از اسناد، نه سطح receivable دفتر (`customer.service.ts:940-990`).
11. سود از `cost_consumptions`، نه COGS دفتر (`profit-report.domain.ts:216`).
12. دریافت PO: بدون سند دفتر و بدون انبار روی حرکت (`purchasing.service.ts:455-486`).
13. تعدیل موجودی و انتقال انبار سند دفتر نمی‌زنند؛ `'stock_adjustment'` بی‌caller (`ledger.port.ts:27`).
14. تفاوت شمارش صندوق به `sales` می‌رود (`till-view.ts:~228`).
15. فاکتور آفلاین ۶ قانون آنلاین را ندارد (credit-party، approval، سقف پلن، till، flag منفی، capability) (`local invoices.ts:482-905`).
16. معکوس‌سازی دفتر: آنلاین سند جدید، آفلاین `status='reversed'` (`invoices.ts:1053`, `accounting.service.ts:632`).
17. نسخهٔ `offline` اصلاً sync ندارد (`sync-engine.ts:783`)؛ مهاجرت به ابر فقط ۸ بخش.
18. لغو/حذف فاکتور چندمرحله‌ای و غیراتمیک (`invoice.service.ts:1803-1830`).
19. دو مدل مجوز: سرور (۳ نقش/۴۱ capability) و محلی (۷ نقش/مجموعهٔ دستی) (`authorization.domain.ts`, `local auth.ts`).
20. `warehouse/transfer.service.ts:127` از DELETE جبرانی استفاده می‌کند، در تضاد با قاعدهٔ ۱.۴ CLAUDE.md.

## ۶. موارد NOT_VERIFIED و دلیل

| مورد                                                                                          | دلیل                                                                                    |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| اجرای زندهٔ هر جریان (VERIFIED_RUNTIME)                                                       | workspace آزمایشی تأییدشده در دسترس نبود؛ ۸۷ سوئیت PG روی این ماشین BLOCKED (خطای ۱۳۱۴) |
| ساخت اولین workspace آنلاین                                                                   | کدی پیدا نشد                                                                            |
| نسخهٔ زندهٔ `invoice_return_create`                                                           | اجرای SQL کار انسان                                                                     |
| route دقیق `POST /api/invoices` و گارد آن                                                     | خوانده نشد                                                                              |
| ۱۴ صفحه (اکتیویتی، تأییدها، توسعه‌دهندگان، تحلیل، تولید، دستیار، عملیات، ممیزی، صفحات عمومی…) | بودجهٔ بررسی                                                                            |
| شمارش انبار، مالیات، انتقال به ابر، CRM، AI، اتوماسیون، ساخت و تولید، apps/admin              | بودجهٔ بررسی                                                                            |
| ماتریس حالت تک‌تک صفحه‌ها (17)                                                                | نیاز به رندر زنده                                                                       |
| تطابق خودکار مدل مجوز محلی/سرور                                                               | تست تطابق کامل پیدا نشد                                                                 |

## ۷. دروازه‌های تکمیل

| گیت                                                                                                                                                      | وضعیت                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 با شمارش واقعی و جدول core                                                                                                                       | ✔                                                                                                                                           |
| onboarding، ماتریس دسته (همهٔ دسته‌ها و مصرف‌کنندگان)، فاکتور آنلاین/آفلاین، پرداخت، موجودی، خرید، حسابداری، برگشت/لغو، sync، مجوز، گزارش با `path:line` | ✔ (عمق متفاوت)                                                                                                                              |
| چهار پرسش در سند اختصاصی                                                                                                                                 | ✔ ([20](20-ANSWERS-TO-THE-FOUR-QUESTIONS.md))، با حلقه‌های گم‌شدهٔ نام‌برده                                                                 |
| بازبینی خطوط ارجاع با سورس فعلی                                                                                                                          | ✔ ۵۸ ارجاع کلیدی بررسی شد؛ ۴ مورد ±۱ تا ۲ خط (در بازهٔ ذکرشده) — ارجاع‌های ریز و مقادیر داخل دامنه‌ها (`:~NNN`) با علامت تقریب مشخص شده‌اند |
| Mermaid برای مسیرهای بحرانی                                                                                                                              | ✔ (01، 04، 05، 12)                                                                                                                          |
| `flow-index.json` معتبر و سازگار با شناسه‌های markdown                                                                                                   | ✔ (اسکریپت: «md ids missing: []», JSON parses OK)                                                                                           |
| بدون تغییر محصول/commit/push                                                                                                                             | ✔                                                                                                                                           |
| **همهٔ ماژول‌ها با عمق برابر**                                                                                                                           | ✘ — به همین دلیل وضعیت `INCOMPLETE`                                                                                                         |

دلیل `INCOMPLETE`: ۱۲ مسیر بحرانی با شواهد پوشش یافتند؛ ۱۴ صفحه از ۳۵ صفحه، و ماژول‌های جانبی (تولید، CRM، AI، اتوماسیون، توسعه‌دهندگان، apps/admin، مالیات، شمارش انبار) فقط نام‌گذاری شده‌اند و `NOT_VERIFIED` علامت خورده‌اند. هیچ حدسی به‌جای شاهد ننوشته شد.
