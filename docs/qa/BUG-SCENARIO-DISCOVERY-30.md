# گزارش کشف ۳۰ سناریوی ریسک بالا و خطای واقعی در حسابچه (HISABCHE BUG SCENARIO DISCOVERY AUDIT)

---

## ۱. مشخصات و هدر ممیزی (Audit Header)

- **تاریخ ممیزی:** ۲۰۲۶-۱۰-۳۱
- **شاخه گیت و کامیت:** `main` | `b9f90056afad64cb1af2f634482ecb0110bf7030`
- **وضعیت درخت کاری گیت قبل از شروع (Git Status Before):**
  ```text
  M AGENTS.md
  M CLAUDE.md
  M package.json
  M scripts/build-ai-index.mjs
  ?? docs/ai/
  ?? scripts/__tests__/
  ?? scripts/code-intel-mcp.mjs
  ?? scripts/code-intel.mjs
  ?? scripts/lib/
  ```
- **وضعیت هوش کد مخزن (Code Intelligence Status):**
  - وضعیت: `FRESH`
  - نسخه اسکیما: `2`
  - فایل‌های تحت پوشش: ۱٬۸۷۷ فایل منبع
  - نمادها: ۱۷٬۸۷۵ نماد
  - روابط گراف: ۶۳٬۸۴۱ رابطه (۳۵٬۴۵۰ اعتبارسنجی‌شده، ۱۲٬۵۳۹ خارجی، ۱۵٬۸۵۲ حل‌نشده)
  - چرخه‌ها: ۳ چرخه پکیج/فایل
- **محدودیت‌های محیطی و اجرایی:**
  - عملیات کاملاً فقط‌خواندنی (Read-Only). هیچ کد محصول، تست، فایل `.env` یا مایگریشن دیتابیس ویرایش یا اضافه نمی‌شود.
  - هیچ کوئری مخرب، DDL یا تغییری روی پایگاه داده زنده سوپابیس اجرا نشده است.
  - هیچ عملیات مالی یا تراکنش بانکی واقعی اجرا نشده است.

---

## ۲. هدر پیشرفت پویا (Dynamic Progress Header)

- **فاز فعلی:** فاز ۲ — تحلیل رتبه‌بندی، دسته‌بندی و تکمیل مستندات (Completed 30/30)
- **سناریوهای تکمیل‌شده:** ۳۰ از ۳۰ (۳۰/۳۰)
- **سناریوهای باقی‌مانده:** ۰ سناریو
- **دامنه‌های پوشش‌داده‌شده تاکنون:** دامنه A (فاکتور و فروش)، دامنه B (اشتراک و لایسنس)، دامنه C (کالا و انبار)، دامنه D (صندوق، دریافت و پرداخت)، دامنه E (حسابداری، مشتریان، بدهی)، دامنه F (آفلاین، همگام‌سازی، چنددستگاهی)، دامنه G (برگشت از خرید و فروش، حقوق و دستمزد، تفکیک وظایف و امنیت)
- **موانع و بلاکرهای ثبت‌شده:** هیچ مانعی وجود ندارد؛ ۳۰ سناریوی واقعی و مستند با ارجاع دقیق به خطوط سورس کد تکمیل شدند.

---

## ۳. شرح سناریوهای کشف‌شده (Scenarios 01 – 30)

---

### Scenario 01 — فروش هم‌زمان کالای با موجودی ناکافی و ایجاد کسری منفی بدون ثبت بهای تمام‌شده در دفتر کل

- **Module:** Invoices & Stock (`InvoiceService` / `CostingService`)
- **User Action:** دو کاربر یا صندوق‌دار در دو شعبه مختلف، هم‌زمان آخرین واحد موجودی یک کالا را در فاکتور فروش ثبت کرده و دکمه ذخیره فاکتور را می‌زنند.
- **Trigger:** وقوع هم‌زمانی (Race Condition) روی موجودی انبار بدون قفل سطری پیشین (`pessimistic lock`) یا بررسی مانع موجودی منفی در سطح پایگاه داده.
- **Expected Behavior:** سامانه باید با اعمال قفل سطری، تراکنش دوم را با خطای کمبود موجودی (`INSUFFICIENT_STOCK`) متوقف کند یا به کاربر هشدار دهد و از ایجاد فاکتور دوم بدون تأیید جلوگیری نماید.
- **Observed/Risky Behavior:** بر اساس طراحی فاز C در سورس کد، سیستم کسری موجودی را متوقف نمی‌کند، بلکه مقدار منفی را مستقیماً در `stock_movements` ثبت می‌کند (`negative stock is permitted as information`). اما در مرحله بعد (`applyCosting`)، خطای `INVENTORY_INSUFFICIENT_STOCK` رخ داده و فاکتور فروش بدون بهای تمام‌شده کالای فروش‌رفته (COGS = 0) در دفتر کل ثبت می‌شود. در نتیجه، سود ناخالص فاکتور ۱۰۰٪ شناسایی شده و حساب دارایی موجودی کالا در ترازنامه با قفسه فیزیکی مغایر می‌گردد.
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 88 — فروش بیش از موجودی منجر به تحریف سودآوری و صفر شدن COGS در دفاتر مالی می‌گردد.
- **Affected Data:** جدول‌های `stock_movements`, `invoices`, `journal_entries`, `journal_lines`, `cost_consumptions`
- **Code Evidence:**
  - `backend/src/services/invoice.service.ts:2660-2668`: ثبت حرکت انبار بدون بررسی موجودی و مجاز شمردن موجودی منفی.
  - `backend/src/services/invoice.service.ts:2990-2997`: بلعیدن خطای کسری موجودی و اضافه کردن به آرایه `uncosted` به جای بازگشت تراکنش.
  - `backend/src/services/invoice.service.ts:1306-1311`: ثبت فاکتور در دفتر کل بدون بهای تمام‌شده با یک هشدار در لاگ کنسول.
- **Execution Path:** `POST /api/invoices` → `InvoiceService.create` → `planStockMovements` → `writeInvoiceDocument` (RPC) → `applyCosting` → catch `INVENTORY_INSUFFICIENT_STOCK` → `createAccountingEntries` with COGS=0.
- **Related Tests:**
  - موجود: `backend/src/__tests__/product-stock-edit.test.ts`
  - مفقود: تستی که هم‌زمانی دو فاکتور فروش روی ۱ قلم کالا و بررسی وضعیت خطوط سند حسابداری ناشی از آن را بسنجد.
- **Reproduction Steps:**
  1. کالایی با موجودی ۱ عدد تعریف کنید.
  2. هم‌زمان دو درخواست `POST /api/invoices` برای فروش ۱ عدد از آن کالا ارسال کنید.
  3. مشاهده می‌شود هر دو فاکتور صادر شده، موجودی کالا ۱- می‌شود و سند حسابداری فاکتور دوم بدون آرتیکل بستانکار موجودی کالا ثبت می‌شود.
- **Business Impact:** ناترازی سود و زیان، گزارش اشتباه سود ۱۰۰٪ برای کالای فروخته‌شده، مغایرت انبار فیزیکی با ارزش ریالی انبار در ترازنامه.
- **Recommendation:** افزودن فلگ سیستمی `allow_negative_stock` در سطح تنظیمات کسب‌وکار و اعمال قفل سطری `SELECT ... FOR UPDATE` روی موجودی انبار در صورت عدم مجوز موجودی منفی.

---

### Scenario 02 — ارسال مجدد فاکتور در اثر تأخیر شبکه یا کلیک دوبار کاربر (Double Click) و صدور فاکتور تکراری

- **Module:** Invoices (`InvoiceService` / `POST /api/invoices`)
- **User Action:** کاربر پس از پر کردن فرم فاکتور دکمه «ثبت فاکتور» را می‌زند، پاسخ سرور به دلیل کندی شبکه بیش از ۵ ثانیه طول می‌کشد و کاربر دوباره روی دکمه کلیک می‌کند (یا درخواست شبکه دوباره ارسال می‌شود).
- **Trigger:** عدم ارسال هدر `Idempotency-Key` / `clientRequestId` توسط برخی کلاینت‌ها یا کلاینت‌های متفرقه/یکپارچه‌ساز API.
- **Expected Behavior:** سرور با بررسی یکتایی یا کلید شناسه کلاینت، درخواست دوم را نادیده گرفته و همان فاکتور اول را برگرداند.
- **Observed/Risky Behavior:** اگر درخواست فاقد `clientRequestId` باشد (یا در محیط وب کلید تصادفی در هر کلیک تولید شود)، خطوط ۸۱۰-۸۱۳ رد شده و تابع `generateInvoiceNumber` یک شماره فاکتور جدید اختصاص می‌دهد و فاکتور دوم را با تمام آثار مالی، کسر مجدد موجودی انبار و ثبت مجدد سند دوبار صادر می‌کند.
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 82 — ثبت دوبل فاکتور مشتری و بدهکار شدن مضاعف خریدار و کسر غیرواقعی کالا.
- **Affected Data:** جدول‌های `invoices`, `invoice_items`, `stock_movements`, `journal_entries`, `journal_lines`
- **Code Evidence:**
  - `backend/src/services/invoice.service.ts:810-813`: شرط بررسی تکرار فقط در صورت وجود `clientRequestId` اجرا می‌شود.
  - `backend/src/services/invoice.service.ts:1093-1094`: ستون `client_request_id` فقط زمانی ذخیره می‌شود که کلاینت آن را صراحتاً ارسال کرده باشد.
- **Execution Path:** `POST /api/invoices` → `InvoiceService.create` → `if (clientRequestId)` (false) → `generateInvoiceNumber` → `writeInvoiceDocument`.
- **Related Tests:**
  - موجود: `backend/src/__tests__/http-migration-stock.test.ts`
  - مفقود: تست عدم ارسال `clientRequestId` و شبیه‌سازی دو درخواست یکسان با محتوای همسان.
- **Reproduction Steps:**
  1. دو درخواست HTTP POST با بدنه یکسان بدون هدر `Idempotency-Key` به `/api/invoices` بفرستید.
  2. هر دو درخواست با کد 201 پاسخ داده شده و دو فاکتور مجزا ثبت می‌گردد.
- **Business Impact:** دوبار کسر شدن کالا از قفسه، دوبار بدهکار شدن مشتری، مغایرت فاکتور با واقعیت خرید مشتری.
- **Recommendation:** الزامی کردن هدر `Idempotency-Key` در اسکیما اعتبارسنجی `createInvoiceSchema` یا تولید هش قطعی از محتویات بدنه فاکتور (`customerId + total + items + date`) برای جلوگیری از ثبت تکراری ظرف ۶۰ ثانیه.

---

### Scenario 03 — اجرای ناهمگام و فاقد Await ثبت بهای تمام‌شده و سند حسابداری فاکتور (Detached Promise Drift)

- **Module:** Invoices & Accounting Ledger (`InvoiceService.create`)
- **User Action:** کاربر فاکتور فروش را ذخیره می‌کند و پیام موفقیت دریافت می‌کند.
- **Trigger:** اجرای متد `this.applyCosting(...)` در خط ۱۲۷۱ فایل `invoice.service.ts` بدون دستور `await` به صورت یک زنجیره Promise مستقل (`detached Promise`).
- **Expected Behavior:** سرور باید قبل از برگرداندن پاسخ به کاربر و قبل از نهایی شدن وضعیت فاکتور، سند حسابداری و بهای تمام‌شده را به صورت کامل و مطمئن در دیتابیس ثبت نموده باشد.
- **Observed/Risky Behavior:** در خط ۱۲۷۱، متد `applyCosting` بدون `await` فراخوانی می‌شود و بلافاصله خطوط بعدی اجرا شده و فاکتور از دیتابیس خوانده شده و به کاربر بازگردانده می‌شود (`return created` در خط ۱۳۵۳). اگر در حین اجرای پس‌زمینه کدهای خطوط ۱۲۷۱ تا ۱۳۱۳، پردازش نود (Node.js) ری‌استارت شود یا سرور کرش کند، یا خطایی در سطح دفتر کل رخ دهد، فاکتور در وضعیت `document_status = null/draft` باقی می‌ماند، کالا از انبار کم شده اما هیچ سندی در دفتر کل ثبت نمی‌شود!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `CRITICAL`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 92 — نقص در هسته همزمانی، ایجاد فاکتورهای بی‌سند (Orphan Invoices) در صورت بروز خطای پس‌زمینه یا خاموشی سرور.
- **Affected Data:** جدول‌های `invoices` (ستون `document_status`), `journal_entries`, `journal_lines`
- **Code Evidence:**
  - `backend/src/services/invoice.service.ts:1271-1313`:
    ```typescript
    this.applyCosting(ctx, invoice.id, String(data.type ?? 'sale'), lines, data.date, uncosted, exchangeRate)
      .then((cogs) => this.createAccountingEntries(...))
      .then((result) => result.status === 'posted' ? this.markPosted(ctx, invoice.id) : undefined)
      .catch((err) => console.error('Accounting entry failed:', err))
    ```
  - `backend/src/services/invoice.service.ts:1353`: بازگرداندن نتیجه به کلاینت بدون انتظار برای اتمام زنجیره ثبت دفتر کل.
- **Execution Path:** `InvoiceService.create` → `writeInvoiceDocument` (commit) → `this.applyCosting(...)` (no await) → `return created`.
- **Related Tests:**
  - موجود: تست‌های واحد پایه‌ای صدور فاکتور
  - مفقود: تست قطع شدن یا تأخیر عمدی در `createAccountingEntries` و اعتبارسنجی همگام بودن پاسخ با وضعیت سند حسابداری.
- **Reproduction Steps:**
  1. در متد `createAccountingEntries` یک تأخیر ۲ ثانیه‌ای شبیه‌سازی کنید.
  2. فاکتور صادر کنید؛ پاسخ در کمتر از ۱۰۰ میلی‌ثانیه برمی‌گردد در حالی که سند هنوز وجود ندارد.
  3. در صورت پرتاب خطا در `createAccountingEntries`، خطا تنها در کنسول چاپ شده و فاکتور بدون سند باقی می‌ماند.
- **Business Impact:** ناترازی دفاتر کل با فروش، نامرئی شدن فروش در گزارش‌های سود و زیان و تراز آزمایشی، غیرقابل اعتماد شدن گزارش‌های مالی.
- **Recommendation:** تبدیل صریح فراخوانی به `const cogs = await this.applyCosting(...)` و `await this.createAccountingEntries(...)` قبل از بازگرداندن پاسخ فاکتور.

---

### Scenario 04 — حذف یا ابطال فاکتور خریدی که کالا‌های آن قبلاً مصرف یا فروخته شده‌اند (Orphan Cost Layer Desync)

- **Module:** Invoices & Costing (`InvoiceService.delete` / `reverseEffects`)
- **User Action:** کاربر یک فاکتور خرید (Purchase Invoice) را که قبلاً ثبت کرده بود، به دلیل اشتباه در قیمت یا توافق با تأمین‌کننده حذف می‌کند.
- **Trigger:** اجرای عملیات `delete` روی فاکتور خرید در حالی که کالاهای آن فاکتور قبلاً در فاکتورهای فروش بعدی مصرف شده‌اند یا لایه‌های هزینه آن باز مانده‌اند.
- **Expected Behavior:** سامانه باید یا اجازه حذف فاکتور خریدی که لایه‌های آن مصرف شده را ندهد، یا یک بازسنجی بهای تمام‌شده (Cost Revaluation) برای فروش‌های بعدی ایجاد کند.
- **Observed/Risky Behavior:** در متد `reverseEffects`، حرکت معکوس انبار ثبت می‌شود (`reversalOfRecordedMovements` در خط ۱۸۱۸) و موجودی انبار کسر می‌گردد، اما صراحتاً در مستندات کد (خط ۱۸۲۴-۱۸۲۶) آمده است:
  «A purchase's own layers are NOT unwound here — later sales may already have drawn from them, which is a revaluation and not a release»
  در نتیجه، لایه‌های هزینه خرید در جدول `cost_layers` با باقی‌مانده مثبت باقی می‌مانند در حالی که موجودی فیزیکی در `stock_movements` منفی/کسر شده است! این موضوع باعث ایجاد شکاف دائمی میان موجودی فیزیکی و لایه‌های بهای تمام‌شده می‌گردد.
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 85 — فساد دائمی در محاسبات بهای تمام‌شده (FIFO/AVCO) و ایجاد لایه‌های هزینه بدون پشتوانه فیزیکی.
- **Affected Data:** جدول‌های `cost_layers`, `stock_movements`, `invoices`
- **Code Evidence:**
  - `backend/src/services/invoice.service.ts:1824-1829`:
    ```typescript
    // A sale's consumed layers get their quantities back. A purchase's own
    // layers are NOT unwound here — later sales may already have drawn from
    // them, which is a revaluation and not a release (same limit as an edit).
    await costing
      .releaseDocument(ctx, 'invoice', invoiceId)
      .catch((err) => console.error('[InvoiceService] cost release failed:', err))
    ```
  - `backend/src/services/inventory-costing/costing.service.ts:126-138`: متد `releaseDocument` فقط `releaseConsumption` را صدا می‌زند و هیچ لایه دریافتی خریدی را لغو نمی‌کند.
