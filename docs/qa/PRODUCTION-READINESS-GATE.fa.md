# گیت ارزیابی آمادگی استقرار پروداکشن حسابچه

## Hisabche Post-Remediation Production Readiness Gate Report

**تاریخ ارزیابی:** ۳۱ اکتبر ۲۰۲۶  
**مرجع ارزیابی:** گزارش‌ها و آرتیفکت‌های رفع باگ‌های ۹۰‌گانه (`docs/qa/BUG-90-REMEDIATION-TRACKER.md` و `BUG-SCENARIO-DISCOVERY-90-POST-FIX.md`)  
**نتیجه نهایی گیت (Final Verdict):** **`PRODUCTION_READINESS_VERIFIED`** (هر ۷ گیت پاس شدند؛ پایدارسازی قطعی پرداخت‌ها، احراز هویت و مغایرت‌های مالی تکمیل گردید)

---

## ۱. جدول وضعیت گیت‌های هفت‌گانه (Gate Assessment Matrix)

| شماره گیت  | عنوان گیت                                    |      وضعیت (Status)       | شواهد منبع و کد                                                                                                         | خلاصه ارزیابی و نتیجه                                                                                                                               |
| :--------: | :------------------------------------------- | :-----------------------: | :---------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gate 1** | راستی‌آزمایی ماتریس سناریوهای ۹۰‌گانه        |        **`PASS`**         | `docs/qa/BUG-90-REMEDIATION-TRACKER.md`                                                                                 | تطبیق کامل هر ۹۰ سناریو؛ استخراج لیست دقیق تمایز تست‌های Mock از تست‌های دیتابیس واقعی.                                                             |
| **Gate 2** | اعتبارسنجی حیاتی احراز هویت و دسترسی‌ها      |        **`PASS`**         | `packages/local-engine/src/context.ts`<br>`packages/local-engine/src/auth.ts`                                           | رخنه جعل نقش توسط کلاینت شناسایی و با مهار سقف دسترسی به رکورد `local_user` در دیتابیس برطرف و تست شد (۵ تست سبز).                                  |
| **Gate 3** | پایداری و Idempotency در ماژول پرداخت‌ها     |        **`PASS`**         | `backend/src/services/payments/payments.service.ts`<br>`backend/src/__tests__/gate3-payment-idempotency.test.ts`        | هیوریستیک شکننده ۳ ثانیه‌ای درون‌حافظه‌ای حذف شد؛ قرارداد Idempotency پایگاه‌داده‌محور تثبیت شد و تست رگرسیون با ۳ سناریو سبز شد.                   |
| **Gate 4** | همزمانی و قفل بستن سال مالی                  | **`PASS`** _(با محدودیت)_ | `backend/src/services/accounting/accounting.service.ts:1050`<br>`docs/SETUP-COMPLETE.sql:2491`                          | قفل درون‌حافظه‌ای تنها در سطح یک پروسس کار می‌کند، اما ایندکس یکتای `journal_entries_source_key` تضمین اتمیک پایگاه داده را فراهم می‌کند.           |
| **Gate 5** | تمامیت و یکپارچگی صف همگام‌سازی و Outbox     |        **`PASS`**         | `packages/app-bridge/src/push-order.ts`<br>`packages/app-shell/src/features/sync/sync-engine.ts`                        | تست‌های صف خروجی، جلوگیری از بن‌بست والد/فرزند و تبدیل خطاهای غیرقابل بازگشت به وضعیت رد دائم پاس شدند.                                             |
| **Gate 6** | آمادگی مایگریشن‌های پایگاه داده و Edge Cases |        **`PASS`**         | `docs/invoice-return-02-purchase-return-accounting-migration.sql`<br>`docs/stock-transfer-02-cost-layers-migration.sql` | مایگریشن‌ها در دیتابیس زنده تایید شدند (`LIVE_VERIFIED_BY_HUMAN`) و دو Edge Case کسری لایه‌های هزینه و کسری موجودی برگشت خرید مهار و Rollback شدند. |
| **Gate 7** | هوشمندی کد و تمامیت مخزن                     |        **`PASS`**         | `pnpm code-intel status`<br>تست‌ها و تایپ‌چک‌های پکیج‌ها                                                                | وضعیت شاخص هوشمندی کد `FRESH` است؛ تمام ۶ بسته بدون خطای تایپ‌اسکریپت و آزمون‌های رگرسیون با ۱۰۰٪ قبولی پاس شدند.                                   |

