# کش سشن — ۱۴ سپتامبر ۲۰۲۶ (بودجه · صندوق · حاکمیت · داده و همگام‌سازی · ۵۰۰ها)

> سشن بعدی اول این را بخواند. هر بند یک **درس** یا یک **وضعیت واقعی** است.
> جزئیات کد در خود فایل‌ها کامنت شده؛ این‌جا فقط نقشه و تله‌هاست.

---

## ۰. پنج درس اصلی این سشن

### ۱ — «قانون وجود دارد و هیچ‌کس صدایش نمی‌زند» باز هم تکرار شد (الگوی ۱)

- `BudgetService.checkSpend / commit / release` ساخته شده بودند و **هیچ** سرویسی
  صدایشان نمی‌زد؛ سفارش خرید می‌توانست هر مبلغی را روی بودجه‌ی `block` خرج کند.
  حالا `purchasing.service.ts#createPurchaseOrder` قبل از ساخت چک می‌کند و بعد
  رزرو می‌کند؛ `receiveGoods` و `deletePurchaseOrder` آزاد می‌کنند.
- پرداخت نقدی فاکتور هیچ اثری روی صندوق باز نداشت → بستن صندوق همیشه «اضافه»
  نشان می‌داد و صندوق‌دار مجبور به ثبت دوباره‌ی همان پول به‌صورت cash_in بود.

### ۲ — تست‌های مسیر واقعی (HTTP inject) باگ‌های قدیمی را پیدا کردند

- `PUT /api/operations/budgets/:id` در body اسکیما `id` را **الزامی** داشت، ولی
  کلاینت `{ id, ...body }` را جدا می‌فرستد → **هر ذخیره‌ی بودجه همیشه ۴۰۰ بود.**
  درس: اسکیمای body نباید فیلدی را بخواهد که در URL است.
- Fastify **اعتبارسنجی body را قبل از preHandler** اجرا می‌کند. تست ۴۰۳ باید
  body معتبر بفرستد، وگرنه ۴۰۰ می‌گیرد و چیزی درباره‌ی دسترسی ثابت نمی‌کند.
- کش `memoryCache` بین تست‌های یک فایل می‌ماند (`budget:${workspaceId}:list`).
  تستی که مستقیم `db.seed` می‌کند باید آن prefix را invalidate کند.

### ۳ — گاردهای ایستای پروژه درست می‌گویند؛ دورشان نزن، طراحی را درست کن

- `tenancy-static-guard`: `.eq('user_id', …)` روی `payments` ممنوع است. برای
  نسبت‌دادن پرداخت به صندوق‌دار، کوئری فقط با `workspace_id` است و بعد در حافظه
  بر اساس «چه کسی ثبت کرد» فیلتر می‌شود (actor attribution، نه مرز امنیتی).
- `client-route-contract`: URL پویا مثل `` `/budgets/${id}/${action}` `` قابل
  تطبیق نیست؛ برای هر action یک URL صریح بنویس.
- `vertical-slice-integration`: هر route باید `preHandler:` صریح داشته باشد؛
  ثبت route در حلقه‌ی `for` خوانده نمی‌شود.
- `sod-rule-coverage`: قانون SoD جدید باید **هر دو نیمه** را در کد داشته باشد
  (`sod.recordAction(ctx,'budget.manage','budget',id)` و
  `sod.assertAllowed(ctx,'budget.approve','budget',id)`) با رشته‌ی literal.
- `design-token-existence`: `var(--color-plan)` که ChartContainer می‌سازد توکن
  شناخته‌شده نیست؛ مستقیم `hsl(var(--color-primary))` بنویس.

### ۴ — `-0`

`normalizeActual('revenue', 0)` با `-x` مقدار `-0` برمی‌گرداند که «−0» چاپ
می‌شود و `toBe(0)` را رد می‌کند. برای معکوس‌کردن پول: `0 - x`.

### ۵ — «۵۰۰ بدون توضیح» خودش باگ است

گزارش «۵۰۰ روی branches / branches/tree / permissions/matrix / POST employees»
هیچ سرنخی در پاسخ نداشت. حدس «migration اجرا نشده» با
`SESSION-2026-09-05-CONSOLIDATION.md` (G2/G3 اجرا شده‌اند) تناقض دارد — **حدس را
به‌جای علت ننویس.** کارهای انجام‌شده:

- `backend/src/errors/http-failure.ts#sendFailure`: خطای دامنه‌ای (<500) کد خودش
  را نگه می‌دارد؛ `DatabaseError` با `dbCode` (فقط کد، نه پیام) و کد عملیاتی
  ابتدای پیام (مثل `EMPLOYEE_BRANCH_NOT_MIGRATED`) برمی‌گردد.
