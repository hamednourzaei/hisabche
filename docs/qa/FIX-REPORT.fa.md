# گزارش جامع برنامه ترمیم رخنه‌های بحرانی موتاسیون، دفتر کل، انبار و همگام‌سازی (حسابچه)

## ۱. وضعیت نهایی (Status)

**`IMPLEMENTED_NOT_LIVE_VERIFIED`**  
(کلیه ۹ بسته به‌طور کامل پیاده‌سازی و با تست‌های خودکار رگرسیون در محیط لوکال/شبیه‌ساز تأیید شدند؛ هیچ دسترسی به پایگاه داده زنده سوپابیس برای اجرای DDL وجود ندارد.)

---

## ۲. فایل‌های تغییریافته (Files Changed)

### Backend

1. `backend/src/services/payments/payments.service.ts`: جابجایی معکوس‌سازی سند حسابداری قبل از ابطال پرداخت و حذف `.catch` برای جلوگیری از بلعیده شدن خطاهای دوره بسته (Batch 1).
2. `backend/src/services/invoice.service.ts`: حذف فال‌بک غیراتمیک `writeInvoiceDocumentStepwise` و جایگزینی با گارد شکست سخت `DatabaseError(ATOMIC_RPC_REQUIRED)` (Batch 2).
3. `backend/src/__tests__/helpers/fake-supabase.ts`: شبیه‌سازی اتمیک RPC `invoice_write_document` در تست‌های حافظه‌ای (Batch 2).
4. `backend/src/services/billing.service.ts`: بازنویسی `extendSubscriptionRow` جهت شروع تمدید از زمان حال برای اشتراک‌های منقضی، تمدید از تاریخ پایان برای اشتراک‌های فعال، و تفکیک سالانه/ماهانه (Batch 5).
5. `backend/src/utils/concurrency-safety-map.ts`: ثبت و اعتبارسنجی مکانیزم‌های همروندی و شواهد متنی برای روت‌های برگشت فاکتور، بیعانه سفارش، اقساط، جریمه دیرکرد، سفارشات و کالاها (Batch 7).
6. `backend/src/routes/product.routes.ts`: اضافه کردن گارد `requireCapability('product.write')` به تمام روت‌های تغییر کالا و بارکدها (Batch 8).
7. `backend/src/routes/finance-ops.routes.ts`: فراخوانی `invalidateMoneyCaches` در استهلاک دارایی، واگذاری دارایی، تغییر ارز پایه، تغییر نرخ ارز، تسعیر ارز و لغو تطبیق بانکی (Batch 9).

### Packages (Local Engine, Sync, App Shell)

8. `packages/local-engine/src/routes/transfers.ts`: انتقال لایه‌های بهای تمام‌شده (Cost Layers) در دیتابیس محلی هنگام جابجایی فیزیکی کالا بین انبارها و اضافه کردن صف خروجی همگام‌سازی (Batch 3 & 4).
9. `packages/local-engine/src/routes/customers.ts`: اضافه کردن `buildEnqueue` برای ثبت و ویرایش مشتری در صورت وجود هدر همگام‌سازی (Batch 4).
10. `packages/local-engine/src/routes/products.ts`: اضافه کردن `buildEnqueue` برای ثبت، ویرایش و حذف نرم کالا (Batch 4).
11. `packages/local-engine/src/routes/invoices.ts`: اضافه کردن `buildEnqueue` برای عملیات لغو فاکتور در صف همگام‌سازی (Batch 4).
12. `packages/local-engine/src/routes/payments.ts`: اضافه کردن `buildEnqueue` برای ثبت و ابطال پرداخت در صف همگام‌سازی (Batch 4).
13. `packages/app-shell/src/features/sync/sync-engine.ts`: اصلاح وضعیت خطای مرجع گمشده فاکتور به حالت قابل تلاش مجدد (`permanent = false`) و اتصال روت‌های خروجی پرداخت و جابجایی انبار به `ENDPOINT_BY_ENTITY` (Batch 4).