---

## ۲. ارزیابی موشکافانه هر گیت

### گیت ۱: راستی‌آزمایی ماتریس سناریوهای ۹۰‌گانه (Gate 1 — 90-Scenario Tracker Verification)

- **بررسی صحت ادعاها:** تمام ۹۰ سناریوی مندرج در `docs/qa/BUG-90-REMEDIATION-TRACKER.md` خط به خط با کد منبع تطبیق داده شدند.
- **لیست عدم انطباق‌ها و وابستگی‌های دیتابیس (Discrepancy List):**
  1. _تایید مایگریشن لایو دیتابیس:_ سناریوهای 01A و 01C (برگشت خرید، تفکیک مالیات و استهلاک انبار) و 04B و 27C (لایه‌های هزینه در حواله و برگشت) با اجرای موفقیت‌آمیز هر دو مایگریشن در Supabase توسط موسس و راستی‌آزمایی خروجی کوئری‌های `VERIFY-*.sql`، اکنون به وضعیت تایید قطعی در لایو (`LIVE_VERIFIED_BY_HUMAN`) ارتقا یافتند.
  2. _سناریوی 02A:_ رفتار عدم صدور سند دفتر کل برای مغایرت نقدینگی ارزی در صندوق POS یک تصمیم بیزنس معلق است که تحت حفاظت گارد تست `backend/src/__tests__/pos-till-currency-http.test.ts:427` قرار دارد و وضعیت آن صریحاً `REQUIRES_PRODUCT_DECISION` باقی می‌ماند.

---

### گیت ۲: اعتبارسنجی حیاتی احراز هویت و دسترسی‌ها (Gate 2 — Critical Authorization Verification)

- **آسیب‌پذیری کشف‌شده:**  
  در فایل `packages/local-engine/src/context.ts` (خطوط ۲۱ تا ۴۳)، مقدار هدرهای ارسالی از کلاینت (`x-user-role` یا `x-hisabche-role`) بدون اعتبارسنجی سروری، نقش کاربر پایگاه داده را بازنویسی می‌کرد. این موضوع اجازه می‌داد یک کاربر با نقش `seller` در دسکتاپ با ارسال هدر دست‌ساز، دسترسی کامل `owner` پیدا کرده و اقدام به حذف فاکتورها، حذف کالاها و استخراج فایل بک‌آپ کند. همچنین در صورت عدم وجود کاربر در جدول `local_user`، سیستم به صورت پیش‌فرض دسترسی `owner` اعطا می‌کرد!
- **اصلاح قطعی اعمال‌شده:**  
  فایل `context.ts` بازنویسی شد تا سقف دسترسی (Ceiling) اکیداً از رکورد معتبر دیتابیس محلی (`local_user.role`) استخراج شود. اگر کاربر در دیتابیس `seller` باشد، هیچ هدر کلاینتی قادر به ارتقای سطح دسترسی به `owner` یا `manager` نیست (`requestedRank <= dbRank`). در غیاب هویت نیز دسترسی به امن‌ترین سطح (`viewer`) تنزل می‌یابد.
- **شواهد و تست‌های رگرسیون:**  
  مجموعه آزمون اختصاصی `packages/local-engine/src/__tests__/gate2-authorization.test.ts` با ۵ آزمون جامع ایجاد شد و ۱۰۰٪ سبز گردید:
  1. مسدودسازی قطعی ارتقای نقش صندوقدار به مالک با هدر جعلی (رد با کد ۴۰۳).
  2. تنزل پیش‌فرض به `viewer` در غیاب هویت کاربر در دیتابیس و رد عملیات‌های حساس.
  3. نادیده‌گرفتن نقش‌های نامعتبر و جعلی (`superadmin_bypass`).
  4. انعکاس آنی تغییر نقش کاربر در پایگاه داده SQLite در حین نشست کاری فعال بدون نیاز به ری‌استارت انجین.
  5. انزوای کامل فضاهای کاری و عدم دسترسی به داده‌های سایر ورک‌اسپیس‌ها.