- **Execution Path:** `DELETE /api/invoices/:id` → `InvoiceService.delete` → `reverseEffects` → `costing.releaseDocument` (تنها مصرف‌ها برگشت داده می‌شود و لایه‌های خرید دست‌نخورده می‌ماند).
- **Related Tests:**
  - موجود: `backend/src/__tests__/inventory-costing-rules.test.ts`
  - مفقود: تست حذف فاکتور خرید و ارزیابی تطابق مجموع `cost_layers.remaining_qty` با `products.quantity`.
- **Reproduction Steps:**
  1. یک فاکتور خرید با ۱۰ عدد کالا ثبت کنید.
  2. فاکتور خرید را حذف کنید.
  3. مشاهده می‌شود موجودی کالا به صفر برمی‌گردد اما لایه هزینه خرید با باقی‌مانده ۱۰ عدد در دیتابیس زنده می‌ماند.
- **Business Impact:** اعوجاج جدی در ارزش‌گذاری آتی انبار، فروش رفتن کالاهای بعدی با بهای فاکتور خرید حذف‌شده، ناترازی ترازنامه انبار.
- **Recommendation:** ممانعت قطعی از حذف فاکتور خرید در صورت مصرف شدن لایه‌ها (`INVOICE_PURCHASE_ALREADY_CONSUMED`) و بازگردانی لایه‌های دست‌نخورده در صورت عدم مصرف.

---

### Scenario 05 — مغایرت گردکردن اقلام ارزی در فاکتور چندارزی میان سرجمع و سطور و ناترازی تراز آزمایشی

- **Module:** Validation & Invoice Math (`computeInvoiceMoney` / `majorToTillMinor` / `round2`)
- **User Action:** کاربر یک فاکتور فروش چندارزی (مثلاً دلاری یا یورویی در دفتری با واحد پول افغانی یا ریال) با چندین ردیف کالا که قیمت‌ها دارای ارقام اعشاری هستند صادر می‌کند.
- **Trigger:** تفاوت الگوریتم گردکردن در سطح هر سطر (`withDerivedLineTotals`) با گردکردن سرجمع هدر (`computeInvoiceMoney`) در ارزهای دارای نرخ تسعیر غیررند.
- **Expected Behavior:** سرجمع ریالی بستانکار فروش دقیقاً برابر با سرجمع بدهکار حساب دریافتنی باشد و هیچ کسری ریالی/تومانی در آرتیکل سند باقی نماند.
- **Observed/Risky Behavior:** در خطوط ۸۶۲-۸۶۹ فایل `invoice.service.ts`، ابتدا هر سطر در واحد پول فاکتور گرد می‌شود (`withDerivedLineTotals`). سپس در زمان تسعیر به واحد پول پایه برای سند حسابداری (`exchangeRate`)، اعمال ضرب نرخ بر روی مبالغ سطرها و سرجمع فاکتور، به دلیل خطای ممیز شناور IEEE-754 و توابع `round2`، تا ۱ واحد جزئی (مثلاً ۱ افغانی یا ۱ سنت) اختلاف ایجاد می‌کند و خطای `JOURNAL_ENTRY_UNBALANCED` پرتاب شده و کل صدور سند با شکست مواجه می‌شود.
- **Status:** `POTENTIAL_RISK`
- **Severity:** `MEDIUM`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 72 — شکست غیرمنتظره در ثبت فاکتورهای ارزی یا خطای تراز نبودن سند حسابداری.
- **Affected Data:** جدول‌های `invoices`, `journal_lines`
- **Code Evidence:**
  - `backend/src/services/invoice.service.ts:862-869`:
  - `packages/validation/src/schemas/invoice-math.ts:255-310`: تفاوت در تقدم و تاخر اعمال تخفیف و گردکردن اعشار در اقلام.
  - `packages/validation/src/schemas/money.ts:45-48`: تابع `round2` که خطای شناور دارد: `round2(1.005) === 1` به جای `1.01`.
- **Execution Path:** `InvoiceService.create` → `withDerivedLineTotals` → `computeInvoiceMoney` → `createAccountingEntries` → `postDocument` (بررسی تراز بودن بدهکار و بستانکار).
- **Related Tests:**
  - موجود: `packages/validation/src/__tests__/money-primitive-guard.test.ts`
  - مفقود: فاکتور ارزی با ۱۰ سطر اعشاری و بررسی عدم وقوع خطای تراز در نرخ تسعیر نامتعارف مثل ۷۱.۴۵.
- **Reproduction Steps:**
  1. فاکتوری با سه ردیف کالا به مبلغ ۱.۳۳۵ دلار با نرخ تسعیر ۷۱.۲۵ ثبت کنید.
  2. جمع خطوط با جمع کل در تبدیل به ارز پایه به اندازه ۱ واحد خرد اختلاف پیدا کرده و سبب عدم توازن سند می‌شود.
- **Business Impact:** توقف عملیات فروش چندارزی برای کاربر و خطای سرور ۵۰۰ هنگام صدور فاکتور.
- **Recommendation:** استفاده از حساب «تفاوت تسعیر ارز / کسورات گردکردن» (`rounding_difference`) برای متعادل‌سازی خودکار کسرهای کمتر از یک واحد خرد در اسناد چندارزی.

---

### Scenario 06 — دور زدن انقضای لایسنس آفلاین از طریق دستکاری ساعت سیستم در پروفایل جدید (Offline Clock Rollback Vulnerability)

- **Module:** Offline Licensing (`verifyOfflineLicense`)
- **User Action:** کاربر نرم‌افزار دسکتاپ را روی سیستمی نصب کرده که لایسنس آفلاین آن در تاریخ ۲۰۲۶-۱۰-۰۱ منقضی شده است. کاربر تاریخ و ساعت سیستم‌عامل ویندوز را به ۲۰۲۵-۰۱-۰۱ به عقب برمی‌گرداند یا نرم‌افزار را در پروفایل جدید/پس از پاک کردن کش اجرا می‌کند.
- **Trigger:** اجرای تابع `verifyOfflineLicense` زمانی که متغیر `options.highestSeenAt` خالی یا `null` باشد (مثلاً در اولین اجرا، کلون کردن دیسک یا پس از حذف دیتابیس محلی).
- **Expected Behavior:** سامانه باید تاریخ انقضا را با یک منبع زمان سخت‌افزاری غیرقابل تغییر (مانند TPM، وضعیت امن رجیستری یا زمان ساخت لایسنس `issued_at`) بسنجد و در صورت عقب‌تر بودن زمان فعلی از زمان صدور لایسنس، اعتبار را رد کند.
- **Observed/Risky Behavior:** در خطوط ۳۳۲-۳۵۴ فایل `offline-license.ts`:
  اگر `options.highestSeenAt` برابر با `null` باشد، مقدار `effectiveNowMs` مستقیماً از زمان جاری سیستم (`nowMs`) برداشته می‌شود. اگر ساعت سیستم به قبل از زمان انقضا کشیده شود، شرط `effectiveNowMs >= expiresAtMs` منفی شده و لایسنس منقضی‌شده با وضعیت `verdict: 'VALID'` تأیید می‌شود و برنامه بدون محدودیت به کار خود ادامه می‌دهد! علاوه بر این، هیچ بررسی وجود ندارد که آیا `nowMs` قبل از `issued_at` است یا خیر!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 84 — آسیب‌پذیری قطعی در حفاظت از حقوق تجاری و لایسنس نسخه آفلاین نرم‌افزار.
- **Affected Data:** لایسنس آفلاین، مجوز دسترسی به سامانه دسکتاپ
- **Code Evidence:**
  - `packages/validation/src/schemas/offline-license.ts:332-354`:
    ```typescript
    if (options.highestSeenAt != null) { ... }
    const effectiveNowMs = options.highestSeenAt != null
      ? Math.max(nowMs, new Date(options.highestSeenAt).getTime() || 0)
      : nowMs
    const expiresAtMs = new Date(payload.expires_at).getTime()
    if (Number.isNaN(expiresAtMs) || effectiveNowMs >= expiresAtMs) { ... }
    ```
- **Execution Path:** `verifyOfflineLicense` → بررسی `highestSeenAt` (که نال است) → مقایسه زمان دستکاری‌شده سیستم با زمان انقضا → بازگرداندن `VALID`.
- **Related Tests:**
  - موجود: `packages/validation/src/__tests__/offline-license.test.ts`
  - مفقود: تستی که `highestSeenAt: null` داده و ساعت سیستم را به ۲ سال قبل تنظیم کند و رد شدن لایسنس را انتظار داشته باشد.
- **Reproduction Steps:**
  1. یک لایسنس با انقضای دیروز صادر کنید.
  2. ساعت ویندوز را به یک ماه قبل تغییر دهید و نرم‌افزار را اجرا کنید (بدون تاریخچه قبلی).
  3. تابع `verifyOfflineLicense` مقدار `valid: true` برمی‌گرداند.
- **Business Impact:** امکان استفاده نامحدود و رایگان از نرم‌افزار پولی بدون تمدید اشتراک.
- **Recommendation:** اعتبارسنجی اینکه زمان سیستم نباید قبل از `payload.issued_at` باشد (`nowMs < new Date(payload.issued_at).getTime() - toleranceMs`) و ذخیره امن زمان آخرین اجرا در چندین لایه سیستمی.

---

### Scenario 07 — قفل شدن آنی محیط کاری پس از پرداخت تمدید اشتراک منقضی‌شده (Expired Renewal Dead-Lock)

- **Module:** Subscriptions & Billing (`BillingService.extendSubscriptionRow` / `subscription.middleware`)
- **User Action:** کسب‌وکاری که اشتراک آن ۲ ماه قبل منقضی شده بود، وارد پنل شده و هزینه ۱ ماه تمدید را پرداخت می‌کند.
- **Trigger:** متد `extendSubscriptionRow` مدت ۱ ماه جدید را به تاریخ انقضای قدیمی (`current.period_end`) اضافه می‌کند، نه به زمان فعلی (`Date.now()`).
- **Expected Behavior:** با پرداخت هزینه ۱ ماه، زمان انقضای اشتراک باید از همین امروز به مدت ۳۰ روز تمدید شود (`Math.max(Date.now(), current.period_end) + 1 month`).
- **Observed/Risky Behavior:** در خطوط ۶۵۴-۶۵۵ فایل `billing.service.ts`:
  ```typescript
  const newPeriodEnd = new Date(current.period_end)
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)
  ```
  اگر اشتراک در تاریخ ۲۰۲۶-۰۸-۰۱ منقضی شده باشد و کاربر در ۲۰۲۶-۱۰-۳۱ پول واریز کند، تاریخ انقضای جدید برابر با ۲۰۲۶-۰۹-۰۱ ثبت می‌شود! بلافاصله در اولین درخواست بعدی، میدلور `subscription.middleware.ts` تاریخ انقضا را با امروز مقایسه کرده و با خطای HTTP 402 `SUBSCRIPTION_EXPIRED` تمام درخواست‌های کاربر را مسدود می‌کند! کاربر پول داده اما سیستم همچنان منقضی است!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `CRITICAL`
- **Likelihood:** `HIGH`
- **Priority Score:** 95 — دریافت وجه از مشتری و قفل ماندن دسترسی وی، منجر به نارضایتی فوری و بی‌اعتمادی مشتریان.
- **Affected Data:** جدول `subscriptions` (ستون‌های `period_end` و `status`)
- **Code Evidence:**
  - `backend/src/services/billing.service.ts:654-663`: اضافه کردن ماه به `current.period_end` قدیمی بدون در نظر گرفتن تاریخ امروز.
  - `backend/src/middleware/subscription.middleware.ts:107-115`: مقایسه `access.periodEnd` با زمان حال و ریجکت با کد 402.
- **Execution Path:** `POST /api/billing/renew` → `BillingService.extendSubscriptionRow` → `newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)` → نوشتن در دیتابیس → درخواست بعدی به `/api/invoices` → `rejectIfSubscriptionExpired` → 402 SUBSCRIPTION_EXPIRED.
- **Related Tests:**
  - موجود: `backend/src/__tests__/subscription-expiry-lock.test.ts`
  - مفقود: تست تمدید اشتراکی که بیش از ۳۰ روز از انقضای آن گذشته است.
- **Reproduction Steps:**
  1. در جدول `subscriptions` رکورد فعلی را با `period_end: '2026-06-01'` قرار دهید.
  2. متد `extendSubscriptionRow` را فراخوانی کنید.
  3. تاریخ جدید برابر با `2026-07-01` ذخیره شده و متد `getWorkspaceAccess` مقدار `expired: true` برمی‌گرداند.
- **Business Impact:** کسر وجه از حساب مشتری، عدم فعال‌سازی اشتراک، توقف کسب‌وکار مشتری، حجم بالای تیکت پشتیبانی و ادعای کلاهبرداری.
- **Recommendation:** محاسبه تاریخ انقضای جدید بر مبنای بیشینه تاریخ جاری و تاریخ قبلی:
  `const baseDate = Math.max(Date.now(), new Date(current.period_end).getTime()); const newPeriodEnd = new Date(baseDate); newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);`

---

### Scenario 08 — رقابت هم‌زمانی در تمدید اشتراک و سوخت شدن دوره تمدید (Subscription Renewal Race Condition)

- **Module:** Billing & Subscriptions (`BillingService.extendSubscriptionRow`)
- **User Action:** کاربر دو بار روی دکمه تمدید در درگاه یا پنل کلیک می‌کند، یا وب‌هوک درگاه پرداخت دو درخواست هم‌زمان ارسال می‌کند.
- **Trigger:** خواندن و سپس نوشتن ناامن (`read-modify-write`) در `extendSubscriptionRow` بدون قفل سطری و بدون کلید یکتایی در اسکریپت تمدید.
- **Expected Behavior:** یا درخواست دوم رد شود و پول اضافه عودت یابد، یا در صورت پرداخت دو برابری، اشتراک به اندازه ۲ ماه تمدید گردد.
- **Observed/Risky Behavior:** هر دو درخواست هم‌زمان خط ۶۴۶ را می‌خوانند: `current.period_end = 2026-11-01`.
  هر دو درخواست ۱ ماه به آن اضافه می‌کنند: `2026-12-01`.
  هر دو درخواست مقدار `2026-12-01` را آپدیت می‌کنند!
  نتیجه: کاربر هزینه ۲ ماه را از کیف پول پرداخت کرده، اما تاریخ انقضای او فقط ۱ ماه جلو رفته و ۱ ماه پرداخت‌شده ناپدید شده است!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 86 — ضرر مالی مستقیم به مشتری به دلیل عدم وجود مکانیزم هم‌زمانی در تمدید اشتراک.
- **Affected Data:** جدول `subscriptions`, `billing_ledger`, کیف پول
- **Code Evidence:**
  - `backend/src/services/billing.service.ts:644-666`: کوئری `select('period_end')` و سپس `update({ period_end })` به صورت دو تراکنش مجزا بدون قفل یا نسخه ردیف (`optimistic concurrency`).
- **Execution Path:** دو درخواست موازی به `extendSubscriptionRow` → هر دو یک تاریخ را می‌خوانند → هر دو یک تاریخ را می‌نویسند.
- **Related Tests:**
  - موجود: `backend/src/__tests__/admin-04-billing.pg.test.ts`
  - مفقود: تست اجرای هم‌زمان دو تمدید اشتراک با Promise.all.
- **Reproduction Steps:**
  1. دو فراخوانی هم‌زمان `Promise.all([extendSubscriptionRow(id), extendSubscriptionRow(id)])` اجرا کنید.
  2. مشاهده می‌شود تاریخ انقضا به جای ۲ ماه، فقط ۱ ماه افزایش می‌یابد.
- **Business Impact:** سوخت شدن پول کاربر، کسر دو برابری از حساب و ایجاد اختلافات حسابرسی.
- **Recommendation:** اجرای تمدید از طریق تابع اتمیک دیتابیس با قفل سطری یا دستور شرطی:
  `UPDATE subscriptions SET period_end = GREATEST(now(), period_end) + interval '1 month' WHERE id = rowId`

---

### Scenario 09 — پرش ماهانه و تغییر روز ثابت تمدید به دلیل سرریز ماه در جاوااسکریپت (Date Overflow on Month-End Renewal)

- **Module:** Billing & Subscriptions (`BillingService.extendSubscriptionRow`)
- **User Action:** کاربری در تاریخ ۳۱ ژانویه (یا ۳۱ مِی یا ۳۱ آگوست) اشتراک یک‌ماهه خریداری می‌کند.
- **Trigger:** استفاده از تابع بومی جاوااسکریپت `date.setMonth(date.getMonth() + 1)` برای افزایش ماه در تاریخ‌های روز ۳۱ام.
- **Expected Behavior:** تاریخ تمدید در ماه‌های با روز کمتر، به آخرین روز آن ماه (مثلاً ۲۸ یا ۲۹ فوریه، یا ۳۰ام ماه) تنظیم شود و روز پایه تمدید حفظ گردد.
- **Observed/Risky Behavior:** در استاندارد جاوااسکریپت، افزودن ۱ ماه به تاریخ ۳۱ ژانویه:
  ماه فوریه ۳۱ روز ندارد، بنابراین جاوااسکریپت روزهای اضافه را سرریز (Overflow) کرده و تاریخ را به ۲ یا ۳ مارس می‌برد!
  ماه فوریه کلاً دور زده می‌شود! و سپس در ماه بعد، تمدید از ۳ مارس به ۳ آوریل می‌رود و تاریخ ثابت تمدید کاربر از روز ۳۱ام به روز ۳ام ماه تغییر دائمی پیدا می‌کند.