### تست‌های رگرسیون و مستندات مایگریشن

14. `docs/invoice-return-02-purchase-return-accounting-migration.sql`: مایگریشن پایگاه داده برای ثبت صحیح بدهکار حساب‌های پرداختنی / بستانکار موجودی کالا در برگشت خرید (Batch 1).
15. `docs/VERIFY-invoice-return-02.sql`: کوئری‌های راستی‌آزمایی پس از مایگریشن برگشت خرید (Batch 1).
16. `backend/src/__tests__/purchase-return-accounting.test.ts`: تست ۴ حالته سند حسابداری برگشت خرید و فروش (Batch 1).
17. `backend/src/__tests__/payment-cancel-reversal.test.ts`: تست جلوگیری از لغو پرداخت در صورت خطای دوره بسته حسابداری (Batch 1).
18. `backend/src/__tests__/invoice-atomicity-fail-closed.test.ts`: تست عدم اجرای ذخیره چندمرحله‌ای ناقص در صورت غیاب RPC (Batch 2).
19. `docs/stock-transfer-02-cost-layers-migration.sql`: مایگریشن پایگاه داده جهت انتقال اتوماتیک لایه‌های بهای تمام‌شده در انتقال بین انبارها (Batch 3).
20. `docs/VERIFY-stock-transfer-02.sql`: کوئری راستی‌آزمایی لایه‌های بهای تمام‌شده پس از انتقال (Batch 3).
21. `packages/local-engine/src/__tests__/transfer-cost-layers.test.ts`: تست ۳ حالته انتقال لایه‌های هزینه و حفظ ترتیب FIFO در SQLite (Batch 3).
22. `packages/local-engine/src/__tests__/offline-outbox-sync-wiring.test.ts`: تست ۵ حالته ثبت در Outbox برای کالا، مشتری، لغو فاکتور، پرداخت و انتقال انبار (Batch 4).
23. `backend/src/__tests__/subscription-renewal.test.ts`: تست ۳ حالته تمدید اشتراک منقضی از حال حاضر، حفظ روزهای باقیمانده اشتراک فعال، و تمدید سالانه (Batch 5).
24. `docs/qa/FIX-PROGRESS.md`: ماتریس و وضعیت گام‌به‌گام بسته‌های برنامه ترمیم.
25. `docs/qa/FIX-VALIDATION.md`: گزارش شواهد پزشکی قانونی، علل ریشه‌ای و دروازه‌های ارزیابی.
26. `docs/qa/DATA-REMEDIATION-PLAN.md`: راهنمای SQL و پالایش داده‌های تاریخی پیشین برای مدیر سیستم.

---

## ۳. اعداد اندازه‌گیری‌شده (Numbers you measured)

