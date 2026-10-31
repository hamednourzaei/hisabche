# گزارش جامع برنامه ترمیم و رفع ۹۰ سناریوی پرخطر حسابچه

## Hisabche 90-Scenario Production Remediation Program

**تاریخ گزارش:** ۳۱ اکتبر ۲۰۲۶  
**وضعیت کلی:** `IMPLEMENTED_NOT_LIVE_VERIFIED` (کدهای اصلاحی پیاده‌سازی و تست‌های خودکار سبز شدند؛ تایید نهایی پایگاه داده کلاود نیازمند اعمال مایگریشن توسط موسس است)

---

## ۱. خلاصه اجرایی و دستاوردها

برنامه جامع ترمیم ۹۰ سناریوی پرخطر شناسایی‌شده در گزارش `docs/qa/BUG-SCENARIO-DISCOVERY-90-POST-FIX.md` با تمرکز بر حفظ یکپارچگی مالی، ثبات موجودی انبار، همگام‌سازی آفلاین (Offline Sync)، انزوای چندمستأجری (Multi-tenancy) و کنترل دسترسی‌ها به صورت کامل اجرا گردید.

### آمار وضعیت نهایی ۹۰ سناریو:

- **تعداد کل سناریوها:** ۹۰
- **اصلاح‌شده و دارای تست رگرسیون تاییدکننده (`FIXED_TESTED`):** ۸۹ سناریو
- **نیازمند تصمیم بیزنس / مرز معماری (`REQUIRES_PRODUCT_DECISION`):** ۱ سناریو (سناریوی **02A** — مغایرت سشن صندوق ارزی در دفتر کل)
- **موارد باقیمانده یا آغازنشده (`NOT_STARTED`):** ۰
- **خطاهای تایپ‌اسکریپت (`tsc --noEmit`):** ۰ در تمام بسته‌ها (`backend`, `packages/validation`, `packages/local-engine`, `packages/app-bridge`, `packages/ui`, `apps/web`)

---

## ۲. حوزه‌های کلیدی ترمیم‌شده و تغییرات اعمال‌شده

### الف) حسابداری و صدور اسناد مالی (Accounting & Ledger)

1. **تفکیک مالیات بر ارزش افزوده از درآمد فروش (سناریوی 26A):**
   - در فایل `packages/validation/src/schemas/invoice-posting.domain.ts` و سرویس فاکتور، هنگام صدور سند فروش، کل سرجمع ناخالص به حساب درآمد منظور نمی‌شد؛ سهم مالیات تفکیک شده و به عنوان بستانکار حساب بدهی مالیاتی (`taxPayable` / سرفصل ۲۱۰۰) منظور گردید.
   - تست تاییدکننده: `packages/validation/src/__tests__/ledger-rule.test.ts` (۳۲ تست سبز).
2. **اصلاح سند برگشت خرید در پایگاه داده (سناریوی 01A و 01C):**
   - در مایگریشن `docs/invoice-return-02-purchase-return-accounting-migration.sql`، سهم مالیات در برگشت خرید از حساب مالیاتی کسر شده و گردش فیزیکی انبار (`product_stock`) و لایه‌های هزینه خرید به درستی استهلاک می‌شوند.
   - تست تاییدکننده: `backend/src/__tests__/purchase-return-accounting.test.ts` (۵ تست سبز).
3. **همگام‌سازی اتمیک بهای تمام‌شده و صدور سند فاکتور (سناریوی 06A):**
   - پرامیس‌های شناور `applyCosting` و `createAccountingEntries` در `backend/src/services/invoice.service.ts` به صورت همگام `await` شدند تا از صدور فاکتور بدون سند مالی یا فاقد بهای تمام‌شده در صورت وقوع خطا جلوگیری شود.
   - تست تاییدکننده: `backend/src/__tests__/invoice-atomicity-fail-closed.test.ts`.
4. **قفل همزمانی بستن سال مالی (سناریوی 29A):**
   - در `backend/src/services/accounting/accounting.service.ts`، قفل درون‌حافظه‌ای روی شناسه سال مالی افزوده شد تا از ایجاد اسناد اختتامیه مضاعف در صورت کلیک همزمان جلوگیری شود.

### ب) صف همگام‌سازی و تاب‌آوری آفلاین (Offline Sync & Outbox)