- `POST /api/employees` هر `NotFoundError('Branch')` را ۵۰۰ می‌کرد؛ و کارمند
  **قبل** از چک شعبه insert می‌شد → کارمند یتیم + تلاش دوباره روی کد تکراری ۵۰۰.
  حالا شعبه قبل از insert چک می‌شود.
- دسترسی خواندن `.env` بک‌اند رد شد؛ علت نهایی ۵۰۰ها هنوز نیاز به **یک خط لاگ
  سرور** یا مقدار `dbCode` از تب Network دارد.

---

## ۱. بودجه — وضعیت

**یک موتور:** `backend/src/services/budgeting/budget.domain.ts` (خالص) +
`budget.service.ts` (خواندن/مجوز/ذخیره). UI هیچ عددی را دوباره حساب نمی‌کند.

| مفهوم                                                             | کجا                                              |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| نوع `expense` / `revenue` (profit/cash عمداً نه: تک‌حسابی نیستند) | `BudgetType`                                     |
| علامت دفتر → علامت بودجه (فقط این‌جا)                             | `normalizeActual`                                |
| توزیع درصدی با largest-remainder و BigInt                         | `distributeByWeights`                            |
| برنامه‌ی تا امروز از توزیع واقعی (نه annual/12)                   | `theoreticalToDate`                              |
| remaining/variance (مثبت = مطلوب برای هر دو نوع)/forecast         | `performance`                                    |
| forecast بدون داده → `insufficient_data` و `null`، نه عدد جعلی    | `performance`                                    |
| warn / block / approval / track                                   | `checkImpact`                                    |
| تعهد باز = مبلغ − مصرف‌شده − آزادشده (ناوردا: ۳۰ می‌ماند نه ۱۰)   | `openCommitments`، `BudgetService.consume`       |
| اصلاحیه با تاریخچه‌ی تغییرناپذیر                                  | `reviseBudget` + RPC `budget_apply_revision`     |
| هم‌پوشانی بودجه‌های تصویب‌شده (حساب+نوع+شعبه+بُعد+دوره)           | `findOverlap` در `approve`                       |
| گزارش کل صفحه با **یک** RPC                                       | `performanceReport` → `budget_performance_batch` |

- مجوزها: `budget.read`/`budget.manage` → manager، `budget.approve` → owner در
  `authorization.domain.ts` + ماژول `budgets` در ماتریس. ۴۰۳ برای عدم مجوز،
  ۴۰۹ برای تعارض وضعیت.
- SoD: قانون `budget.draft-then-approve` در `sod.domain.ts` (پیش‌فرض workspace
  `off`).
- Routes: `GET /operations/budgets/report`، `POST /budgets/:id/{submit,approve,archive,revise}`،
  `GET /budgets/:id/revisions`.
- **Migration (انسان اجرا کند):** `docs/budget-planning-migration.sql` سپس
  `docs/VERIFY-budget-planning.sql`. تا اجرا نشود: خواندن با ستون‌های قدیمی کار
  می‌کند، نوشتن‌های جدید `BUDGET_MIGRATION_REQUIRED` (۴۰۹) می‌دهند.
  وضعیت: **Post-migration Audit: PASS** — انسان در ۱۴ سپتامبر اجرا کرد و هر ۷ ردیف VERIFY `ok: true` بود.
  ⚠️ VERIFY تابع `budget_apply_revision` و GRANT آن را چک نمی‌کرد؛ `docs/VERIFY-budget-revision-fn.sql` اضافه شد — **PASS** (۵/۵ ok، ۱۴ سپتامبر).
- محدودیت واقعی: PO↔فاکتور خرید لینک ندارد؛ پس رزرو PO هنگام **دریافت کالا**
  آزاد می‌شود (نه consume). بین دریافت و ثبت فاکتور خرید یک پنجره‌ی کوتاه هست.

## ۲. صندوق — وضعیت

- مدل canonical همان `pos_sessions` + `pos_cash_movements` + `pos_orders` است.
- **جدید:** `CashSettlement` در `pos.domain.ts` — پرداخت‌های نقدی فاکتور (جدول
  `payments`، method=cash، status=posted) که صندوق‌دار در بازه‌ی باز بودن صندوق
  ثبت کرده، در `expectedCashMinor` هستند و در `buildPosting` **از بدهکار نقد کم
  می‌شوند** (خود پرداخت قبلاً سند زده؛ دوباره‌زدن = دوبار ثبت).
- `buildDrawerLedger` + `GET /pos/sessions/:id/ledger`: هر رویداد نقدی با مانده؛
  آخرین مانده دقیقاً = expected (تست دارد).