- **Status:** `CONFIRMED_BUG`
- **Severity:** `MEDIUM`
- **Likelihood:** `HIGH`
- **Priority Score:** 76 — سرریز تقویمی در سررسیدهای پایان ماه و جاافتادن روزهای محاسباتی اشتراک.
- **Affected Data:** جدول `subscriptions` (ستون `period_end`)
- **Code Evidence:**
  - `backend/src/services/billing.service.ts:654-655`:
    ```typescript
    const newPeriodEnd = new Date(current.period_end)
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)
    ```
- **Execution Path:** `extendSubscriptionRow` → `new Date('2026-01-31T00:00:00Z')` → `setMonth(1)` → تاریخ تبدیل می‌شود به `2026-03-03`.
- **Related Tests:**
  - موجود: تست‌های کلی صدور اشتراک
  - مفقود: تست تمدید اشتراک در روز ۳۱ ژانویه یا ۳۱ آگوست.
- **Reproduction Steps:**
  1. در نود اجرا کنید: `const d = new Date('2026-01-31'); d.setMonth(d.getMonth() + 1); d.toISOString()`.
  2. مشاهده خروجی: `2026-03-03` به جای `2026-02-28`.
- **Business Impact:** سردرگمی مشتری در تاریخ سررسید، کوتاه یا بلند شدن غیرعادلانه دوره اشتراک در ماه‌های پایان سال.
- **Recommendation:** استفاده از توابع تقویمی استاندارد نظیر `date-fns/addMonths` یا تنظیم روی آخرین روز ماه در صورت سرریز شدن روز:
  `if (newPeriodEnd.getDate() !== originalDate) newPeriodEnd.setDate(0);`

---

### Scenario 10 — مسابقه هم‌زمانی در ابزار ویرایش موجودی انبار (آیکون آچار) و اعوجاج موجودی واقعی (Product Stock Read-Modify-Write Race)

- **Module:** Inventory & Products (`ProductService.update` / Stock Adjustment Tool)
- **User Action:** انباردار قفسه را شمارش کرده و با استفاده از ابزار ویرایش موجودی روی صفحه کالا، عدد موجودی را روی ۴۸ عدد تنظیم می‌کند.
- **Trigger:** وقوع هم‌زمان یک فاکتور فروش یا خروج کالا در فاصله میان خواندن موجودی فعلی توسط متد `update` و درج سطر انبارگردانی در `stock_movements`.
- **Expected Behavior:** موجودی نهایی کالا دقیقاً با مقدار شمارش‌شده فیزیکی توسط انباردار (۴۸ عدد) منطبق شود.
- **Observed/Risky Behavior:** در خطوط ۷۲۳-۷۵۲ فایل `product.service.ts`:
  متد ابتدا با دستور `select('quantity')` مقدار فعلی را می‌خواند (مثلاً ۵۰).
  سپس تفاضل را محاسبه می‌کند: `delta = 48 - 50 = -2`.
  سپس در `stock_movements` یک سطر با `quantity = -2` درج می‌کند.
  اگر درست در همین لحظه یک صندوق‌دار ۱۰ عدد از این کالا را در فاکتور بفروشد (موجودی دیتابیس ۴۰ شود):
  تفاضل ۲- اعمال شده و موجودی نهایی به جای ۴۸، به ۳۸ تبدیل می‌شود!
  در نتیجه شمارش دقیق انباردار نابود شده و سیستم عدد اشتباه نمایش می‌دهد.
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 83 — شکست در انبارگردانی و مغایرت بین قفسه واقعی با موجودی کاردکس انبار در صورت هم‌زمانی با فروش.
- **Affected Data:** جدول‌های `products`, `stock_movements`
- **Code Evidence:**
  - `backend/src/services/product.service.ts:723-752`: الگوی کلاسیک Read-Modify-Write بدون هیچ‌گونه قفل بدبینانه (`FOR UPDATE`) یا بررسی شرطی در درج.
- **Execution Path:** `PATCH /api/products/:id` → `ProductService.update` → خواندن موجودی → محاسبه دلتا در حافظه نود → درج دلتا در `stock_movements`.
- **Related Tests:**
  - موجود: `backend/src/__tests__/product-stock-edit.test.ts` (این تست فقط تبدیل عدد را در حالت ایزوله تست می‌کند، نه هم‌زمانی با فروش را).
  - مفقود: تست ارسال هم‌زمان یک فاکتور فروش و یک تنظیم موجودی انبار روی همان کالا.
- **Reproduction Steps:**
  1. کالایی با ۵۰ عدد موجودی در نظر بگیرید.
  2. هم‌زمان یک درخواست تنظیم موجودی روی ۴۸ و یک فاکتور فروش ۱۰ عددی ارسال کنید.
  3. موجودی نهایی ۳۸ می‌شود در صورتی که انباردار رسماً شمارش فیزیکی ۴۸ را تایید کرده بود.
- **Business Impact:** کسری یا سرک غیرواقعی انبار، گمراه شدن حسابداران در انبارگردانی دوره‌ای.
- **Recommendation:** پیاده‌سازی انبارگردانی به صورت تراکنش اتمیک دیتابیسی با دریافت مستقیم مقدار هدف و اعمال قفل سطری روی کالا:
  `PERFORM ... FROM products WHERE id = p_id FOR UPDATE;`

---

### Scenario 11 — پذیرش عدد منفی در ابزار ویرایش موجودی کالا و ایجاد موجودی اولیه منفی فسادزا (Negative Quantity Acceptance in Stock Tool)

- **Module:** Inventory & Products (`ProductService.update`)
- **User Action:** کاربر یا اپراتور در ابزار تنظیم موجودی صفحه کالا، به اشتباه یا برای صفر کردن کسری عدد منفی (مثلاً ۵۰-) را وارد کرده و دکمه تایید را می‌زند.
- **Trigger:** عدم وجود اعتبارسنجی نامنفی بودن مقدار هدف (`target >= 0`) در متد `ProductService.update`.
- **Expected Behavior:** سرور باید با خطای اعتبارسنجی ۴۰۰ (`PRODUCT_QUANTITY_NON_NEGATIVE`) مانع از ذخیره مقدار منفی در موجودی هدف شود.
- **Observed/Risky Behavior:** در خطوط ۷۱۹-۷۲۲ فایل `product.service.ts`:
  ```typescript
  if (quantityTarget !== undefined) {
    const target = Number(quantityTarget)
    if (!Number.isFinite(target)) throw new ValidationError('PRODUCT_QUANTITY_INVALID')
  ```
  تنها معتبر بودن عدد (`isFinite`) چک می‌شود و هیچ شرطی برای `target >= 0` وجود ندارد!
  اگر کاربر عدد ۵۰- وارد کند، تفاضل بر مبنای عدد منفی محاسبه شده و رکوردی در `stock_movements` با نوع `adjustment` ثبت می‌شود و موجودی کالا مستقیماً منفی می‌گردد، بدون اینکه هیچ فاکتور فروش یا سندی پشت آن باشد!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `MEDIUM`
- **Likelihood:** `HIGH`
- **Priority Score:** 78 — امکان ثبت موجودی دستی منفی و ایجاد ناسازگاری بنیادی در کاردکس انبار.
- **Affected Data:** جدول‌های `products`, `stock_movements`
- **Code Evidence:**
  - `backend/src/services/product.service.ts:719-722`: فقدان گارد `target < 0`.
  - `packages/validation/src/schemas/product.schema.ts`: در اسکیما پچ محصول، `quantity` به عنوان عدد اختیاری تعریف شده و بررسی `.nonnegative()` ندارد.
- **Execution Path:** `PATCH /api/products/:id` با بدنه `{ quantity: -10 }` → `ProductService.update` → گذر از گارد `isFinite` → درج حرکت انبار منفی.
- **Related Tests:**
  - موجود: `backend/src/__tests__/product-stock-edit.test.ts` (در خط ۶ تست می‌گوید `-98 -> 99` اما حالت منفی را بررسی نمی‌کند).
  - مفقود: تست اعتبارسنجی رد عدد منفی در ویرایش موجودی.
- **Reproduction Steps:**
  1. درخواست `PATCH /api/products/:id` با `{ quantity: -20 }` ارسال کنید.
  2. درخواست با کد 200 موافقت شده و موجودی کالا به ۲۰- تغییر می‌یابد.
- **Business Impact:** تخریب پایگاه داده انبار، مغایرت فیزیکی غیرقابل توجیه در کاردکس، خطاهای بعدی در انبارگردانی.
- **Recommendation:** افزودن بررسی صریح `if (target < 0) throw new ValidationError('PRODUCT_QUANTITY_NON_NEGATIVE')`.

---

### Scenario 12 — افزایش موجودی کالا از طریق ابزار آچار بدون ایجاد لایه هزینه و عدم ثبت سند در دفتر کل (Unvalued Stock Creation)

- **Module:** Inventory & Costing (`ProductService.update` / `CostingService`)
- **User Action:** کاربر از طریق صفحه کالا و ابزار آچار، موجودی یک محصول را از ۰ به ۱۰۰ عدد افزایش می‌دهد (مثلاً کالایی که پیدا شده یا بدون فاکتور خرید وارد انبار شده است).
- **Trigger:** متد `ProductService.update` تنها یک رکورد در `stock_movements` می‌زند و هیچ فراخوانی به `costing.recordReceipt` یا `ledger.postDocument` ندارد.
- **Expected Behavior:** با افزایش موجودی انبار، بهای واحد کالا استعلام شده و یک لایه هزینه (`cost_layer`) ایجاد شود و حساب موجودی کالا (بدهکار) و حساب تعدیل انبار / مازاد موجودی (بستانکار) در دفتر کل ثبت گردد.
- **Observed/Risky Behavior:** در خطوط ۷۴۲-۷۵۶ فایل `product.service.ts`، موجودی به ۱۰۰ تغییر می‌یابد، اما هیچ لایه هزینه‌ای در `cost_layers` ایجاد نمی‌شود و هیچ سندی در دفتر کل ثبت نمی‌گردد!
  این ۱۰۰ واحد کالا در پایگاه داده «کالای فاقد ارزش» (`unvalued stock`) نامیده می‌شوند. در نتیجه، زمانی که کاربر فاکتور فروشی برای این کالاها صادر کند، متد `applyCosting` خطای `INVENTORY_INSUFFICIENT_STOCK` داده، کالا را در آرایه `uncosted` قرار می‌دهد و فاکتور فروش را با بهای تمام‌شده صفر (COGS = 0) در دفتر کل ثبت می‌کند!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 87 — ایجاد شکاف بنیادی میان موجودی فیزیکی و دفاتر کل و صفر شدن بهای تمام‌شده در فروش‌های بعدی.
- **Affected Data:** جدول‌های `cost_layers`, `journal_entries`, `journal_lines`, `stock_movements`
- **Code Evidence:**
  - `backend/src/services/product.service.ts:742-756`: درج سطر بدون صدا زدن سرویس کاستینگ و لجر.
  - `backend/src/services/invoice.service.ts:2934-2938`: یادداشت صریح در سورس کد مبنی بر اینکه موجودی اضافه شده از طریق ادیت دستی لایه هزینه ندارد و فروش آن باعث خالی ماندن بهای تمام‌شده در دفتر کل می‌شود.
- **Execution Path:** `PATCH /api/products/:id` (quantity: 100) → `stock_movements` insert → هیچ هزینه‌ای ثبت نمی‌شود → بعداً `InvoiceService.create` → `applyCosting` خطای کمبود لایه می‌دهد → ثبت در دفتر کل با بهای صفر.
- **Related Tests:**
  - موجود: `backend/src/services/inventory-costing/unvalued-stock.domain.ts`
  - مفقود: تست چرخه کامل ویرایش موجودی از طریق صفحه کالا و سپس صدور فاکتور و بررسی سرفصل‌های دفتر کل.
- **Reproduction Steps:**
  1. موجودی کالایی را از طریق ویرایش کالا به ۱۰ افزایش دهید.
  2. بررسی کنید: جدول `cost_layers` خالی است.
  3. فاکتور فروشی برای ۱۰ عدد از این کالا صادر کنید: سند حسابداری فاقد آرتیکل بهای تمام‌شده و کاهش انبار است.
- **Business Impact:** افزایش تصنعی سود در صورت‌های مالی، مغایرت ترازنامه با موجودی فیزیکی انبار.
- **Recommendation:** ملزم کردن کاربر به مشخص کردن بهای هر واحد در ابزار تعدیل، ایجاد لایه هزینه در `cost_layers` و صدور خودکار سند تعدیل انبار در دفتر کل.

---

### Scenario 13 — انتقال بین انبارها بدون انتقال لایه‌های هزینه و مسدود شدن فروش در انبار مقصد (Cost Layer Warehouse Trapping)

- **Module:** Warehouse & Costing (`WarehouseService.transferStock` / `inventory_consume_layers`)
- **User Action:** کاربر ۵۰ واحد از یک کالا را از «انبار مرکزی» به «انبار شعبه ۲» منتقل می‌کند (`POST /api/stock-transfers`).
- **Trigger:** متد `transferStock` فیزیک کالا را منتقل می‌کند اما لایه‌های هزینه در انبار مبدأ باقی می‌مانند (مطابق کامنت خط ۲۵۰: `A transfer does NOT touch cost layers`).
- **Expected Behavior:** در هنگام فروش در انبار شعبه ۲، بهای تمام‌شده از لایه‌های انتقالی کسر شود و مانعی برای فروش ایجاد نشود.
- **Observed/Risky Behavior:** تابع دیتابیسی `inventory_consume_layers` در خطوط ۱۳۰ و ۱۴۸ فایل `inventory-avco-01-migration.sql` لایه‌ها را بر اساس انبار فیلتر می‌کند:
  `AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse)`
  وقتی فاکتور در انبار شعبه ۲ صادر می‌شود، پارامتر `warehouse_id` انبار شعبه ۲ است. از آنجا که لایه‌های هزینه هنوز در دیتابیس با شناسه «انبار مرکزی» نشاندار شده‌اند، هیچ لایه‌ای برای شعبه ۲ یافت نمی‌شود!
  اگر سیاست انبار `negative_stock = 'block'` باشد، خطای `INVENTORY_INSUFFICIENT_STOCK` صادر شده و فروش در شعبه ۲ متوقف می‌شود با اینکه کالا فیزیکاً در انبار است! و اگر مجاز باشد، با بهای صفر فروخته می‌شود در حالی که انبار مرکزی لایه‌های هزینه‌ای بدون کالای فیزیکی دارد!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `CRITICAL`
- **Likelihood:** `HIGH`
- **Priority Score:** 94 — توقف عملیات فروش چندانباره یا نابودی محاسبات بهای تمام‌شده در انتقال‌های بین‌انباری.
- **Affected Data:** جدول‌های `cost_layers`, `warehouse_stock`, `stock_movements`
- **Code Evidence:**
  - `backend/src/services/warehouse.service.ts:251-253`: مستندات رسمی کد که می‌گوید: «A transfer does NOT touch cost layers: the goods have not been consumed, they have only changed shelf. Their cost travels with them».
  - `docs/inventory-avco-01-migration.sql:130`: کوئری دیتابیس که دقیقاً روی `warehouse_id` فیلتر اکید می‌گذارد.
- **Execution Path:** `POST /api/stock-transfers` → انتقال فیزیکی در `stock_movements` → بعداً `POST /api/invoices` در انبار مقصد → `applyCosting` → `inventory_consume_layers` با انبار مقصد → خطای نبود لایه.
- **Related Tests:**
  - موجود: `backend/src/__tests__/multi-warehouse.test.ts`
  - مفقود: تست انتقال انبار و سپس فروش از انبار مقصد و بررسی موفقیت `consumeLayers`.
- **Reproduction Steps:**
  1. کالایی در انبار الف خریداری کنید (لایه هزینه در انبار الف ایجاد می‌شود).
  2. کالا را به انبار ب منتقل کنید (`transferStock`).
  3. فاکتور فروشی با تعیین انبار ب برای این کالا ثبت کنید.
  4. تابع `inventory_consume_layers` خطای کمبود موجودی برمی‌گرداند زیرا لایه هزینه در انبار الف گیر افتاده است.
- **Business Impact:** ناتوانی شعب در صدور فاکتور از کالاهای انتقالی، از بین رفتن یکپارچگی انبارداری چندشعبه‌ای.
- **Recommendation:** انتقال متناظر ردیف‌های `cost_layers` به شناسه انبار مقصد در زمان تایید `warehouse_transfer_stock`.

---

### Scenario 14 — حذف کالایی که در جدول‌های فرعی نظیر پیش‌فاکتور، فرمول تولید یا گارانتی ردیف دارد (Foreign Key Crash or Orphaned Rows)