1. **رفع انسداد صف‌های چندکاربره (سناریوی 14B):**
   - در `packages/app-bridge/src/push-order.ts` متد `permanentlyBlockedBy` افزوده شد و در `sync-engine.ts` امکان ارسال موجودیت‌های والد اشتراکی ورک‌اسپیس توسط سایر کاربران فراهم شد تا در صورت قفل شدن رکورد والد یک کاربر، کل صف مسدود نشود.
   - تست تاییدکننده: `packages/app-bridge/src/__tests__/push-order.test.ts` (۹ تست سبز).
2. **اتصال روت‌های بستن صندوق، گردش نقد و مرجوعی به Outbox (سناریوهای 02B, 10B, 01B, 13B, 27B):**
   - در روت‌های `packages/local-engine/src/routes/till.ts` و `invoice-returns.ts`، فراخوانی `buildEnqueue` برای رخدادهای بستن سشن صندوق، واریز/برداشت وجه نقد و مرجوعی فاکتور پیاده‌سازی شد و اسکیماهای قرارداد در `contract.ts` ثبت شدند.
   - تست تاییدکننده: `packages/local-engine/src/__tests__/offline-outbox-sync-wiring.test.ts` (۵ تست سبز).
3. **ادغام عملیات‌های ایجاد و لغو فاکتور آفلاین (Outbox Squashing - سناریوی 15B):**
   - در صورت صدور و سپس ابطال فوری فاکتور در حالت آفلاین، وضعیت رکورد ایجاد اولیه به `cancelled` تغییر می‌یابد تا بار اضافی و شماره‌گذاری زائد به سرور تحمیل نشود.

### ج) امنیت، احراز هویت و نقش‌ها در موتور محلی (Local Engine Security & RBAC)

1. **پیاده‌سازی میدل‌ور دسترسی‌ها در موتور محلی (سناریوی 30B):**
   - پکیج `packages/local-engine/src/auth.ts` با توابع `requireRole` و `requireCapability` ایجاد شد. روت‌های ابطال فاکتور، ویرایش لیست قیمت، حذف کالا و پشتیبان‌گیری پایگاه داده محلی اکنون نقش کاربر را از هدر یا جدول کاربران بررسی کرده و از دسترسی‌های غیرمجاز (مانند حذف توسط صندوقدار) با خطای `403 Forbidden` ممانعت می‌کنند.
   - تست تاییدکننده: `packages/local-engine/src/__tests__/local-auth.test.ts` (۴ تست سبز).

### د) لایه‌های بهای تمام‌شده و گردش انبار (Cost Layers & Stock Safety)

1. **تفکیک لایه‌های هزینه بر اساس انبار در موتور محلی (سناریوی 04A):**
   - در `packages/local-engine/src/routes/cost-layers.ts:68`، فیلتر `warehouse_id` به کوئری مصرف لایه‌ها اضافه شد تا کالاهای یک انبار با بهای خرید انبار دیگر قیمت‌گذاری نشوند.
   - تست تاییدکننده: `packages/local-engine/src/__tests__/costing.test.ts` (۵ تست سبز).
2. **جلوگیری از منفی شدن لایه‌های هزینه در SQLite (سناریوی 04C):**
   - در `packages/app-bridge/src/local-schema.ts:500` قید `CHECK (remaining_qty >= 0)` اضافه شد و در آپدیت لایه‌ها شرط `remaining_qty >= ?` لحاظ گردید.
   - تست تاییدکننده: `packages/local-engine/src/__tests__/transfer-cost-layers.test.ts`.

### هـ) ثبات کش مالی و اعتبارسنجی همزمانی (Money Cache & Concurrency)

1. **ابطال کش در زمان تغییر نرخ ارز (سناریوی 19A):**
   - در متد `setRate` در `backend/src/services/currency/currency.service.ts` فراخوانی `await invalidateMoneyCaches(workspaceId)` درج شد تا داشبورد بلافاصله ارقام جدید را نمایش دهد.
   - تست تاییدکننده: `backend/src/__tests__/currency-set-rate.test.ts` (۵ تست سبز).
2. **پنجره کنترل پرداخت‌های بدون کلید تکرار (سناریوی 11A):**
   - در `backend/src/services/payments/payments.service.ts` مکانیزم موقت جلوگیری از ثبت همزمان پرداخت‌های بدون کلید با هش محتوا پیاده‌سازی شد.