- UI: کارت موجودی، ورود/خروج/خالص این نوبت، فهرست تراکنش‌ها با فیلتر
  (همه/ورود/خروج/فاکتورها). `useRecordPayment` حالا `['till']` را هم invalidate می‌کند.
- **ساخته نشده (عمداً، بدون جعل):** انتقال دوطرفه صندوق↔بانک (نیاز به اتصال
  banking)، شمارش اسکناس.
- **نمودار جریان نقدی ۷/۳۰/۹۰ روزه ساخته شد:** `GET /pos/cash-flow` → `dailyCashFlow` (پرداخت‌های نقدی posted + حرکات صندوق + نقد سفارش‌های صندوق، روز محلی با offset، صفحه‌بندی‌شده).

## ۳. حاکمیت — وضعیت

- `/governance` حالا `GovernanceHubContainer` است: تب‌های overview · members
  (`WorkspaceContainer`) · permissions (`PermissionsContainer`) · approvals
  (`ApprovalsContainer`) · sod (`GovernanceContainer` قبلی) · audit
  (`AuditContainer`). فقط تب فعال mount می‌شود.
- `/permissions` → `permanentRedirect` به `/governance?tab=permissions` (وب) و
  `Navigate` (دسکتاپ). آیتم منوی `access` از contract/منو/موبایل حذف شد.
- Employee ≠ Member حفظ شد؛ هیچ جدول نقش/دسترسی/audit دومی ساخته نشد.

## ۴. داده و همگام‌سازی — وضعیت

- هاب ماند (نه sync-center دوم). اضافه شد: ردیف خلاصه (همگام‌سازی/صف/تعارض با
  شمار مالی/آخرین انتقال)، پیش‌نمایش ۳ تعارض باز، آخرین پشتیبان محلی
  (`useBackupStore`)، بخش جمع‌شده‌ی «تشخیص و سلامت فنی».
- **منبع ندارد، پس نمایش داده نمی‌شود:** شمار mutationهای شکست‌خورده، دستگاه‌ها،
  تکراری‌ها/یکپارچگی ارجاعی. در صفحه صریحاً گفته شده.

## ۵. تکراری‌ها

- `/sales-followup` → `/crm` (قبلی). `/permissions` → governance (این سشن).
- `data-and-sync` و `sync-center` تکراری نیستند (هاب در برابر عملیات).
- `*-workspace` ها هاب دامنه‌اند، نه کپی.

## ۶. تله‌های ابزار این سشن

- heredoc با آپاستروف فارسی/انگلیسی داخل Bash این محیط گاهی «unexpected EOF»
  می‌دهد → اسکریپت را با Write در scratchpad بنویس و اجرا کن.
- فایل‌های CRLF: هر patch پایتون باید `\r\n` را نرمال و برگرداند.
- `git stash` برای مقایسه با قبل استفاده شد و سالم برگشت — ولی خطرناک است؛
  ترجیحاً `git worktree` یا فقط اجرای تست روی HEAD.
- اسکریپت i18n قابل‌استفاده‌ی مجدد: از `t('ns.key','fallback')` کلیدها را
  درمی‌آورد، fa/af را با fallback و en را از نقشه‌ی صریح پر می‌کند و اگر
  انگلیسی نباشد **رد می‌کند**.

## ۷. نتیجه‌ی واقعی وریفای (همین سشن اجرا شد)

| بخش                       | نتیجه                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| backend tsc               | ✅                                                                                                     |
| backend vitest            | ✅ 1993/1993                                                                                           |
| packages/api tsc          | ✅                                                                                                     |
| packages/ui tsc + vitest  | ✅ 628 passed, 2 skipped                                                                               |
| ui-contract tsc           | ✅ ؛ vitest 429/430 — `assistant is routed at /assistant` از قبل قرمز بود (با stash روی HEAD تأیید شد) |
| apps/web tsc              | ✅                                                                                                     |
| apps/desktop tsc + jest   | ✅ 88/88                                                                                               |
| apps/admin tsc            | ✅                                                                                                     |
| apps/mobile tsc + jest    | ✅ 210/210                                                                                             |
| eslint فایل‌های تغییرکرده | ✅ 0 error (112 warning)                                                                               |
| injection tests           | بودجه (remaining، علامت درآمد)، صندوق (دوبار ثبت نقد) — هر سه قرمز شدند و برگشتند                      |
| QA بصری ۳۶۰→۱۹۲۰          | ❌ انجام نشد — صفحه‌ها پشت لاگین با داده‌ی واقعی‌اند و ورود رمز توسط Claude مجاز نیست                  |