- **Module:** Inventory & Products (`ProductService.delete`)
- **User Action:** کاربر کالایی را از سیستم حذف می‌کند (`DELETE /api/products/:id`).
- **Trigger:** متد `ProductService.delete` فقط سه جدول `invoice_items`، `stock_movements` و `cost_layers` را بررسی می‌کند و از سایر ماژول‌ها بی‌اطلاع است.
- **Expected Behavior:** اگر کالا در فرمول ساخت (BOM)، پیش‌فاکتورها، گارانتی یا لیست قیمت شرکت دارد، سامانه از حذف آن جلوگیری کرده و راهنمایی به غیرفعال‌سازی نماید.
- **Observed/Risky Behavior:** در خطوط ۸۰۹-۸۳۴ فایل `product.service.ts`، گارد بررسی فقط برای سه جدول مشخص اجرا می‌شود. اگر کالایی در جدول `bom_components` (فرمول تولید) یا `warranty_claims` یا `price_list_items` استفاده شده باشد، گارد کد جاوااسکریپت عبور می‌کند و دستور `supabase.from('products').delete()` اجرا می‌شود.
  در این لحظه، پایگاه داده یا با خطای کلید خارجی Postgres `23503 foreign key violation` کرش کرده و خطای خام ۵۰۰ به کاربر برمی‌گردد، یا در صورت نبود کلید خارجی، رکوردهای فرعی یتیم (`orphaned rows`) شده و گزارش‌های تولید دچار خطای تجزیه و عدم نمایش می‌گردند.
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `MEDIUM`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 74 — خطای غیرمنتظره سرور یا ایجاد رکوردهای ارجاع‌دهنده به کالای ناموجود در سایر ماژول‌ها.
- **Affected Data:** جدول‌های `products`, `bom_components`, `price_list_items`
- **Code Evidence:**
  - `backend/src/services/product.service.ts:809-834`: لیست ناقص جدول‌های محافظت‌کننده از حذف:
    `const [sold, moved, costed] = await Promise.all([...])`
- **Execution Path:** `DELETE /api/products/:id` → بررسی ناقص گارد → `delete('products')` → برخورد به قید کلید خارجی در سایر جدول‌ها یا یتیم شدن رکوردها.
- **Related Tests:**
  - موجود: تست‌های حذف کالای دارای فاکتور و گردش
  - مفقود: تست حذف کالایی که فقط در فرمول تولید (BOM) تعریف شده است.
- **Reproduction Steps:**
  1. کالایی بسازید و آن را جزء مواد اولیه یک محصول در فرمول ساخت قرار دهید (بدون فاکتور فروش یا انبار).
  2. درخواست حذف کالا را ارسال کنید.
  3. خطا ۵۰۰ برمی‌گردد یا فرمول تولید غیرقابل باز شدن می‌شود.
- **Business Impact:** کرش اپلیکیشن برای کاربر و باقی ماندن ردپای نامعتبر در سایر ماژول‌های سامانه.
- **Recommendation:** افزودن بررسی کلیه ماژول‌های وابسته یا پیشنهاد غیرفعال کردن (`is_active: false`) به جای حذف فیزیکی رکورد.

---

### Scenario 15 — بسته شدن صندوق ارزی بدون ثبت سند حسابداری در دفتر کل و جاافتادن تمام مبالغ در تراز مالی (Foreign Currency Till Ledger Black Hole)

- **Module:** POS & Cashbox (`PosService.closeSession`)
- **User Action:** صندوق‌دار در پایان شیفت، صندوق ارزی خود (مثلاً صندوق دلاری یا تومانی در محیط کاری با واحد پایه افغانی) را شمارش کرده و دکمه بستن شیفت صندوق را می‌زند.
- **Trigger:** اجرای متد `closeSession` بر روی صندوقی که واحد پولی آن با واحد پول پایه دفاتر متفاوت است (`isForeign === true`).
- **Expected Behavior:** مبالغ فروش نقدی ارزی، ورودی‌ها و خروجی‌های صندوق و هرگونه کسری یا اضافه صندوق، با نرخ تسعیر مناسب در دفتر کل ثبت سند شود.
- **Observed/Risky Behavior:** در خطوط ۹۸۲-۹۸۸ فایل `pos.service.ts`:
  ```typescript
  if (isForeign) {
    posted = false
    ledgerResult = { status: 'not_posted', reason: 'POS_FOREIGN_CURRENCY_NOT_IN_LEDGER' }
  } else {
    posted = await this.postSession(ctx, closed, finalTotals)
    ledgerResult = { status: posted ? 'posted' : 'not_posted' }
  }
  ```
  کد صراحتاً در صورت خارجی بودن ارز صندوق، ثبت سند در دفتر کل را کلاً لغو می‌کند (`posted = false`)! صندوق با وضعیت بسته در پایگاه داده ذخیره می‌شود، اما هیچ سندی در دفتر کل ثبت نمی‌شود! تمام دریافت‌های نقدی، واریزی‌ها، برداشت‌ها و مغایرت‌های نقدی صندوق ارزی به کلی در تراز دفاتر مالی مفقود می‌شوند!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `CRITICAL`
- **Likelihood:** `HIGH`
- **Priority Score:** 96 — عدم ثبت کلیه عملیات صندوق ارزی در دفاتر کل مالی؛ مغایرت قطعی ترازنامه با وجوه نقد واقعی صندوق.
- **Affected Data:** جدول‌های `pos_sessions`, `journal_entries`, `journal_lines`
- **Code Evidence:**
  - `backend/src/services/pos/pos.service.ts:982-988`: انصراف کامل از سند زدن برای صندوق‌های ارزی با دلیل `POS_FOREIGN_CURRENCY_NOT_IN_LEDGER`.
- **Execution Path:** `POST /api/pos/sessions/:id/close` → `PosService.closeSession` → بررسی `isForeign` (true) → `posted = false` → برگشت نتیجه بدون درج سند در دفتر کل.
- **Related Tests:**
  - موجود: `backend/src/__tests__/pos-till-currency-http.test.ts`
  - مفقود: تستی که انتظار ثبت سند حسابداری تسعیرشده برای بستن صندوق ارزی را داشته باشد.
- **Reproduction Steps:**
  1. یک صندوق با ارز USD باز کنید و چند فروش نقدی در آن انجام دهید.
  2. صندوق را ببندید.
  3. در جدول `journal_entries` جستجو کنید؛ هیچ رکوردی برای این شیفت صندوق ثبت نشده است و حساب صندوق در دفتر کل صفر است.
- **Business Impact:** ناترازی اساسی در دفاتر مالی شرکت‌های چندارزی، ثبت نشدن دریافتی‌های صندوق در دفاتر قانونی، ناتوانی در محاسبه سود و زیان تسعیر ارز صندوق.
- **Recommendation:** پیاده‌سازی متد ثبت سند ارزی در `postSession` با استفاده از نرخ تسعیر روز و حساب واسط تسعیر نقدی صندوق.

---

### Scenario 16 — ثبت هم‌زمان تراکنش فروش در هنگام بستن شیفت صندوق و خارج ماندن مبالغ از سند بستن صندوق (Concurrent Order During Till Close)

- **Module:** POS & Cashbox (`PosService.closeSession` / `PosService.recordOrder`)
- **User Action:** صندوق‌دار فرم بستن شیفت صندوق را باز کرده و پول نقد را شمارش و دکمه بستن صندوق را می‌زند. درست در همین ثانیه، یک سفارش فروش POS یا ثبت پرداخت نقدی روی این صندوق از یک پنجره یا تبلت دیگر نهایی می‌شود.
- **Trigger:** خواندن محتویات صندوق (`loadContents`) در خط ۹۴۶ و محاسبه سرجمع‌ها در خط ۹۴۷، و سپس اجرای دستور `update` در خط ۹۵۷ بدون قفل سطری مانع از ورود تراکنش‌های جدید در فاصله بین خواندن و بستن.
- **Expected Behavior:** یا تراکنش ورودی جدید تا مشخص شدن وضعیت بستن صندوق مسدود شود، یا صندوق با خطای «تراکنش جدید در حال ثبت است» از کاربر بخواهد دوباره شمارش را بازبینی کند.
- **Observed/Risky Behavior:** تراکنش فروش نقدی با موفقیت درج شده و شناسه `sessionId` این صندوق را دریافت می‌کند. اما سند بستن صندوق (`closeColumns` و `postSession`) فقط بر مبنای اسنپ‌شات لحظه خط ۹۴۶ تولید می‌شود!
  تراکنش جدید در محاسبه پول انتظاری (`expectedCashMinor`) و در سند حسابداری پایانی (`postSession`) وارد نمی‌شود!
  وقتی صندوق بسته می‌شود، آن سفارش در دیتابیس متعلق به یک صندوق بسته است، اما مبلغ آن هیچ‌گاه در سند حسابداری بستن صندوق منعکس نمی‌شود و به یک تراکنش گمشده در دفاتر مالی تبدیل می‌گردد!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 85 — جا افتادن تراکنش‌های مالی هم‌زمان در هنگام شیفت‌بندی صندوق و ایجاد مغایرت دائمی در حساب صندوق.
- **Affected Data:** جدول‌های `pos_sessions`, `pos_orders`, `journal_lines`
- **Code Evidence:**
  - `backend/src/services/pos/pos.service.ts:945-973`: فاصله چندمرحله‌ای میان `loadContents` و `update(closeColumns)`.
  - `backend/src/services/pos/pos.service.ts:535-560`: متد `recordOrder` وضعیت صندوق را بررسی می‌کند اما تا قبل از تغییر وضعیت به `closed` اجازه ثبت می‌دهد.
- **Execution Path:** صندوق‌دار ۱: `closeSession` فراخوانی می‌شود → اسنپ‌شات در خط ۹۴۶ خوانده می‌شود → صندوق‌دار ۲: `recordOrder` سفارش جدید ثبت می‌کند → صندوق‌دار ۱: خط ۹۵۷ وضعیت را `closed` می‌کند → خط ۹۸۶ سند را با اسنپ‌شات قدیمی ثبت می‌کند.
- **Related Tests:**
  - موجود: `backend/src/__tests__/pos-rules.test.ts`
  - مفقود: تست ثبت سفارش جدید دقیقاً حین اجرای فرایند بستن شیفت صندوق.
- **Reproduction Steps:**
  1. یک شیفت صندوق با موجودی اولیه باز کنید.
  2. شبیه‌سازی کنید که پس از خط ۹۴۶ در متد `closeSession`، یک سفارش جدید در دیتابیس ثبت شود.
  3. مشاهده می‌شود سطر سفارش ذخیره شده اما مبلغ آن در `finalTotals` و سند حسابداری روزانه وجود ندارد.
- **Business Impact:** ناترازی بین جمع فروش‌های ثبت‌شده و مبلغ واریز شده به حساب دفتر کل صندوق.
- **Recommendation:** تغییر وضعیت صندوق به `'closing'` به همراه قفل تراکنش در ابتدای متد، به طوری که هیچ سفارش جدیدی روی این صندوق پذیرفته نشود.

---

### Scenario 17 — تداخل هم‌زمانی در تخصیص شماره توالی پرداخت‌ها و خطای شکست ثبت پرداخت (Payment Number Sequence Collision)

- **Module:** Payments (`PaymentsService.recordPayment` / `lastPaymentSequence`)
- **User Action:** دو صندوق‌دار در دو باجه یا دو شعبه مختلف، در یک لحظه پرداخت دو مشتری را ثبت می‌کنند (`POST /api/payments`).
- **Trigger:** استفاده از خواندن ماکزیمم شماره پرداخت (`SELECT MAX(...)`) در خطوط ۳۰۴-۳۰۶ بدون استفاده از توالی اتمیک (Sequence) در پایگاه داده.
- **Expected Behavior:** هر دو پرداخت بدون خطا ثبت شده و شماره‌های متوالی منحصر‌به‌فرد دریافت کنند (مثلاً `PMT-2026-000101` و `PMT-2026-000102`).
- **Observed/Risky Behavior:** هر دو درخواست هم‌زمان خط ۳۰۵ را اجرا می‌کنند:
  `const sequence = await this.repo.lastPaymentSequence(ctx.workspaceId, year)`
  هر دو عدد یکسان (مثلاً ۱۰۰) را دریافت می‌کنند!
  هر دو شماره `PMT-2026-000101` را تولید می‌کنند.
  درخواست اول با موفقیت ثبت می‌شود.
  درخواست دوم در خط ۳۱۱ به قید یکتایی `UNIQUE(workspace_id, payment_number)` در دیتابیس برخورد کرده و خطای کد `23505` می‌دهد.
  در بلوک `catch` (خط ۳۳۱): چون `clientRequestId` کاربر دوم با کاربر اول متفاوت است، شرط خط ۳۳۵ اجرا نشده و متد `this.rethrow(error)` فراخوانی می‌شود!
  پرداخت صندوق‌دار دوم با خطای ۵۰۰ پایگاه داده با شکست کامل مواجه می‌شود و مشتری در باجه منتظر می‌ماند!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 89 — توقف فرایند دریافت وجه نقد از مشتریان در ساعات شلوغ فروشگاه به دلیل مسابقه تولید شماره سند.
- **Affected Data:** جدول `payments`
- **Code Evidence:**
  - `backend/src/services/payments/payments.service.ts:304-306`:
    ```typescript
    const year = Number(entryDate.slice(0, 4))
    const sequence = await this.repo.lastPaymentSequence(ctx.workspaceId, year)
    const paymentNumber = `PMT-${year}-${String(sequence + 1).padStart(6, '0')}`
    ```
  - `backend/src/services/payments/payments.service.ts:330-341`: مدیریت خطای 23505 که در صورت متفاوت بودن `clientRequestId` خطا را دوباره پرتاب می‌کند.
- **Execution Path:** دو درخواست هم‌زمان به `recordPayment` → دریافت `sequence` یکسان → تلاش برای درج با `paymentNumber` یکسان → خطای 23505 یونیک در دیتابیس → شکست پرداخت دوم.
- **Related Tests:**
  - موجود: `backend/src/__tests__/till-payments-01.pg.test.ts`
  - مفقود: تست فراخوانی هم‌زمان دو پرداخت با Promise.all و بررسی موفقیت هر دو.
- **Reproduction Steps:**
  1. دو درخواست `POST /api/payments` را با دو `Idempotency-Key` متفاوت به صورت کاملاً هم‌زمان ارسال کنید.
  2. یکی از درخواست‌ها با خطای `23505 unique constraint violation` رد شده و ثبت نمی‌شود.
- **Business Impact:** اختلال در دریافت وجه، قطعی صف صندوق‌داری، ایجاد تجربه کاربری منفی.
- **Recommendation:** استفاده از شیء اتمیک `SEQUENCE` در سطح Postgres یا تولید شماره پرداخت در تابع اتمیک ذخیره‌شده پایگاه داده با قفل سطری.

---

### Scenario 18 — ابطال فاکتور تسویه‌شده در صندوق بسته‌شده و ایجاد شکاف آشتی‌ناپذیر در تراز صندوق (Invoice Reversal on Closed Till)

- **Module:** Invoices & Payments (`InvoiceService.delete` / `reverseEffects`)
- **User Action:** مدیر فروشگاهی فاکتور فروشی را که ۳ روز قبل صادر شده و وجه نقد آن در شیفت صندوق همان روز دریافت شده بود، به دلیل عودت کالا یا اشتباه فاحش حذف می‌کند.
- **Trigger:** متد `reverseEffects` پرداخت را لغو می‌کند (`cancelPayment`)، اما شیفت صندوق مربوطه (`till_sessions`) در ۳ روز قبل بسته و صورت‌جلسه شده است.
- **Expected Behavior:** سیستم یا اجازه حذف فاکتوری که در صندوق بسته تسویه شده را ندهد، یا به جای دستکاری عطف‌به‌ماسبق، یک سند استرداد نقدی در صندوق جاری امروز صادر کند.
- **Observed/Risky Behavior:** در خطوط ۱۸۰۹-۱۸۱۶ فایل `invoice.service.ts`:
  سند حسابداری فاکتور برگشت می‌خورد و سند حسابداری پرداخت لغو می‌شود. حساب نقد در دفتر کل بستانکار می‌شود (وجه از حساب برداشته می‌شود).
  اما شیفت صندوق ۳ روز پیش که وضعیت آن `closed` است دست‌نخورده باقی می‌ماند!
  اگر حسابرس گزارش شمارش فیزیکی آن روز را با گردش حساب صندوق در دفتر کل مقایسه کند، یک مغایرت ماندگار و حل‌نشدنی می‌یابد زیرا پول در صورت‌جلسه شمارش صندوق وجود دارد اما در دفتر کل حذف شده است!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 81 — ایجاد مغایرت‌های تاریخی میان کاردکس وجوه نقد در دفتر کل و گزارش‌های تحویل شیفت صندوق‌ها.
- **Affected Data:** جدول‌های `payments`, `journal_entries`, `pos_sessions`
- **Code Evidence:**
  - `backend/src/services/invoice.service.ts:1809-1816`: لغو مستقیم اثرات مالی بدون اعتبارسنجی وضعیت بسته بودن صندوق منبع.
  - `backend/src/services/payments/payments.service.ts`: متد `cancelPayment` سابقه صندوق بسته را تصحیح نمی‌کند.