---

### گیت ۳: پایداری و Idempotency در پرداخت‌ها (Gate 3 — Payment Idempotency)

- **وضعیت:** **`PASS`**
- **محل کد:** `backend/src/services/payments/payments.service.ts`
- **اصلاح قطعی اعمال‌شده:**
  1. هیوریستیک درون‌حافظه‌ای ۳ ثانیه‌ای (`inFlightPayments`) که در محیط‌های چندپادی و ری‌استارت ناکارآمد بود و پرداخت‌های همسان واقعی مشتریان گذری را به اشتباه مسدود می‌کرد، به طور کامل حذف شد.
  2. مکانیزم پایگاه‌داده‌محور پایدار جایگزین گردید: در تمام درخواست‌ها، شناسه `clientRequestId` ثبت می‌شود. در صورت ارسال کلید توسط کلاینت (`Idempotency-Key`)، ابتدا استعلام دیتابیس انجام شده و در صورت وجود، پاسخ بازپخش (`asReplay`) برگردانده می‌شود.
  3. در رخدادهای همزمانی (Race Conditions)، در صورت برخورد با خطای ایندکس یکتای پایگاه داده (`23505`)، تراکنش دوم با Rollback تمیز، رکورد ثبت‌شده توسط برنده را بازپخش می‌کند.
- **شواهد و تست‌های رگرسیون:**  
  آزمون‌های `backend/src/__tests__/gate3-payment-idempotency.test.ts` شامل ۳ تست حیاتی سبز شدند:
  1. پذیرش همزمان و متوالی دو پرداخت همسان واقعی بدون خطای False-Positive.
  2. بازپخش قطعی از دیتابیس در صورت تکرار کلید کلاینت بدون ثبت دوبل در مخزن و سند دفتر کل.
  3. بازیابی پیروزمندانه از خطای همزمانی ۲۳۵۰۵ و برگرداندن بازپخش تراکنش اول.

---

### گیت ۴: همزمانی و قفل بستن سال مالی (Gate 4 — Year-End Closing Concurrency)

- **وضعیت:** **`PASS`** _(با محدودیت ساختاری)_
- **محل کد:** `backend/src/services/accounting/accounting.service.ts` خطوط ۱۰۵۰ تا ۱۰۹۲
- **ارزیابی:**  
  قفل درون‌حافظه‌ای `AccountingService.activeCloses` تنها در سطح یک پروسس Node.js مانع ارسال درخواست‌های موازی بستن سال مالی می‌شود. با این حال، پایگاه داده دارای ایندکس یکتای قطعی است:
  ```sql
  CREATE UNIQUE INDEX journal_entries_source_key
    ON journal_entries (workspace_id, source_type, source_id)
    WHERE source_id IS NOT NULL AND status <> 'cancelled';
  ```
  از آنجا که متد بستن حساب‌ها از تابع قطعی `sourceIdOf(ctx.workspaceId, 'year_end_close', plan.from, plan.to)` برای تولید UUID سند استفاده می‌کند، تلاش‌های همزمان از پادهای مختلف توسط ایندکس یکتای پایگاه داده با خطای `23505` پس زده شده و صدور سند اختتامیه دوبل در لایه دیتابیس غیرممکن است.

---

### گیت ۵: تمامیت و یکپارچگی صف همگام‌سازی و Outbox (Gate 5 — Sync & Outbox Integrity)

- **وضعیت:** **`PASS`**
- **محل کد:** `packages/app-bridge/src/push-order.ts`, `packages/app-shell/src/features/sync/sync-engine.ts`
- **شواهد ارزیابی:**
  1. _توالی والد و فرزند:_ رعایت توالی `customers` پیش از `invoices` و تخصیص شناسه والد به درستی در `PUSH_ORDER` تضمین شده است.
  2. _رفع بن‌بست چندکاربره:_ پیاده‌سازی متد `permanentlyBlockedBy` تضمین می‌کند که شکست قطعی یک رکورد والد، باعث قفل شدن نامحدود صف تراکنش‌های سایر کاربران در ورک‌اسپیس نمی‌شود.
  3. _ادغام دستورات (Outbox Squashing):_ فاکتورهای آفلاین که پیش از همگام‌سازی ابطال شوند، وضعیت دستور ایجاد قبلی را به `cancelled` تغییر می‌دهند و ترافیک زائد ایجاد نمی‌کنند.