| دستور اجرا شده                                                                              | خروجی واقعی                                                       |
| :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------- |
| `cd backend; npx vitest run src/__tests__/purchase-return-accounting.test.ts`               | **۴ از ۴ تست پاس شد** (4 passed) در 284ms                         |
| `cd backend; npx vitest run src/__tests__/payment-cancel-reversal.test.ts`                  | **۲ از ۲ تست پاس شد** (2 passed) در 149ms                         |
| `cd backend; npx vitest run src/__tests__/invoice-atomicity-fail-closed.test.ts`            | **۲ از ۲ تست پاس شد** (2 passed) در 185ms                         |
| `cd packages/local-engine; npx vitest run src/__tests__/transfer-cost-layers.test.ts`       | **۳ از ۳ تست پاس شد** (3 passed) در 41ms                          |
| `cd packages/local-engine; npx vitest run src/__tests__/offline-outbox-sync-wiring.test.ts` | **۵ از ۵ تست پاس شد** (5 passed) در 45ms                          |
| `cd packages/local-engine; npx vitest run`                                                  | **۲۸ فایل تستی، ۲۰۰ تست از ۲۰۰ تست پاس شد** (200 passed) در 5.19s |
| `cd backend; npx vitest run src/__tests__/subscription-renewal.test.ts`                     | **۳ از ۳ تست پاس شد** (3 passed) در 149ms                         |
| `cd backend; npx vitest run src/__tests__/concurrency-safety-map.test.ts`                   | **۲۶ از ۲۶ تست پاس شد** (26 passed) در 100ms                      |
| `cd backend; npx vitest run src/__tests__/money-cache-invalidation.test.ts`                 | **۴ از ۴ تست پاس شد** (4 passed) در 14ms                          |
| `cd backend; npx vitest run src/__tests__/reverse-guards.test.ts`                           | **۱۰ از ۱۰ تست پاس شد** (10 passed) در 7.18s                      |
| `cd packages/local-engine; npx tsc --noEmit`                                                | **خروجی کد ۰** (بدون هیچ خطای TypeScript)                         |
| `cd packages/app-shell; npx tsc --noEmit`                                                   | **خروجی کد ۰** (بدون هیچ خطای TypeScript)                         |
| `cd backend; npx tsc --noEmit`                                                              | **خروجی کد ۰** (بدون هیچ خطای TypeScript)                         |

---

## ۴. کارهایی که انجام نشد و چرایی آن (What you did not do)

1. **ثبت سند تسعیر ارز صندوق ارزی (Target A2):** همان‌طور که در تست `backend/src/__tests__/pos-till-currency-http.test.ts:427` قید شده است (`POS_FOREIGN_CURRENCY_NOT_IN_LEDGER`)، بستن صندوق ارزی به دفتر کل پایه متصل نشده است زیرا سیاست تجاری تبدیل و نرخ ارز مرجع در پایان شیفت صندوق هنوز توسط مالک تعریف نشده و تغییر آن نقض تست محافظ موجود بود.
2. **اجرای DDL روی دیتابیس لایو سوپابیس:** طبق قانون تخطی‌ناپذیر شماره ۰ و ۲، هیچ دستوری مستقیماً روی سرور زنده اجرا نشد؛ در عوض اسکریپت‌های مایگریشن و اعتبارسنجی ایجاد شدند.

---

## ۵. فرضیات (Assumptions)

- برای تمدید اشتراک‌هایی که بیش از ۱۰۰ روز اختلاف بین شروع و پایان دارند، دوره سالانه (`year`) در نظر گرفته می‌شود و برای سایرین ماهانه (`month`).
- فیلد `x-hisabche-queue === '1'` به عنوان پرچم رسمی کلاینت در زمان کارکرد آفلاین/محلی برای هدایت عملیات به جدول `sync_queue` در نظر گرفته شد.

---

## ۶. اقدامات مورد نیاز مالک مخزن (For the owner)

لطفاً فایل‌های مایگریشن زیر را به ترتیب در کنسول SQL پایگاه‌داده سوپابیس اجرا فرمایید:

1. **مایگریشن حسابداری برگشت خرید:**
   `docs/invoice-return-02-purchase-return-accounting-migration.sql`
   سپس اجرای کوئری اعتبارسنجی: `docs/VERIFY-invoice-return-02.sql`
2. **مایگریشن انتقال لایه‌های هزینه بین انبارها:**
   `docs/stock-transfer-02-cost-layers-migration.sql`
   سپس اجرای کوئری اعتبارسنجی: `docs/VERIFY-stock-transfer-02.sql`
3. **پالایش داده‌های تاریخی:**
   جهت شناسایی و اصلاح رکوردهای ثبت‌شده پیش از این ترمیم، راهنمای تدوین‌شده در `docs/qa/DATA-REMEDIATION-PLAN.md` را ملاحظه فرمایید.
4. **دیپلوی:** دیپلوی بک‌اند باید پیش از انتشار کلاینت‌های وب و دسکتاپ انجام شود.