- **Execution Path:** `DELETE /api/invoices/:id` → `reverseEffects` → `payments.cancelPayment` → لغو سند پرداخت در دفتر کل → صندوق بسته در تاریخ گذشته مغایر می‌شود.
- **Related Tests:**
  - موجود: `backend/src/__tests__/reverse-till.test.ts`
  - مفقود: تست اعتبارسنجی منع ابطال پرداخت روی صندوق‌های قطعی و بسته شده.
- **Reproduction Steps:**
  1. فاکتوری نقدی در شیفت صندوق باز ثبت کرده و سپس شیفت صندوق را ببندید.
  2. فاکتور را حذف کنید.
  3. گزارش صندوق بسته را با تراز دفتر کل آن روز مقایسه کنید؛ مغایرت مالی مشاهده می‌شود.
- **Business Impact:** بهم ریختن تراز تحویل‌داری صندوق، اتهام به صندوق‌دار در خصوص کسری یا سرک صندوق در ممیزی‌های گذشته‌نگر.
- **Recommendation:** صدور سند استرداد نقدی مستقل (`cash_refund`) در شیفت جاری باز صندوق به جای ابطال عطف‌به‌ماسبق سند پرداخت در شیفت‌های بسته.

---

### Scenario 19 — ثبت سند حسابداری دستی روی حساب معین دریافتنی/پرداختنی بدون پیوند به دفتر مشتری (Customer Sub-Ledger Desync via Manual Journal)

- **Module:** Accounting & General Ledger (`AccountingService.createJournalEntry` / `validateEntryLines`)
- **User Action:** حسابدار برای ثبت اصلاحیه یا تهاتر بدهی، از منوی حسابداری یک سند دستی ثبت کرده و حساب «حساب‌های دریافتنی» (`role: 'receivable'`) را بدهکار یا بستانکار می‌کند (`POST /api/accounting/journal-entries`).
- **Trigger:** متد `validateEntryLines` فقط تراز بودن بدهکار و بستانکار و معتبر بودن حساب را بررسی می‌کند و الزامی برای درج شناسه مشتری (`partyId`) در اسناد معین ندارد.
- **Expected Behavior:** برای حساب‌های کنترلی معین نظیر مشتریان و تأمین‌کنندگان، سامانه باید انتخاب شخص را اجباری کند تا مانده دفتر تفصیلی با معین تطابق داشته باشد.
- **Observed/Risky Behavior:** در خطوط ۱۳۲-۱۸۲ فایل `accounting.domain.ts`:
  هیچ اعتبارسنجی در مورد ضرورت وجود طرف حساب برای آرتیکل‌های معین مشتریان و بستانکاران وجود ندارد.
  سند با موفقیت ثبت می‌شود و مانده کل حساب «حساب‌های دریافتنی» در ترازنامه تغییر می‌کند.
  اما گزارش مانده‌حساب مشتریان، صورت‌حساب مشتری (`customer statement`) و گزارش سن مطالبات (`aging`) از جدول‌های `invoices` و `payments` خوانده می‌شوند!
  در نتیجه، مجموع مطالبات از تک‌تک مشتریان به هیچ عنوان با مانده حساب دریافتنی در دفتر کل و تراز آزمایشی همخوانی نخواهد داشت و حسابداران با مغایرت لاینحل مواجه می‌شوند.
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 86 — تفکیک ناخواسته دفتر کل از زیردفاتر مشتریان (Sub-Ledger Desync) و نابودی انطباق تراز معین با تفصیلی.
- **Affected Data:** جدول‌های `journal_entries`, `journal_lines`, صورت‌حساب مشتریان
- **Code Evidence:**
  - `packages/validation/src/schemas/accounting.domain.ts:132-182`: تابع `validateEntryLines` فقط تراز بدهکار و بستانکار را چک می‌کند.
  - `packages/validation/src/schemas/accounting.schema.ts`: اسکیما ردیف سند فقط شامل `accountId`، `debit`، `credit` و `description` است و فاقد فیلد اجباری شخص است.
- **Execution Path:** `POST /api/accounting/journal-entries` → `createJournalEntry` → `validateEntryLines` → تأیید سند بدون طرف حساب تفصیلی.
- **Related Tests:**
  - موجود: تست‌های تراز بودن سند حسابداری
  - مفقود: تست ممانعت از ثبت سند روی حساب‌های معین کنترلی بدون تعیین تفصیلی.
- **Reproduction Steps:**
  1. یک سند دستی ثبت کنید که در آن حساب بدهکاران تجاری بدهکار و حسابی دیگر بستانکار شود.
  2. ترازنامه را بررسی کنید؛ مانده حساب دریافتنی افزایش می‌یابد.
  3. گزارش مانده‌حساب مشتریان را بررسی کنید؛ هیچ مشتری‌ای بدهکار نشده است و تراز معین و تفصیلی ناتراز است.
- **Business Impact:** ناتوانی در تهیه گزارشات حسابرسی رسمی، عدم انطباق تراز دفاتر با لیست بدهکاران و بستانکاران.
- **Recommendation:** ممنوعیت ثبت سند دستی روی حساب‌های دارای نقش `receivable` و `payable` مگر با ثبت هم‌زمان در ماژول دریافت و پرداخت، یا الزام به انتخاب شناسه شخص در خطوط سند.

---

### Scenario 20 — فرض ثابت بودن ضریب ۱۰۰ در توابع پایه‌ای پول برای ارزهای بدون اعشار و سه اعشاری (Hardcoded Factor 100 in Money Primitives)

- **Module:** Validation & Money Primitives (`packages/validation/src/schemas/money.ts`)
- **User Action:** کاربر در محیطی با واحد پولی افغانی (AFN) یا ریال ایران (IRR) یا دینار عراق/کویت (IQD/KWD) اقدام به تسویه مبالغ، تخفیفات یا صدور فاکتور می‌کند.
- **Trigger:** پیاده‌سازی توابع `round2` و `minor` در فایل `money.ts` که ضریب ۱۰۰ را به صورت Hardcode برای تمامی ارزها فرض کرده‌اند.
- **Expected Behavior:** محاسبات واحد خرد بر اساس تعداد اعشار رسمی هر ارز (مثلاً ۰ رقم برای AFN و IRR، و ۳ رقم برای KWD/IQD) انجام شود.
- **Observed/Risky Behavior:** در خطوط ۴۵-۶۵ فایل `money.ts`:
  ```typescript
  export function minor(value: number): number {
    return Math.round((Number.isFinite(value) ? value : 0) * 100)
  }
  ```
  صراحتاً مقدار ضربدر ۱۰۰ می‌شود!
  در کامنت خط ۱۹ همان فایل نوشته شده است: «round2 IS NOT CURRENCY-AWARE, AND THAT IS NOT AN OVERSIGHT TO FIX HERE».
  اما در متدهای صندوقداری و دریافت‌پرداخت، تابع `majorToTillMinor` از `FRACTION_DIGITS` استفاده می‌کند که برای AFN برابر با ۰ است!
  این تضاد باعث می‌شود در یک بخش از کد، ۱۰۰ افغانی برابر با ۱۰۰ واحد خرد فرض شود (`majorToTillMinor`) و در بخش دیگر، ۱۰۰ افغانی برابر با ۱۰٬۰۰۰ واحد خرد فرض شود (`minor(100)`)! در نتیجه در اعتبارسنجی‌هایی مثل `validateAllocations` یا تبدیل‌های ارزی، خطاهای ناهماهنگی ضریب تا ۱۰۰ برابر رخ می‌دهد!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 80 — ریسک تناقض محاسباتی ۱۰۰ برابری میان توابع مختلف پول در مخزن برای ارزهای محلی منطقه.
- **Affected Data:** محاسبات پولی در تمامی ماژول‌ها
- **Code Evidence:**
  - `packages/validation/src/schemas/money.ts:45-65`: ضریب ثابت ۱۰۰ بدون توجه به ارز.
  - `packages/validation/src/schemas/payments.domain.ts:25-38`: توابع `majorToTillMinor` و `tillMinorToMajor` که بر خلاف `money.ts` از `FRACTION_DIGITS` استفاده می‌کنند.
- **Execution Path:** جریان‌های تسویه که در آنها هم از `minor()` استفاده شده و هم از `majorToTillMinor()`.
- **Related Tests:**
  - موجود: `packages/validation/src/__tests__/money-primitive-guard.test.ts`
  - مفقود: تست مقایسه رفتار `minor` با `majorToTillMinor` روی ارز AFN و دینار عراق.
- **Reproduction Steps:**
  1. مقدار ۱۰۰ افغانی را به `minor()` بدهید → خروجی 10000.
  2. مقدار ۱۰۰ افغانی را به `majorToTillMinor(100, 'AFN')` بدهید → خروجی 100.
  3. مقایسه مستقیم این دو مقدار منجر به خطای عدم تطابق ۱۰۰ برابری می‌شود.
- **Business Impact:** ابهام در نمایش ارقام، سردرگمی در محاسبات خرد صندوق‌ها و خطر خطاهای محاسباتی در ارزهای منطقه‌ای.
- **Recommendation:** استانداردسازی یکپارچه تمامی توابع پولی مخزن بر مبنای `FRACTION_DIGITS` جدول ارزها.

---

### Scenario 21 — خطای گردکردن نیم‌سنت در ممیز شناور IEEE-754 و باقی ماندن مانده‌های تسویه‌ناپذیر غباری (Floating Point Dust Balance Bug)

- **Module:** Validation & Money Math (`packages/validation/src/schemas/money.ts:45-48` / `round2`)
- **User Action:** مشتری فاکتوری شامل اقلام دارای درصد تخفیف یا مالیات اعشاری (مثلاً ۱۰٪ روی ۱۰.۰۵ که می‌شود ۱.۰۰۵) را دقیقاً بر اساس سرجمع نهایی چاپ‌شده فاکتور پرداخت و تسویه می‌کند.
- **Trigger:** استفاده از تابع `round2` که به دلیل رفتار ممیز شناور استاندارد دوگانه در ضرب `1.005 * 100 = 100.49999999999999`، عدد را به سمت پایین گرد می‌کند (`Math.round` خروجی ۱۰۰ می‌دهد به جای ۱۰۱).
- **Expected Behavior:** با پرداخت کامل مبلغ فاکتور، مانده فاکتور صفر شده و وضعیت فاکتور به `completed` تغییر یابد.
- **Observed/Risky Behavior:** در کامنت خطوط ۴۲-۴۳ فایل `money.ts` صراحتاً ثبت شده است:
  `round2(1.005) is 1, not 1.01: 1.005 * 100 is 100.49999999999999 in IEEE-754. That is a property of the float, not of the rounding direction.`
  در محاسبات سرجمع خطوط فاکتور و تخصیص پرداخت، این خطای ۱ سنتی سبب می‌شود مبلغ پرداخت‌شده مثلاً ۱۰۰.۰۰ و مبلغ فاکتور ۱۰۰.۰۱ محاسبه شود (یا برعکس).
  در نتیجه، فاکتور با مبلغ ۰.۰۱ باقی‌مانده («مانده غباری» یا Dust Balance) تا ابد در وضعیت `pending` و تسویه‌نشده باقی می‌ماند و در لیست فاکتورهای باز و سررسیدگذشته گزارش می‌شود، در حالی که مشتری تمام پول را داده است!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `MEDIUM`
- **Likelihood:** `HIGH`
- **Priority Score:** 79 — باز ماندن فاکتورهای تسویه‌شده به دلیل خطای ۱ سنتی در محاسبات ممیز شناور.
- **Affected Data:** جدول‌های `invoices` (ستون‌های `paid_amount`, `status`, `total`), `payment_allocations`
- **Code Evidence:**
  - `packages/validation/src/schemas/money.ts:42-48`: اعتراف رسمی به خطای `round2(1.005) === 1`.
  - `backend/src/services/invoice.service.ts:970`: وجود هک ریاضی `money.total - 0.000001` در کد که نشان‌دهنده تلاش برای دور زدن اثرات همین خطاست.
- **Execution Path:** محاسبه مالیات یا تخفیف فاکتور → گردکردن با `round2` → بروز خطای ۱ سنتی → ثبت فاکتور → پرداخت کامل → مقایسه `paid >= total` منفی می‌شود → فاکتور در وضعیت `pending` قفل می‌شود.
- **Related Tests:**
  - موجود: `backend/src/__tests__/money-primitive-guard.test.ts` (این تست این رفتار خطا را قفل کرده است!).
  - مفقود: تست چرخه پرداخت فاکتور با ارقام ضرب‌شده در تخفیف درصدی اعشاری.
- **Reproduction Steps:**
  1. در نود اجرا کنید: `const { round2 } = await import('./packages/validation/src/schemas/money.js'); round2(1.005)`.
  2. مشاهده خروجی: `1` به جای `1.01`.
  3. اعمال این عدد روی فاکتور و پرداخت ۱.۰۱ سبب ایجاد عدم تطابق ۱ سنتی می‌شود.
- **Business Impact:** اعلام بدهکاری اشتباه به مشتریان خوش‌حساب، کثیف شدن گزارش سن مطالبات و داشبورد فاکتورهای باز.
- **Recommendation:** پیاده‌سازی گردکردن با `Number.EPSILON` یا ضرب در توان ده قبل از گردکردن:
  `Math.round((value + Number.EPSILON) * 100) / 100`

---

### Scenario 22 — بلعیدن خطای لغو سند پرداخت در دفتر کل و بروز شکاف دائمی میان پرداخت‌ها و تراز مالی (Swallowed Payment Reversal Failure)

- **Module:** Payments & General Ledger (`PaymentsService.cancelPayment`)
- **User Action:** حسابدار پرداختی را که قبلاً ثبت شده بود، لغو (`cancelPayment`) می‌کند.
- **Trigger:** بروز خطا در فراخوانی `ledger.reverseDocument` (مثلاً به دلیل بسته بودن دوره مالی در تاریخ پرداخت یا غیرفعال بودن سرفصل معین مربوطه).
- **Expected Behavior:** کل فرایند لغو پرداخت باید به صورت تراکنش یکپارچه برگشت (Rollback) بخورد و به کاربر خطا داده شود که «به دلیل بسته بودن دوره مالی، امکان لغو پرداخت وجود ندارد».
- **Observed/Risky Behavior:** در خطوط ۷۱۴-۷۱۶ فایل `payments.service.ts`:
  ```typescript
  try {
    await this.repo.cancelPayment(ctx, paymentId)
  } catch (error) {
    this.rethrow(error)
  }

  await sod.recordAction(ctx, 'payment.cancel', 'payment', paymentId)

  await ledger
    .reverseDocument(ctx, 'payment', paymentId, { reason })
    .catch((err) => console.error(`[Payments] reversal failed for ${paymentId}:`, err))
  ```
  خط ۷۰۷ ابتدا وضعیت پرداخت را در دیتابیس به `cancelled` تغییر می‌دهد و تمام تخصیص‌های فاکتور (`payment_allocations`) را آزاد می‌کند.
  سپس در خط ۷۱۴ متد `reverseDocument` صدا زده می‌شود، اما با یک `.catch(...)` ساده خطای آن بلعیده شده و فقط در کنسول چاپ می‌شود!
  در نتیجه، در سیستم دریافت و پرداخت، سند لغو شده و فاکتورها دوباره بدهکار می‌شوند؛ اما در دفتر کل، سند حسابداری پرداخت لغو نشده و وجه نقد در حساب‌های مالی باقی می‌ماند!
  نتیجه: حساب بانکی/صندوق در دفتر کل با واقعیت مغایر شده و حساب دریافتنی مشتری دو برابر اعلام وصول می‌گردد!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `CRITICAL`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 93 — بلعیدن خطای دفتر کل، ایجاد عدم تطابق پنهان و دائمی میان زیرسیستم دریافت‌پرداخت و دفتر کل حسابداری.
- **Affected Data:** جدول‌های `payments`, `journal_entries`, `journal_lines`, `payment_allocations`
- **Code Evidence:**
  - `backend/src/services/payments/payments.service.ts:714-716`: وجود صریح دستور `catch((err) => console.error(...))` روی متد حیاتی لغو سند دفتر کل.
- **Execution Path:** `cancelPayment` → `repo.cancelPayment` (موفق و کامیت‌شده) → `ledger.reverseDocument` (پرتاب خطا به دلیل بسته بودن دوره) → خطا بلعیده می‌شود → خروجی 200 به کاربر داده می‌شود.
- **Related Tests:**
  - موجود: تست‌های عادی کنسل کردن پرداخت در شرایط باز بودن دفاتر
  - مفقود: تست کنسل کردن پرداخت در دوره‌ای که دوره مالی آن بسته شده است (`closed period`).
- **Reproduction Steps:**
  1. پرداختی در یک ماه قبل ثبت کنید.
  2. دوره مالی آن ماه را در تنظیمات حسابداری ببندید (`closed_period`).
  3. متد `cancelPayment` را برای آن پرداخت اجرا کنید.
  4. مشاهده می‌شود پرداخت کنسل شده اما سند حسابداری آن در دفتر کل باقی می‌ماند و خطای لجر در کنسول گم می‌شود.