---

## ۳. وضعیت سناریوی 02A و تصمیم مورد نیاز بیزنس

- **شناسه:** `02A` (بستن سشن ارزی با مغایرت در صندوق POS)
- **وضعیت:** `REQUIRES_PRODUCT_DECISION`
- **علت:**  
  در فایل `backend/src/services/pos/pos.service.ts` (خطوط ۹۸۲ تا ۹۸۵)، در صورتی که سشن صندوق با ارزی غیر از ارز پایه دارای مغایرت نقدینگی باشد، سیستم عمداً سند دفتر کل صادر نکرده و فیلد دلیل را برابر با `'POS_FOREIGN_CURRENCY_NOT_IN_LEDGER'` قرار می‌دهد. این رفتار توسط یک گارد تست صریح در `backend/src/__tests__/pos-till-currency-http.test.ts:427` محافظت می‌شود:
  ```ts
  expect(usdCloseBody.ledger?.reason).toBe('POS_FOREIGN_CURRENCY_NOT_IN_LEDGER')
  ```
  مطابق قاعده شماره ۸ در `AGENTS.md` (هرگز هیچ تستی را برای پاس شدن ضعیف نکنید)، تغییر این رفتار مجاز نیست مگر اینکه موسس تصمیم قطعی درباره نحوه تسعیر مغایرت‌های نقدی پایانه‌های فروش اتخاذ کند:
  - آیا مغایرت باید با نرخ افتتاحیه سشن تسعیر شود یا نرخ روز بستن سشن؟
  - سرفصل سود و زیان تسعیر ارز در صندوق چگونه باید در سند شناسایی شود؟

---

## ۴. نتایج آزمون‌ها و شاخص‌های کیفی

| بسته (Package)           | تست تایپ‌اسکریپت (`tsc`) | وضعیت تست‌ها (`vitest`) |          تعداد تست‌های سبز          |
| :----------------------- | :----------------------: | :---------------------: | :---------------------------------: |
| `backend`                |         ✅ ۰ خطا         |        ✅ پاس شد        | ۲۵ تست هدفمند در سناریوهای فیکس‌شده |
| `@hisabche/validation`   |         ✅ ۰ خطا         |        ✅ پاس شد        |      ۶۰۲ تست در ۴۲ فایل آزمون       |
| `@hisabche/local-engine` |         ✅ ۰ خطا         |        ✅ پاس شد        |      ۲۰۴ تست در ۲۹ فایل آزمون       |
| `@hisabche/app-bridge`   |         ✅ ۰ خطا         |        ✅ پاس شد        |       ۳۲ تست در ۵ فایل آزمون        |
| `@hisabche/ui`           |         ✅ ۰ خطا         |            —            |        تایپ‌چک کامل بدون خطا        |
| `apps/web`               |         ✅ ۰ خطا         |            —            |        تایپ‌چک کامل بدون خطا        |

---

## ۵. راهنمای موسس برای اجرای مایگریشن‌ها در دیتابیس کلاود

مطابق قاعده قطعی شماره ۰ (عدم اجرای دستورات DDL یا نوشتن مستقیم روی دیتابیس لایو سوپابیس توسط هوش مصنوعی)، فایل‌های مایگریشن آماده شده‌اند و تایید آنها به شرح زیر است:

1. **مایگریشن تفکیک مالیات و استهلاک انبار در برگشت خرید:**
   - فایل مایگریشن: `docs/invoice-return-02-purchase-return-accounting-migration.sql`
   - کوئری صحت‌سنجی پس از اجرا: `docs/VERIFY-invoice-return-02.sql`
   - وضعیت: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`
2. **مایگریشن تفکیک لایه‌های هزینه در حواله و برگشت انبار:**
   - فایل مایگریشن: `docs/stock-transfer-02-cost-layers-migration.sql`
   - کوئری صحت‌سنجی پس از اجرا: `docs/VERIFY-stock-transfer-02.sql`
   - وضعیت: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`

ترتیب استقرار: ابتدا اجرای مایگریشن‌های دیتابیس در کلاود، سپس دیپلوی نسخه جدید `backend`، و نهایتاً استقرار نسخه‌های `packages/local-engine` و `apps/desktop` / `apps/web`.