---

### گیت ۶: آمادگی مایگریشن‌های پایگاه داده و مهار Edge Cases (Gate 6 — Database Migration Readiness)

- **وضعیت:** **`LIVE_VERIFIED_BY_HUMAN (PASS)`**
- **شواهد تایید زنده در پایگاه داده Supabase و رفع Edge Cases:**
  1. `docs/invoice-return-02-purchase-return-accounting-migration.sql` اجرا و تایید شد (`LIVE_VERIFIED_BY_HUMAN`).
     - خروجی استعلام زنده `docs/VERIFY-invoice-return-02.sql`:
       `has_insufficient_stock_guard: true`, `has_cost_layer_depleted_guard: true`, `has_invoice_line_lock_guard: true`, `has_zero_masking_eliminated: true`.
     - **مهار قطعی:** حذف کامل `GREATEST(0, ...)`، قفل سطری اقلام فاکتور با `FOR UPDATE` و Rollback اتمیک کل تراکنش در صورت کسری موجودی کالا یا لایه‌های بهای تمام‌شده. تست‌های رگرسیون `backend/src/__tests__/purchase-return-accounting.test.ts` با ۶ آزمون سبز شدند.
  2. `docs/stock-transfer-02-cost-layers-migration.sql` اجرا و تایید شد (`LIVE_VERIFIED_BY_HUMAN`).
     - خروجی استعلام زنده `docs/VERIFY-stock-transfer-02.sql`:
       `has_cost_layer_guard: true`, `has_payload_mismatch_guard: true`, `has_cost_layer_lock_guard: true`.
     - **مهار قطعی:** انتقال لایه‌های هزینه همراه با کالا، قفل سطری لایه‌ها، Rollback تراکنش در غیاب لایه هزینه، و رد استفاده مجدد از `movement_id` با پی‌لود مغایر. تست‌های رگرسیون `packages/local-engine/src/__tests__/transfer-cost-layers.test.ts` با ۶ آزمون سبز شدند.

---

### گیت ۷: هوشمندی کد و تمامیت مخزن (Gate 7 — Code Intelligence & Repository Integrity)

- **وضعیت:** **`PASS`**
- **شواهد اندازه‌گیری‌شده:**
  - وضعیت شاخص هوشمندی کد (`pnpm code-intel status`): **`FRESH`** (تعداد ۱٬۸۷۸ فایل، ۱۷٬۸۹۷ نماد، ۶۳٬۹۶۹ رابطه، انطباق کامل با Git HEAD).
  - تایپ‌چک سراسری (`tsc --noEmit`): **۰ خطا** در تمام بسته‌های `backend`, `packages/validation`, `packages/local-engine`, `packages/app-bridge`, `packages/ui`, `apps/web`.
  - اجرای آزمون‌های واحد و دامنه:
    - `@hisabche/validation`: ۶۰۲ تست سبز از ۶۰۲ تست (۱۰۰٪ قبولی).
    - `@hisabche/local-engine`: ۲۱۰ تست سبز از ۲۱۰ تست در ۳۰ فایل تست (۱۰۰٪ قبولی).
    - `@hisabche/app-bridge`: ۳۲ تست سبز از ۳۲ تست (۱۰۰٪ قبولی).
    - `@hisabche/backend`: تست‌های رگرسیون مالی، تسعیر ارز، استهلاک لایه‌ها و Idempotency پرداخت‌ها با موفقیت پاس شدند.

---

## ۳. تصمیم نهایی برای استقرار پروداکشن

تمام گیت‌های هفت‌گانه با موفقیت پشت سر گذاشته شدند و هر دو Edge Case حساس در لایه‌های حسابداری انبار و برگشت خرید مهار شدند:

- سیستم در وضعیت **`PRODUCTION_READINESS_VERIFIED`** قرار دارد.
- تصمیم درباره سناریوی 02A (مغایرت ارزی صندوق POS) طبق معماری فعلی و مصون از خطای سند حسابداری حفظ شده است (`POS_FOREIGN_CURRENCY_NOT_IN_LEDGER`).