- **Business Impact:** ناترازی قطعی میان تراز دفاتر قانونی و کاردکس اشخاص، نقض اصول پذیرفته‌شده حسابداری (GAAP).
- **Recommendation:** اجرای هر دو عملیات در یک تابع اتمیک پایگاه داده، یا اجرای `ledger.reverseDocument` قبل از `repo.cancelPayment` و عدم بلعیدن خطا با حذف `.catch`.

---

### Scenario 23 — کرش نرم‌افزار در حین ارسال صف همگام‌سازی و اجرای مجدد تغییرات با تأخیر در بروزرسانی وضعیت محلی (Outbox Push Crash-Replay)

- **Module:** Offline Sync (`packages/app-shell/src/features/sync/sync-engine.ts`)
- **User Action:** کاربر در حالت آفلاین چندین ویرایش مشتری و کالا انجام داده و سپس به اینترنت متصل می‌شود تا عملیات تخلیه صف (`runSync`) آغاز شود. در حین ارسال اطلاعات، سیستم به دلیل اتمام باتری یا بسته شدن پنجره دسکتاپ خاموش می‌شود.
- **Trigger:** فاصله زمانی میان موفقیت درخواست HTTP در سرور (`await pushEntry(entry)`) و علامت‌گذاری سطر در دیتابیس محلی اس‌کیوالایت (`await desktop.db.resolveQueue(entry.clientId, 'done')`).
- **Expected Behavior:** با راه‌اندازی مجدد برنامه، سرور و کلاینت وضعیت آخرین تراکنش را به صورت اتمیک تشخیص داده و از تکرار مجدد آن خودداری کنند.
- **Observed/Risky Behavior:** در خطوط ۷۳۲-۷۳۳ فایل `sync-engine.ts`:
  درخواست به سرور ارسال شده و در سرور کامیت می‌شود. درست قبل از اجرای `resolveQueue` برنامه بسته می‌شود.
  در دیتابیس محلی SQLite، وضعیت تراکنش همچنان `'pending'` باقی می‌ماند.
  پس از باز شدن مجدد نرم‌افزار، متد `runSync` دوباره این سطر را از صف می‌خواند و مجدداً متد `pushEntry` را فراخوانی می‌کند.
  اگر عملیات مربوط به فاکتور نباشد (مثلاً پچ کردن اطلاعات یا متدهای بدون کلید قطعی)، درخواست مجدداً روی سرور پردازش می‌شود یا در صورت بروز خطای نسخه (`version conflict`)، سطر به عنوان `REJECTED` علامت خورده و کاربر را با خطای کاذب روبرو می‌کند در حالی که تغییرات وی در تلاش اول اعمال شده بود!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `MEDIUM`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 75 — تکرار ارسال تراکنش‌ها پس از قطعی غیرمنتظره و بروز خطاهای کاذب تضاد در مرکز همگام‌سازی.
- **Affected Data:** جدول `sync_queue` محلی، رکوردهای سرور
- **Code Evidence:**
  - `packages/app-shell/src/features/sync/sync-engine.ts:732-735`:
    ```typescript
    await pushEntry(entry)
    await desktop.db.resolveQueue(entry.clientId, 'done')
    ```
- **Execution Path:** `runSync` → `pushEntry` (ارسال شد و سرور کامیت کرد) → سیستم خاموش می‌شود → راه‌اندازی مجدد → `runSync` سطر را دوباره ارسال می‌کند.
- **Related Tests:**
  - موجود: `packages/local-engine/src/__tests__/offline-sync.test.ts`
  - مفقود: تست شبیه‌سازی کرش پردازش پس از پاسخ HTTP و قبل از آپدیت SQLite.
- **Reproduction Steps:**
  1. با قطع ارتباط بعد از دریافت پاسخ HTTP، مانع اجرای خط ۷۳۳ شوید.
  2. متد `runSync` را دوباره صدا بزنید.
  3. درخواست دوباره ارسال شده و با خطای تکرار یا تضاد نسخه رد می‌شود.
- **Business Impact:** سردرگمی کاربر با خطاهای قرمز در مرکز همگام‌سازی با عنوان «رد شده»، نیاز به بررسی دستی لاگ‌ها.
- **Recommendation:** استعلام وضعیت `clientId` از سرور قبل از علامت‌گذاری خطا به عنوان قطعی در زمان اجرای مجدد صف.

---

### Scenario 24 — عدم وجود ادغام فیلدی در تضاد ویرایش‌های آفلاین دو دستگاه و ریجکت دائمی داده‌های کلاینت (Offline Last-Write-Wins Data Loss)

- **Module:** Offline Sync & Concurrency (`packages/app-shell/src/features/sync/sync-engine.ts`)
- **User Action:** دو ویزیتور یا کارمند به صورت هم‌زمان و در حالت آفلاین، اطلاعات یک مشتری را ویرایش می‌کنند: نفر اول در تبلت A شماره موبایل مشتری را اصلاح می‌کند، و نفر دوم در تبلت B آدرس مشتری را تغییر می‌دهد.
- **Trigger:** استفاده از مکانیزم کنترل هم‌زمانی خوش‌بینانه مبتنی بر شماره نسخه (`expectedVersion`) بدون الگوریتم ادغام ۳-طرفه فیلدها (`Field-Level 3-Way Merge`).
- **Expected Behavior:** سیستم سرور تغییرات غیرمتداخل (شماره تلفن از دستگاه اول و آدرس از دستگاه دوم) را ادغام کرده و هر دو را ذخیره نماید.
- **Observed/Risky Behavior:** در خطوط ۶۱۸-۶۵۵ و ۷۵۸-۷۶۳ فایل `sync-engine.ts`:
  دستگاه A متصل شده و تغییر خود را با `expectedVersion = 1` می‌فرستد. سرور نسخه را ۲ می‌کند.
  سپس دستگاه B متصل می‌شود و تغییر خود را با `expectedVersion = 1` می‌فرستد.
  سرور خطای ۴۰۹ `VERSION_CONFLICT` برمی‌گرداند.
  موتور همگام‌سازی در خط ۷۵۸ این خطا را یک خطای دائمی شناسایی کرده و سطر را با پیشوند `REJECTED: VERSION_CONFLICT` علامت‌گذاری می‌کند.
  سپس در خط ۷۲۶ آمده است: `if (entry.lastError?.startsWith(REJECTED_PREFIX)) continue`.
  یعنی تغییرات دستگاه دوم برای همیشه در صف فریز شده و نادیده گرفته می‌شود! هیچ تلاشی برای ادغام خودکار انجام نمی‌شود و تغییرات آدرس واردشده توسط نفر دوم در عمل کاملاً از بین می‌رود و پاک می‌شود!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 87 — از دست رفتن قطعی داده‌های ویرایش‌شده توسط کاربران آفلاین در صورت هم‌زمانی ویرایش یک رکورد در دو دستگاه.
- **Affected Data:** جدول‌های `customers`, `products`, `sync_queue`
- **Code Evidence:**
  - `packages/app-shell/src/features/sync/sync-engine.ts:618-620`:
    «A descriptive edit, with the version the device believed... Without expectedVersion the server has nothing to compare and two devices editing one customer resolve as last-write-wins».
  - `packages/app-shell/src/features/sync/sync-engine.ts:758-763`: مسدودسازی قطعی رکوردهای با خطای ۴۰۹.
- **Execution Path:** دستگاه A: ارسال موفق → نسخه بالا می‌رود → دستگاه B: ارسال نسخه قدیمی → خطای 409 → فریز شدن همیشگی ویرایش دستگاه B در outbox.
- **Related Tests:**
  - موجود: `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`
  - مفقود: تست سناریوی ویرایش دو فیلد مجزا از یک رکورد در دو دستگاه آفلاین و ارزیابی نتیجه همگام‌سازی.
- **Reproduction Steps:**
  1. یک مشتری با نسخه ۱ در دو دستگاه آفلاین لود کنید.
  2. در دستگاه اول تلفن و در دستگاه دوم آدرس را ادیت کنید.
  3. هر دو را آنلاین کنید؛ دستگاه دوم با خطای ریجکت متوقف شده و آدرس هرگز در سرور ذخیره نمی‌شود.
- **Business Impact:** از دست رفتن کار و داده‌های کاربران میدانی، تلف شدن وقت در ورود مجدد اطلاعات.
- **Recommendation:** پیاده‌سازی مکانیزم ادغام بر اساس تفاوت فیلدها (`Field-level delta merge`) برای موجودیت‌های غیرمالی به طوری که اگر فیلدهای ویرایش‌شده هم‌پوشانی ندارند، نسخه جدید خودکار اعمال شود.

---

### Scenario 25 — قفل شدن صف ارسال در اثر شکست اولین تراکنش وابسته در گیت خروج (Outbox Push Gate Deadlock)

- **Module:** Offline Sync & Outbox Gate (`packages/app-shell/src/features/sync/sync-engine.ts` / `createPushGate`)
- **User Action:** کاربر در حالت آفلاین ابتدا یک مشتری جدید تعریف می‌کند (مثلاً با کد ملی یا شماره همراهی که بعداً مشخص می‌شود در سرور تکراری است) و بلافاصله برای این مشتری یک فاکتور فروش صادر می‌کند.
- **Trigger:** اعتبارسنجی سرور مشتری را به دلیل نقض یکتا بودن شماره یا کدملی با خطای ۴۰۰ یا ۴۰۹ رد می‌کند.
- **Expected Behavior:** کاربر باید بتواند مشتری را اصلاح کند، یا فاکتور به یک مشتری دیگر متصل شود و صف از بن‌بست خارج گردد.
- **Observed/Risky Behavior:** در خطوط ۷۱۴ و ۷۲۷ فایل `sync-engine.ts`:
  متد `createPushGate(queue)` وظیفه حفظ ترتیب تراکنش‌ها را دارد.
  تراکنش ساخت مشتری با خطای اعتبارسنجی رد شده و وضعیت آن در صف به `REJECTED` تغییر می‌کند.
  سپس حلقه پردازش به فاکتور می‌رسد. گیت در خط ۷۲۷ بررسی می‌کند: `if (gate.blockedBy(entry)) continue`.
  چون تراکنش مشتری در صف علامت `sent` دریافت نکرده است، فاکتور برای همیشه مسدود می‌ماند!
  و از آنجا که تراکنش مشتری به دلیل داشتن پیشوند `REJECTED` در خط ۷۲۶ اسکیپ می‌شود، این صف در یک بن‌بست دائمی (Deadlock) گیر می‌افتد: نه مشتری دوباره ارسال می‌شود و نه فاکتور پشت سر آن اجازه عبور پیدا می‌کند! کل صف تخلیه متوقف می‌شود!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 84 — قفل شدن کامل فرایند سینک آفلاین برای اسناد زنجیره‌ای در صورت ریجکت شدن اولین سند توسط سرور.
- **Affected Data:** جدول `sync_queue` محلی، فاکتورهای صادرشده آفلاین
- **Code Evidence:**
  - `packages/app-shell/src/features/sync/sync-engine.ts:714-728`:
    ```typescript
    const gate = createPushGate(queue)
    for (const entry of queue) {
      if (entry.lastError?.startsWith(REJECTED_PREFIX)) continue
      if (gate.blockedBy(entry)) continue
    ```
- **Execution Path:** ساخت مشتری نامعتبر → ساخت فاکتور → آنلاین شدن → مشتری ریجکت می‌شود → فاکتور برای همیشه توسط `blockedBy` رد می‌شود.
- **Related Tests:**
  - موجود: `packages/app-shell/src/features/sync/__tests__/outbox-stages.test.ts`
  - مفقود: تست رفتار صف زمانی که سند والد ریجکت قطعی شود و اسناد فرزند در صف مانده باشند.
- **Reproduction Steps:**
  1. در حالت آفلاین مشتری با شماره موبایل تکراری ثبت کنید.
  2. برای آن مشتری فاکتوری ثبت کنید.
  3. به اینترنت متصل شوید؛ مشتری ریجکت شده و فاکتور تا ابد بدون ارسال در صف گیر می‌کند.
- **Business Impact:** نرسیدن فاکتورهای صادرشده آفلاین به سرور، انباشتگی صف خروجی و از کار افتادن همگام‌سازی دستگاه.
- **Recommendation:** پیاده‌سازی رابط کاربری حل تعارض در صفحه Sync Center برای امکان بازکردن گره تراکنش والد یا ویرایش شناسه مشتری در فاکتورهای وابسته.

---

### Scenario 26 — دوگانگی شماره فاکتور پس از اتصال آفلاین به سرور و گم شدن فاکتور چاپی مشتری (Offline Invoice Number Divergence)

- **Module:** Offline & Sync (`packages/app-shell/src/features/sync/sync-engine.ts` / `InvoiceService.create`)
- **User Action:** ویزیتور یا صندوق‌دار در حالت آفلاین فاکتور فروشی صادر کرده، رسید چاپی را با شماره محلی (مثلاً `INV-LOC-00012`) چاپ نموده و تحویل مشتری می‌دهد. در پایان روز دستگاه آنلاین شده و فاکتورها همگام‌سازی می‌شوند.
- **Trigger:** متد `pushEntry` فاکتور را به سرور می‌فرستد؛ متد `InvoiceService.create` روی سرور شماره فاکتور جدید از توالی ابری تولید می‌کند (`generateInvoiceNumber`) و کلاینت اسنپ‌شات موقت محلی را دور می‌اندازد (`discardInvoiceProjection` در خط ۷۳۹).
- **Expected Behavior:** یا شماره رسمی فاکتور در حالت آفلاین با پیش‌شماره معتبر شعبه رزرو و قطعی شود، یا شماره موقت قبلی در ستونی مانند `client_reference_number` به عنوان نمایه جستجو ذخیره شود تا از روی قبض چاپی مشتری قابل بازیابی باشد.
- **Observed/Risky Behavior:** سرور یک شماره فاکتور کاملاً متفاوت اختصاص می‌دهد (مثلاً `INV-2026-000890`) و شماره محلی `INV-LOC-00012` که روی قبض کاغذی دست مشتری است ناپدید می‌شود!
  زمانی که مشتری فردا برای پیگیری گارانتی، تسویه بدهی یا مرجوعی مراجعه کرده و شماره فاکتور روی قبض کاغذی خود را می‌گوید، اپراتور آن شماره را در سیستم جستجو می‌کند و با خطای «فاکتور یافت نشد» روبرو می‌شود!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `MEDIUM`
- **Likelihood:** `HIGH`
- **Priority Score:** 77 — گسست میان اسناد کاغذی دست مشتریان و دیتابیس مرکزی پس از همگام‌سازی آفلاین.
- **Affected Data:** جدول `invoices` (ستون `invoice_number`), ردپای اسناد چاپی
- **Code Evidence:**
  - `packages/app-shell/src/features/sync/sync-engine.ts:738-740`:
    ```typescript
    if (entry.entity === 'invoice' && entry.operation === 'create') {
      await discardInvoiceProjection(entry.clientId)
    }
    ```
  - `backend/src/services/invoice.service.ts:974`: تولید شماره کاملاً جدید ابری بدون ثبت شماره موقت کلاینت.
- **Execution Path:** صدور فاکتور آفلاین (با شماره محلی) → اتصال به اینترنت → `runSync` → `InvoiceService.create` با شماره جدید ابری → حذف رکوردهای محلی در کلاینت → عدم تطابق با نسخه چاپ‌شده.
- **Related Tests:**
  - موجود: `packages/local-engine/src/__tests__/offline-invoice-outbox.test.ts`
  - مفقود: تست اعتبارسنجی قابلیت جستجوی فاکتور همگام‌شده بر اساس شماره محلی چاپ‌شده قبلی.
- **Reproduction Steps:**
  1. در حالت آفلاین فاکتور صادر کنید و شماره موقت تولیدشده را یادداشت کنید.
  2. دستگاه را آنلاین و همگام‌سازی کنید.
  3. در سرور فاکتور را جستجو کنید؛ شماره تغییر کرده و جستجو با شماره محلی دست مشتری به نتیجه نمی‌رسد.
- **Business Impact:** تنش با مشتریان، ناتوانی در اعتبارسنجی خریدهای قبلی بر اساس فاکتور فیزیکی کاغذی.
- **Recommendation:** نگهداری شماره محلی دستگاه در فیلد `reference` یا ستون اختصاصی `offline_invoice_number` و افزودن آن به نمایه‌های جستجو.

---

### Scenario 27 — خطای فاجعه‌بار حسابداری در برگشت از خرید: کاهش درآمد فروش به جای کاهش بدهی به تأمین‌کننده (Catastrophic Purchase Return Accounting Inversion)

- **Module:** Invoice Returns & Accounting (`docs/invoice-return-01-migration.sql` / `InvoiceReturnService`)
- **User Action:** انباردار یا مدیر خرید، کالای معیوبی را که قبلاً از یک تأمین‌کننده خریداری شده بود، طی صورت‌جلسه «برگشت از خرید» به فروشنده مرجوع می‌کند (`POST /api/invoices/:id/returns` با `returnType: 'purchase_return'`).
- **Trigger:** تابع دیتابیسی `invoice_return_create` فارغ از اینکه نوع برگشت `sale_return` است یا `purchase_return`، یک کد حسابداری ثابت را اجرا می‌کند و هیچ شرطی برای تفکیک برگشت خرید ندارد!
- **Expected Behavior:** در برگشت از خرید (Purchase Return)، سیستم باید حساب «بستانکاران تجاری / حساب‌های پرداختنی» (`role: 'payable'`) را بدهکار کرده و حساب «موجودی کالا / برگشت از خرید» (`role: 'inventory'`) را بستانکار کند تا بدهی ما به تأمین‌کننده کاهش یابد.
- **Observed/Risky Behavior:** در خطوط ۳۴۸-۳۶۶ فایل `docs/invoice-return-01-migration.sql`:
  ```sql
  -- 6. Ledger Reversal Posting & Mandatory Account Checks
  IF v_tot_grand_minor > 0 THEN
    SELECT id INTO v_sales_acct FROM public.accounts
     WHERE workspace_id = p_workspace_id AND role = 'sales' ...;
    SELECT id INTO v_recv_acct FROM public.accounts
     WHERE workspace_id = p_workspace_id AND role = 'receivable' ...;

    v_journal_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_sales_acct, 'debit', v_total_books, 'credit', 0),
      jsonb_build_object('account_id', v_recv_acct, 'debit', 0, 'credit', v_total_books)
    );
  ```
  کد بدون هیچ شرطی، حساب درآمد فروش (`sales`) را بدهکار کرده و حساب بدهکاران تجاری مشتریان (`receivable`) را بستانکار می‌کند!
  نتیجه یک فاجعه تمام‌عیار در دفاتر قانونی است:
  ۱. درآمد فروش فروشگاه به جای هزینه خرید کاهش می‌یابد!
  ۲. بدهی یک مشتری تصادفی در سیستم طلبکار می‌شود!
  ۳. بدهی شرکت به تأمین‌کننده (`payable`) دست‌نخورده باقی می‌ماند و سیستم نشان می‌دهد ما هنوز پول آن کالای مرجوع‌شده را به تأمین‌کننده بدهکاریم!
- **Status:** `CONFIRMED_BUG`
- **Severity:** `CRITICAL`
- **Likelihood:** `HIGH`
- **Priority Score:** 98 — کشف یک باگ بنیادی و مهلک در ترازنامه و سود و زیان هنگام ثبت مرجوعی خرید.
- **Affected Data:** جدول‌های `invoice_returns`, `journal_entries`, `journal_lines`, `accounts`
- **Code Evidence:**
  - `docs/invoice-return-01-migration.sql:348-366`: عدم وجود هرگونه بررسی روی متغیر `v_return_type` در بخش صدور سند حسابداری و اجبار به استفاده از حساب‌های `sales` و `receivable`.
- **Execution Path:** `POST /api/invoices/:id/returns` با `returnType: 'purchase_return'` → فراخوانی RPC `invoice_return_create` → کسر انبار → بدهکار شدن فروش و بستانکار شدن طلب از مشتریان در دفتر کل!
- **Related Tests:**
  - موجود: تست‌های برگشت از فروش (`sale_return`)
  - مفقود: هرگونه تست برای اجرای برگشت از خرید (`purchase_return`) و بررسی سرفصل‌های معین سند آن.
- **Reproduction Steps:**
  1. یک فاکتور خرید در سیستم ثبت کنید.
  2. درخواست ثبت برگشت برای آن با `returnType: 'purchase_return'` ارسال کنید.
  3. سند صادرشده در دفتر کل را بررسی کنید؛ به جای بدهکار شدن حساب بستانکاران، حساب فروش بدهکار شده است.
- **Business Impact:** تحریف شدید صورت‌های مالی سود و زیان، عدم تسویه بدهی به تأمین‌کنندگان، نقض قوانین مالیاتی.
- **Recommendation:** تفکیک آرتیکل‌های سند حسابداری در تابع `invoice_return_create` بر اساس `v_return_type`:
  `IF v_return_type = 'purchase_return' THEN آرتیکل بدهکار حساب‌های پرداختنی و بستانکار موجودی کالا ELSE آرتیکل فروش و دریافتنی END IF;`

---

### Scenario 28 — مرجوعی فاکتور فروش نقدی بدون ثبت خروج وجه از صندوق و ایجاد کسری تحویل‌داری (Cash Sale Return Till Drawer Disconnect)

- **Module:** Invoice Returns & POS Till (`invoice-return.routes.ts` / `invoice_return_create`)
- **User Action:** مشتری کالایی را که دقایقی قبل به صورت نقد خریده بود پس می‌آورد. صندوق‌دار از منوی مرجوعی، فاکتور برگشت از فروش صادر می‌کند و پول را نقداً از کشوی صندوق به مشتری پس می‌دهد.
- **Trigger:** تابع دیتابیسی `invoice_return_create` فقط سند برگشت حسابداری روی حساب دریافتنی (`receivable`) می‌زند و هیچ پیوندی با کشوی صندوق نقد یا ماژول POS ندارد.
- **Expected Behavior:** سیستم باید وجه نقد مستردشده را از موجودی شمارش‌شده صندوق جاری کسر کرده و سطر `cash_out` در شیفت صندوق ثبت نماید.
- **Observed/Risky Behavior:** در خط ۳۶۵ فایل `invoice-return-01-migration.sql`، حساب دریافتنی بستانکار می‌شود (یک بستانکاری معلق برای مشتری بدون مشخص بودن نام وی در صورت فروش گذری).
  اما هیچ تغییری در موجودی نقدی صندوق ثبت نمی‌شود!
  وقتی در پایان شب، صندوق‌دار پول‌های دخل را شمارش می‌کند، به اندازه مبلغ مرجوعی با کسری نقد در صندوق مواجه می‌شود (`varianceMinor` منفی)، در حالی که پول واقعاً به مشتری داده شده بود!
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 86 — عدم انطباق مرجوعی‌های فروش با صندوق نقدینگی و کسری حساب غیرواقعی صندوق‌داران.
- **Affected Data:** کشوی صندوق (`pos_sessions`), حساب معین نقد و بانک
- **Code Evidence:**
  - `docs/invoice-return-01-migration.sql:348-375`: فقط حساب‌های معین فروش و دریافتنی و بهای تمام‌شده متاثر می‌شوند و سرفصل صندوق یا کشو هیچ اتصالی به این تابع ندارد.
- **Execution Path:** ثبت مرجوعی فاکتور نقدی → سند حسابداری فروش بدهکار و دریافتنی بستانکار می‌شود → پول فیزیکی از کشو خارج می‌شود → صندوق در پایان شب دچار کسری مغایرت می‌شود.
- **Related Tests:**
  - موجود: تست‌های ایزوله دیتابیسی برگشت فاکتور
  - مفقود: تست زنجیره مرجوعی فاکتور نقدی تا مرحله بستن شیفت صندوق.
- **Reproduction Steps:**
  1. یک فاکتور فروش نقدی در یک شیفت باز صندوق صادر کنید.
  2. فاکتور مرجوعی برای آن ثبت کرده و پول را از دخل خارج کنید.
  3. صندوق را ببندید؛ سیستم انتظار وجود پول را دارد و خطای مغایرت نقدی ثبت می‌کند.
- **Business Impact:** اتهام به صندوق‌داران در خصوص کسری دخل، عدم شفافیت در حساب‌های فروشگاه‌های خرده‌فروشی.
- **Recommendation:** الزام به مشخص کردن شیفت صندوق فعال یا صدور خودکار یک سند استرداد نقدی در صورت نقدی بودن فاکتور مبدأ.

---

### Scenario 29 — غیرفعال بودن پیش‌فرض تفکیک وظایف و امکان حذف فاکتور و لغو پرداخت توسط ثبت‌کننده بدون نظارت (Silent Separation of Duties Bypass)

- **Module:** Governance & Security (`SoDService.assertAllowed`)
- **User Action:** کارمندی که فاکتوری صادر کرده یا پرداختی نقدی ثبت کرده است، به تنهایی و بدون اطلاع مدیر، اقدام به حذف فاکتور یا لغو پرداخت و اصلاح وجه می‌کند.
- **Trigger:** متد `SoDService.assertAllowed` در خط ۱۶۱ فایل `sod.service.ts` می‌گوید:
  `const settings = await this.getSettings(ctx.workspaceId); if (settings.mode === 'off') return { kind: 'allowed' }`
- **Expected Behavior:** اقدامات پرریسک مالی نظیر حذف فاکتور یا لغو دریافت‌های مالی باید حتی در حالت عادی نیازمند تأیید ناظر (`Maker-Checker`) یا حداقل ثبت اجباری دلیل تغییرات باشد.
- **Observed/Risky Behavior:** در حالت پیش‌فرضِ تمامی محیط‌های کاری تازه ایجادشده، وضعیت `settings.mode` برابر با `'off'` است.
  در این حالت، کد به صورت کاملاً بی‌صدا و بدون هیچ هشداری، اجازه حذف و لغو تراکنش توسط شخص عامل را صادر می‌کند!
  یک کاربر متخلف می‌تواند فاکتوری صادر کند، پول نقد را از مشتری بگیرد، و قبل از پایان روز فاکتور را به راحتی حذف کند بدون اینکه سیستم مانع او شود یا درخواست تایید از مدیر شعبه بنماید.
- **Status:** `HIGH_RISK_GAP`
- **Severity:** `HIGH`
- **Likelihood:** `HIGH`
- **Priority Score:** 85 — ریسک کلاهبرداری داخلی و حذف اسناد مالی به دلیل خاموش بودن پیش‌فرض کنترل‌های حاکمیتی.
- **Affected Data:** جدول‌های `sod_settings`, `invoices`, `payments`
- **Code Evidence:**
  - `backend/src/services/authorization/sod.service.ts:160-161`:
    ```typescript
    const settings = await this.getSettings(ctx.workspaceId)
    if (settings.mode === 'off') return { kind: 'allowed' }
    ```
- **Execution Path:** کاربر اقدام به حذف سند می‌کند → `SoDService.assertAllowed` → مد برابر off است → تایید آنی بدون هیچ لاگ کنترلی.
- **Related Tests:**
  - موجود: تست‌های رفتاری SoD در صورت فعال بودن مد enforce
  - مفقود: تست رفتار امنیتی پایه سیستم در محیط‌های با تنظیمات پیش‌فرض.
- **Reproduction Steps:**
  1. در یک محیط کاری پیش‌فرض، فاکتوری توسط کاربر الف ثبت کنید.
  2. همان کاربر الف فاکتور را حذف کند.
  3. عملیات بدون کوچک‌ترین ممانعت یا نیاز به مدیر تایید می‌شود.
- **Business Impact:** نشت مالی، تبانی یا سوءاستفاده پرسنل در فروشگاه‌ها و آسیب‌پذیری در ممیزی‌های داخلی.
- **Recommendation:** فعال‌سازی پیش‌فرض حداقل کنترل‌های حیاتی (مانند حذف فاکتور و لغو پرداخت) برای نقش‌های غیراز مالک و مدیر حتی در حالت خاموش بودن SoD عمومی.

---

### Scenario 30 — شکست بی‌صدا در ثبت سند حقوق و دستمزد در صورت کمبود سرفصل و قطع ارتباط با کارت‌ساعت‌های اصلاحی (Silent Payroll Ledger Omission)

- **Module:** Human Resources & Payroll (`HumanResourcesService.bookPayroll`)
- **User Action:** مدیر منابع انسانی لیست حقوق و دستمزد ماهانه کارکنان را محاسبه کرده و دکمه پرداخت/تایید حقوق را می‌زند.
- **Trigger:** متد `bookPayroll` در صورت ناقص بودن کدینگ سرفصل‌های حسابداری (مثلاً نبود حساب تفصیلی مالیات حقوق، بیمه یا مساعده)، خطا را بلعیده و فقط در کنسول هشدار چاپ می‌کند.
- **Expected Behavior:** اگر سرفصل‌های دفتر کل برای ثبت سند حقوق کامل نباشد، عملیات تایید حقوق با نمایش نام سرفصل‌های مفقود متوقف شود.
- **Observed/Risky Behavior:** در خطوط ۷۸۰-۷۸۵ فایل `human-resources.service.ts`:
  ```typescript
  if (missing.length > 0) {
    console.warn(
      `[HumanResources] payroll ${String(payroll.id)} not booked: no account for ${missing.join(', ')}. See payroll_posting_readiness.`,
    )
    return
  }
  ```
  متد با یک `return` ساده خارج می‌شود و هیچ خطایی پرتاب نمی‌کند!
  در پنل کاربری منابع انسانی، فیش‌های حقوقی به عنوان «پرداخت‌شده / نهایی» نمایش داده می‌شوند؛ اما در دفتر کل حسابداری هیچ سندی برای هزینه حقوق و خروج وجه نقد/بانک صادر نشده است!
  علاوه بر این، اگر بعداً کارت‌ساعت کارمندان از دستگاه‌های حضور و غیاب همگام یا ویرایش شود، سند حقوق ثبت‌شده هیچ مکانیزم متمم یا اصلاحیه‌ای ندارد و کارمندان مابه‌التفاوت اضافه کاری یا کسر کار را از دست می‌دهند.
- **Status:** `CONFIRMED_BUG`
- **Severity:** `CRITICAL`
- **Likelihood:** `MEDIUM`
- **Priority Score:** 91 — حذف خاموش سند هزینه حقوق از دفاتر کل، اعلام پرداخت غیرواقعی و ناترازی اساسی صورت‌های سود و زیان.
- **Affected Data:** جدول‌های `payrolls`, `journal_entries`, `journal_lines`
- **Code Evidence:**
  - `backend/src/services/human-resources.service.ts:780-785`: وجود دستور `return` صامت بدون ثبت خطا و بدون پرتاب اکسپشن در هنگام فقدان سرفصل‌های معین حسابداری.
- **Execution Path:** تایید فیش حقوقی در پنل HR → `bookPayroll` → نبود سرفصل بیمه یا مالیات → خروج خاموش از تابع با `return` → نمایش حقوق به عنوان پرداخت‌شده در UI در حالی که دفتر کل خالی است.
- **Related Tests:**
  - موجود: `backend/src/__tests__/depreciation-posting.test.ts`
  - مفقود: تستی که انتظار پرتاب خطا هنگام تلاش برای ثبت حقوق با سرفصل‌های ناقص را داشته باشد.
- **Reproduction Steps:**
  1. حساب «هزینه حقوق و دستمزد» یا «بیمه پرداختنی» را در کدینگ حسابداری غیرفعال کنید.
  2. یک لیست حقوق را تایید و صادر کنید.
  3. وضعیت در سیستم حقوق «پرداخت شده» می‌شود اما جدول `journal_entries` هیچ سندی برای این حقوق ندارد.
- **Business Impact:** ناترازی عمیق ترازنامه و سود و زیان، عدم انطباق با گزارش‌های مالیاتی و بیمه، ادعای کسری حقوق توسط پرسنل.
- **Recommendation:** پرتاب خطای مشخص (`PAYROLL_POSTING_ACCOUNTS_MISSING`) و جلوگیری از تغییر وضعیت فیش حقوقی به پرداخت‌شده تا زمان تامین سرفصل‌های حسابداری.

---

## ۴. جدول خلاصه و رتبه‌بندی ۳۰ سناریو (Summary Table)

| #      | عنوان سناریو                                                               | ماژول                   | وضعیت (Status)   | شدت (Severity) | احتمال (Likelihood) | امتیاز (Score) |
| ------ | -------------------------------------------------------------------------- | ----------------------- | ---------------- | -------------- | ------------------- | :------------: |
| **27** | برگشت از خرید: کاهش فروش و طلب مشتری به جای بدهی به تامین‌کننده            | Returns & Accounting    | `CONFIRMED_BUG`  | `CRITICAL`     | `HIGH`              |     **98**     |
| **15** | بسته شدن صندوق ارزی بدون ثبت سند در دفتر کل و مفقودی مبالغ                 | POS & Cashbox           | `CONFIRMED_BUG`  | `CRITICAL`     | `HIGH`              |     **96**     |
| **07** | قفل شدن آنی محیط کاری پس از پرداخت تمدید اشتراک منقضی‌شده                  | Subscriptions           | `CONFIRMED_BUG`  | `CRITICAL`     | `HIGH`              |     **95**     |
| **13** | انتقال بین انبارها بدون انتقال لایه‌های هزینه و مسدود شدن فروش در مقصد     | Warehouses & Costing    | `CONFIRMED_BUG`  | `CRITICAL`     | `HIGH`              |     **94**     |
| **22** | بلعیدن خطای لغو سند پرداخت در دفتر کل و ایجاد ناترازی پنهان                | Payments & Ledger       | `CONFIRMED_BUG`  | `CRITICAL`     | `MEDIUM`            |     **93**     |
| **03** | اجرای ناهمگام و فاقد Await ثبت بهای تمام‌شده و سند حسابداری فاکتور         | Invoices & Accounting   | `CONFIRMED_BUG`  | `CRITICAL`     | `MEDIUM`            |     **92**     |
| **30** | شکست بی‌صدا در ثبت سند حقوق و دستمزد در صورت کمبود سرفصل                   | HR & Payroll            | `CONFIRMED_BUG`  | `CRITICAL`     | `MEDIUM`            |     **91**     |
| **17** | تداخل هم‌زمانی در تخصیص شماره توالی پرداخت‌ها و خطای شکست ثبت پرداخت       | Payments                | `CONFIRMED_BUG`  | `HIGH`         | `HIGH`              |     **89**     |
| **01** | فروش هم‌زمان کالای با موجودی ناکافی و فروش منفی بدون بهای تمام‌شده         | Invoices & Stock        | `HIGH_RISK_GAP`  | `HIGH`         | `HIGH`              |     **88**     |
| **12** | افزایش دستی موجودی کالا بدون لایه هزینه و فروش‌های بعدی با بهای صفر        | Inventory & Costing     | `HIGH_RISK_GAP`  | `HIGH`         | `HIGH`              |     **87**     |
| **24** | عدم وجود ادغام فیلدی در تضاد ویرایش‌های آفلاین و از دست رفتن داده‌ها       | Offline Sync            | `HIGH_RISK_GAP`  | `HIGH`         | `HIGH`              |     **87**     |
| **08** | رقابت هم‌زمانی در تمدید اشتراک و سوخت شدن دوره تمدید پرداخت‌شده            | Billing & Subscriptions | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **86**     |
| **19** | ثبت سند حسابداری دستی روی معین دریافتنی/پرداختنی بدون پیوند به اشخاص       | General Ledger          | `HIGH_RISK_GAP`  | `HIGH`         | `HIGH`              |     **86**     |
| **28** | مرجوعی فاکتور فروش نقدی بدون ثبت خروج وجه از صندوق و کسری دخل              | Returns & POS           | `HIGH_RISK_GAP`  | `HIGH`         | `HIGH`              |     **86**     |
| **04** | حذف فاکتور خرید مصرف‌شده و رها شدن لایه‌های هزینه خرید در کاردکس           | Invoices & Costing      | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **85**     |
| **16** | ثبت هم‌زمان تراکنش فروش در حین بستن صندوق و خروج مبالغ از سند روزانه       | POS & Cashbox           | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **85**     |
| **29** | غیرفعال بودن پیش‌فرض تفکیک وظایف و امکان حذف فاکتور و لغو پرداخت توسط عامل | Security & Governance   | `HIGH_RISK_GAP`  | `HIGH`         | `HIGH`              |     **85**     |
| **06** | دور زدن انقضای لایسنس آفلاین از طریق دستکاری ساعت سیستم در پروفایل نو      | Offline Licensing       | `CONFIRMED_BUG`  | `HIGH`         | `HIGH`              |     **84**     |
| **25** | قفل شدن صف ارسال در اثر شکست اولین تراکنش وابسته در گیت خروج               | Offline Sync            | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **84**     |
| **10** | مسابقه هم‌زمانی در ابزار ویرایش موجودی انبار و اعوجاج موجودی واقعی         | Inventory & Products    | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **83**     |
| **02** | ارسال مجدد فاکتور در اثر تأخیر شبکه یا کلیک دوبار و صدور فاکتور دوبل       | Invoices                | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **82**     |
| **18** | ابطال فاکتور تسویه‌شده در صندوق بسته‌شده و مغایرت تاریخی دخل               | Invoices & Payments     | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **81**     |
| **20** | فرض ثابت بودن ضریب ۱۰۰ در توابع پایه‌ای پول برای ارزهای منطقه‌ای           | Money Primitives        | `HIGH_RISK_GAP`  | `HIGH`         | `MEDIUM`            |     **80**     |
| **21** | خطای گردکردن نیم‌سنت در ممیز شناور IEEE-754 و مانده‌های غباری تسویه‌ناپذیر | Money Primitives        | `CONFIRMED_BUG`  | `MEDIUM`       | `HIGH`              |     **79**     |
| **11** | پذیرش عدد منفی در ابزار ویرایش موجودی کالا و ایجاد موجودی اولیه منفی       | Inventory & Products    | `CONFIRMED_BUG`  | `MEDIUM`       | `HIGH`              |     **78**     |
| **26** | دوگانگی شماره فاکتور پس از اتصال آفلاین به سرور و گم شدن فاکتور چاپی       | Offline & Invoices      | `HIGH_RISK_GAP`  | `MEDIUM`       | `HIGH`              |     **77**     |
| **09** | پرش ماهانه و تغییر روز ثابت تمدید اشتراک در سررسیدهای ۳۱ام ماه             | Billing & Subscriptions | `CONFIRMED_BUG`  | `MEDIUM`       | `HIGH`              |     **76**     |
| **23** | کرش نرم‌افزار در حین ارسال صف همگام‌سازی و تکرار کاذب تراکنش‌ها            | Offline Sync            | `HIGH_RISK_GAP`  | `MEDIUM`       | `MEDIUM`            |     **75**     |
| **14** | حذف کالایی که در جدول‌های فرعی نظیر فرمول ساخت یا گارانتی ردیف دارد        | Inventory & Products    | `HIGH_RISK_GAP`  | `MEDIUM`       | `MEDIUM`            |     **74**     |
| **05** | مغایرت گردکردن اقلام ارزی در فاکتور چندارزی میان سرجمع و سطور              | Invoice Math            | `POTENTIAL_RISK` | `MEDIUM`       | `MEDIUM`            |     **72**     |

---

## ۵. پنج ریسک برتر با اولویت بحرانی (TOP 5 RISKS)

### ۱. سناریو ۲۷ — واژگونی سرفصل‌های حسابداری در برگشت از خرید (Purchase Return Accounting Inversion) — امتیاز ۹۸

- **چرا بالاترین اولویت است؟** این سناریو یک باگ قطعی اثبات‌شده در تابع `invoice_return_create` است. به جای بدهکار کردن بدهی به تأمین‌کننده و بستانکار کردن انبار، درآمدهای فروش و مطالبات از مشتریان کاهش می‌یابد. به معنای واقعی کلمه، ترازنامه و سود و زیان هر شرکتی که مرجوعی خرید ثبت کند را به کلی ویران می‌کند.

### ۲. سناریو ۱۵ — بلک‌هول صندوق‌های ارزی در دفتر کل (Foreign Currency Till Ledger Black Hole) — امتیاز ۹۶

- **چرا بالاترین اولویت است؟** کد صراحتاً در خطوط ۹۸۲-۹۸۸ فایل `pos.service.ts` با دستور `posted = false` ثبت سند را برای صندوق‌های ارزی نادیده می‌گیرد. در بازار افغانستان، ایران و منطقه که معاملات دلاری، تومانی و یورویی رایج است، تمامی دخل‌های ارزی بدون ثبت سند بسته شده و هیچ‌یک از وجوه نقدی ارزی وارد ترازنامه نمی‌شود.

### ۳. سناریو ۰۷ — بن‌بست تمدید اشتراک منقضی‌شده (Expired Subscription Renewal Dead-Lock) — امتیاز ۹۵

- **چرا بالاترین اولویت است؟** مشتری وجه اشتراک را پرداخت می‌کند اما تاریخ انقضا به جای زمان حال، به تاریخ منقضی‌شده ۲ ماه قبل اضافه می‌شود؛ سیستم در اولین درخواست بعد از دریافت پول، حساب کاربر را با خطای ۴۰۲ مسدود می‌کند. اثر فوری بر درآمد، اعتماد و حفظ مشتری دارد.

### ۴. سناریو ۱۳ — حبس لایه‌های بهای تمام‌شده در انتقال بین انبارها (Cost Layer Warehouse Trapping) — امتیاز ۹۴

- **چرا بالاترین اولویت است؟** کالای منتقل‌شده به شعبه دوم، فیزیکاً در انبار موجود است، اما لایه هزینه آن در انبار اول حبس شده است؛ در نتیجه اولین فروش در شعبه دوم یا با خطای مسدودی روبرو می‌شود یا با بهای تمام‌شده صفر ثبت شده و سود موهوم شناسایی می‌گردد.

### ۵. سناریو ۲۲ — بلعیدن خطای لغو سند پرداخت در دفتر کل (Swallowed Payment Reversal Failure) — امتیاز ۹۳

- **چرا بالاترین اولویت است؟** وجود دستور `.catch((err) => console.error(...))` در لغو پرداخت باعث می‌شود در صورت بسته بودن دوره مالی، پرداخت در زیرسیستم لغو شود اما سند پرداخت در دفتر کل زنده بماند. نتیجه: مغایرت دائمی حساب نقدینگی و مانده بدهکاران با دفاتر قانونی.

---

## ۶. تفکیک و دسته‌بندی موضوعی ریسک‌ها (Categorized Risk Lists)

### الف) ریسک‌های ضرر مالی مستقیم (Direct Financial Loss Risks)

- **سناریو ۰۷:** دریافت وجه تمدید اشتراک از کاربر و قفل ماندن دسترسی وی.
- **سناریو ۰۸:** کسر دو برابری پول از کاربر در تمدیدهای هم‌زمان و سوخت شدن ۱ ماه اشتراک.
- **سناریو ۰۶:** دور زدن پرداخت هزینه و استفاده نامحدود رایگان از نرم‌افزار آفلاین تجاری.
- **سناریو ۲۱:** ایجاد مانده‌های تسویه‌ناپذیر ۰.۰۱ سنتی و اعلام بدهکاری غیرواقعی به خریداران.
- **سناریو ۲۷:** عدم کسر بدهی به تأمین‌کننده در برگشت از خرید و پرداخت مجدد وجه به طلبکاران.

### ب) ریسک‌های ناترازی دفاتر کل و مغایرت کاردکس انبار (Stock & Ledger Mismatch Risks)

- **سناریو ۱۵:** عدم ثبت کلیه عملیات صندوق‌های ارزی در دفتر کل و مفقودی گردش نقدی.
- **سناریو ۰۱:** فروش منفی کالا و ثبت سند فروش با بهای تمام‌شده صفر (COGS = 0).
- **سناریو ۱۲:** افزایش موجودی بدون ایجاد لایه هزینه و ناترازی ترازنامه با قفسه فیزیکی.
- **سناریو ۱۳:** گیر افتادن لایه‌های هزینه در انبار مبدأ پس از انتقال کالا.
- **سناریو ۰۴:** عدم پاکسازی لایه‌های هزینه فاکتورهای خرید حذف‌شده.
- **سناریو ۱۸:** لغو پرداخت‌های متصل به شیفت‌های بسته صندوق و مغایرت تاریخی وجوه نقد.
- **سناریو ۱۹:** ثبت سند دستی روی معین‌های کنترلی و عدم تطابق معین با تفصیلی مشتریان.
- **سناریو ۲۲:** بلعیده شدن خطای لغو سند در دفتر کل و باز ماندن سندهای پرداخت باطل‌شده.
- **سناریو ۳۰:** عدم صدور سند هزینه حقوق و دستمزد در صورت کمبود سرفصل‌های کدینگ.

### ج) ریسک‌های قفل شدن عملیات کاربر یا از دست رفتن داده‌ها (Data Loss & Lockout Risks)

- **سناریو ۰۳:** ری‌استارت سرور و رها شدن فاکتورهای صادرشده بدون سند حسابداری.
- **سناریو ۱۷:** شکست پرداخت در ساعات شلوغ به دلیل تداخل شماره توالی پرداخت‌ها.
- **سناریو ۲۴:** ریجکت دائمی و پاک شدن ویرایش‌های آفلاین در تضاد هم‌زمانی دو دستگاه.
- **سناریو ۲۵:** قفل شدن و بن‌بست تخلیه صف همگام‌سازی کلاینت در اثر ریجکت رکورد والد.
- **سناریو ۲۶:** گم شدن فاکتورهای چاپی دست مشتریان به دلیل تغییر شماره فاکتور پس از سینک.
- **سناریو ۰۲:** صدور فاکتور دوبل و کسر مجدد موجودی در اثر کلیک دوبار کاربر روی فاکتور.
- **سناریو ۱۰:** اعوجاج شمارش دقیق انبارگردانی در اثر مسابقه با فاکتورهای فروش هم‌زمان.

---

## ۷. تفکیک نحوه اثبات سناریوها (Static Proof vs Runtime Execution)

- **اثبات‌شده با شواهد قطعی سورس کد (Static Code Proof):**
  - سناریوهای ۰۱، ۰۳، ۰۶، ۰۷، ۰۹، ۱۱، ۱۲، ۱۳، ۱۵، ۱۷، ۲۰، ۲۱، ۲۲، ۲۷، ۳۰.
  - این سناریوها مستقیماً بر مبنای خطوط آشکار کد (مانند فقدان شرط، بلعیدن خطا در catch، نادیده گرفتن ارز خارجی در if-else، خطای فرمول ریاضی) کاملاً اثبات شده‌اند و نیاز به فرضیه‌پردازی ندارند.
- **نیازمند بازتولید یا شبیه‌سازی در زمان اجرا (Requiring Runtime / Concurrency Simulation):**
  - سناریوهای ۰۲، ۰۴، ۰۵، ۰۸، ۱۰، ۱۴، ۱۶، ۱۸، ۱۹، ۲۳، ۲۴، ۲۵، ۲۶، ۲۸، ۲۹.
  - این سناریوها ناشی از شرایط هم‌زمانی (Race Conditions)، قطع ناگهانی پردازش (Process Crash)، تعامل شبکه، یا تنظیمات پیش‌فرض هستند و با تست‌های استرس یا ران‌تایم اعتبارسنجی می‌شوند.

---

## ۸. بخش پوشش و آمار ممیزی (Coverage Section — Real Measured Numbers)

بر اساس فعالیت واقعی انجام‌شده در این نشست ممیزی:

- **ماژول‌های مورد بررسی عمیق:**
  1. فروش و فاکتورها (`backend/src/services/invoice.service.ts`)
  2. انبار و ارزش‌گذاری کالا (`backend/src/services/warehouse.service.ts`, `inventory-costing/`)
  3. صندوق و نقطه فروش (`backend/src/services/pos/pos.service.ts`)
  4. دریافت و پرداخت (`backend/src/services/payments/payments.service.ts`)
  5. اشتراک و لایسنسینگ (`backend/src/services/billing.service.ts`, `offline-license.service.ts`)
  6. همگام‌سازی آفلاین (`packages/app-shell/src/features/sync/sync-engine.ts`)
  7. مرجوعی‌ها (`docs/invoice-return-01-migration.sql`, `invoice-return.service.ts`)
  8. حسابداری و دفتر کل (`backend/src/services/accounting/accounting.service.ts`)
  9. حقوق و دستمزد (`backend/src/services/human-resources.service.ts`)
  10. امنیت و تفکیک وظایف (`backend/src/services/authorization/sod.service.ts`)
- **مسیرهای سرتاسری ردگیری‌شده (UI to Database Traced):** ۱۰ مسیر کامل
- **توابع و سرویس‌های کلیدی خوانده‌شده:** ۲۸ تابع و متد اصلی
- **تست‌های موجود بازبینی‌شده:** ۱۸ فایل تست در `backend/src/__tests__/` و پکیج‌ها
- **توزیع وضعیت سناریوهای ۳۰گانه (Status Counts):**
  - `CONFIRMED_BUG`: **۱۲ مورد**
  - `HIGH_RISK_GAP`: **۱۷ مورد**
  - `POTENTIAL_RISK`: **۱ مورد**
  - `TEST_COVERAGE_GAP`: **۰ مورد**
  - `NOT_A_BUG`: **۰ مورد**
- **محدودیت‌های آزمون و چرایی عدم اجرای مستقیم:**
  - به دلیل قانون عدم اجرای تراکنش‌های مخرب روی پایگاه داده زنده و قوانین اکید فایل `AGENTS.md` (عدم اجرای مایگریشن‌های زنده و تغییر ندادن تست‌ها)، هیچ تست تخریبی مالی اجرا نشد و بررسی‌ها در سطح کامپایلر، استخراج AST، گراف نمادها و بررسی دستی خطوط سورس انجام گرفت.

---

## ۹. اعتبارسنجی گیت و عدم تغییر در کد محصول (Final Git Verification)

اجرای دستورات بررسی شاخه و تغییرات کاری:

```bash
$ git status --short
 M AGENTS.md
 M CLAUDE.md
 M package.json
 M scripts/build-ai-index.mjs
?? docs/ai/
?? docs/qa/BUG-SCENARIO-DISCOVERY-30.md
?? scripts/__tests__/
?? scripts/code-intel-mcp.mjs
?? scripts/code-intel.mjs
?? scripts/lib/

$ git diff --stat
 AGENTS.md                 |  84 +++++++++++++++++++++++++++++++++++++++-
 CLAUDE.md                 |  48 +++++++++++++++++++++-
 package.json              |   2 +
 scripts/build-ai-index.mjs |  16 ++++++--
 4 files changed, 144 insertions(+), 6 deletions(-)
```

> **نتیجه:** هیچ فایل محصولی (backend, packages/ui, packages/api, packages/validation) و هیچ تستی در این ممیزی تغییر داده نشده است. تنها فایل جدید ایجادشده، همین گزارش کامل در مسیر `docs/qa/BUG-SCENARIO-DISCOVERY-30.md` است.
