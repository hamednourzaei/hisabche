# Bug Registry — حسابچه

> هر باگ با فرایند ۱۹ مرحله‌ای کاربر (`memory: bug-hunt-19-steps`). منبع الگوها:
> `.claude/lessons-learned.md`. یک باگ تا «ثبت در رجیستری» تمام نمی‌شود.
> وضعیت: ✅ رفع + تست · 🟡 رفع، منتظر انتشار/اجرای انسان · 🔎 در بررسی · ❌ فرضیه رد شد

---

## BUG-001 — حذف کالای دارای فروش/سابقه‌ی انبار، و خطای خوانده‌نشده به‌عنوان «استفاده نشده»

- **وضعیت:** 🟡 کد + تست؛ منتظر انتشار. VERIFY یتیم‌ها: `docs/VERIFY-product-orphans.sql` — PENDING HUMAN CONFIRMATION
- **الگو (lessons):** ۰.۳ (`count: 'estimated'` تصمیم می‌گیرد)، ۳ (خطا = خالی)، ۱۴ ما (کد جبرانی/UI بی‌پیام)
- **کد:** `backend/src/services/product.service.ts#delete`، `routes/product.routes.ts` (DELETE)، `packages/ui/src/hooks/warehouse/use-warehouse.ts#handleDelete`، `warehouse-detail-container.tsx#handleDelete`
- **DB:** `invoice_items.product_id` و `stock_movements.product_id` در `docs/base-schema-migration.sql` فقط `uuid` هستند، **بدون FK** → دیتابیس حذف را رد نمی‌کند؛ این چک تنها گارد است.
- **RLS/مجوز:** `scopes.assertMay(product.write)` + فیلتر `workspace_id` روی خود محصول — درست.
- **مسیر اجرا:** UI delete → `DELETE /api/products/:id` → `ProductService.delete` → دو count → `products.delete()`.
- **بازتولید:** تست `product-delete-in-use.test.ts` روی کد قبلی: خواندن ناموفق (`count: null, error`) → حذف انجام شد (❌)، کالای فروخته‌شده → ۵۰۰ عمومی به‌جای تعارض (❌). ۲ از ۴ قرمز.
- **ریشه‌ی واقعی:** (۱) `count && count > 0` روی `null` false است، پس خطای کوئری = «استفاده نشده» = حذف. (۲) `count: 'estimated'` برای سؤال «آیا هست؟». (۳) «در حال استفاده» به‌صورت `DatabaseError` → ۵۰۰ «Failed to delete product». (۴) UI: کالا **قبل** از درخواست به سطل محلی می‌رفت و با رد برنمی‌گشت؛ `saveStatus` روی «در حال ذخیره» می‌ماند؛ هیچ پیامی نبود؛ صفحه‌ی جزئیات unhandled rejection.
- **رفع:** existence check (`select id limit 1 maybeSingle`) با توقف روی خطا؛ `ConflictError('PRODUCT_HAS_INVOICE_ITEMS' | 'PRODUCT_HAS_STOCK_MOVEMENTS')` → ۴۰۹ با `code`؛ UI: اول حذف سرور، بعد سطل؛ toast با پیام سه‌زبانه؛ `lib/warehouse/delete-refusal.ts`.
- **تست‌ها:** backend `product-delete-in-use.test.ts` (4) · ui `product-delete-refusal.test.ts` (6) · کل backend 2071 ✅ · ui 642 ✅ · tsc backend/ui ✅ · eslint فایل‌ها 0 error.
- **API:** route ۴۰۹ + `code` (تست سرویس؛ HTTP واقعی بعد از انتشار).
- **مرورگر:** ❌ انجام نشد — نیازمند ورود کاربر در مرورگر داخلی.

## BUG-002 — خطای دیتابیس به‌صورت «پیدا نشد» (۴۰۴) گزارش می‌شد

- **وضعیت:** 🟡 کد + تست؛ منتظر انتشار
- **الگو:** ۳ (خطا و خالی یک شاخه)
- **کد:** ۹ محل: `product.service#getById`، `invoice.service` (خواندن فاکتور + لینک عمومی)، `crm.service` (Task)، `migration.service` (۲)، `admin.service` (Membership ×۳)
- **DB:** با `.single()` نبودن ردیف خودش خطای `PGRST116` است؛ همین باعث شد `error || !data` میان‌بر عمومی شود.
- **مجوز/RLS:** بی‌تأثیر؛ همه با `workspace_id` فیلتر می‌شوند.
- **مسیر:** route → service read → `NotFoundError` → route ۴۰۴.
- **بازتولید:** `read-error-not-404.test.ts`: timeout (`57014`) روی `getById` → `NotFoundError` (❌ قبل از رفع).
- **ریشه:** هر خطا (timeout، ستون ناموجود، قطع اتصال) به «این کالا/فاکتور وجود ندارد» ترجمه می‌شد؛ کاربر فکر می‌کند رکورد حذف شده و لاگ سرور هم ۴۰۴ عادی می‌بیند نه خطا.
- **رفع:** `isFailedRead(error)` در `errors/database.error.ts` (فقط `PGRST116` = نبودن) → `DatabaseError`؛ نبودن داده → `NotFoundError`.
- **تست‌ها:** focused 3 (شامل گارد ایستای کل `services/`؛ injection: برگرداندن یک محل → قرمز) · backend 2073 ✅ · tsc ✅
- **API/مرورگر:** بعد از انتشار؛ مرورگر نیازمند ورود.

## BUG-003 — کالای منفی در صفحه‌ی خودش «کم‌موجود» بود، در فهرست «تمام‌شده»

- **وضعیت:** 🟡 کد + تست؛ منتظر انتشار
- **الگو:** «سه تعریف مختلف از کم‌موجودی» (SESSION-CACHE §6)
- **کد:** `warehouse-detail-container.tsx#stockStatus/stockLabel` با `quantity === 0`؛ فهرست (`use-warehouse.ts`) از قبل `<= 0`.
- **DB/مجوز:** بی‌ربط (نمایشی).
- **بازتولید:** کالای ۹۸− کاربر: فهرست «تمام‌شده»، صفحه‌ی کالا «کم‌موجود» (نارنجی).
- **ریشه:** دو کپی از یک قاعده که یکی اصلاح شد و دیگری نه.
- **رفع:** `packages/ui/src/lib/warehouse/stock-state.ts` (`stockStateOf`) — یک قاعده برای هر دو.
- **تست‌ها:** `stock-state-shared.test.ts` (3)؛ گارد قدیمی `exhausted-stock.test.ts` به قاعده‌ی مشترک به‌روز شد (ضعیف نشد) · ui 645 ✅ · tsc ✅

---

## ❌ C-04 — `ProductService.getStats` کم‌موجودی را با `<` می‌شمرد

- **نتیجه:** باگِ کاربر نیست — متد **هیچ caller ندارد** (نه route نه هوک). کد مرده (§14). حذف منتظر تأیید.

## BUG-004 — تاریخ‌ها یک روز عقب: `toISOString().slice(0,10)` روز UTC است نه روز محلی

- **وضعیت:** 🟡 کد + تست؛ منتظر انتشار
- **الگو:** ۱ (ابزار درست وجود دارد و صدا زده نمی‌شود: `toIsoDay` در `@hisabche/formatting` و حتی `dashboard-utils` قبلاً محلی شده بودند)؛ بدهی باز §۲.۶ SESSION-CACHE
- **کد:** ۲۶ محل: بازه‌ی داشبورد وب (`use-dashboard-data.ts`) و موبایل، تاریخ پیش‌فرض پرداخت/سند روزنامه/بودجه/تایم‌شیت/انقضا، مقدار date-picker فاکتور (وب و موبایل)، نام فایل‌های خروجی
- **بازتولید (روی همین سیستم، Asia/Tehran +3:30):** نیمه‌شب محلی 2026-09-14 → `toISOString` = 2026-09-13؛ بازه‌ی «۷ روز» از 09-06 به‌جای 09-07 شروع می‌شد ← نمودار ۸ روز را جمع می‌زد. در کابل (+4:30) هم همین. «امروز» پیش‌فرض تا ساعت ۳:۳۰/۴:۳۰ صبح دیروز بود.
- **ریشه:** `Date` محلی ساخته می‌شد و با متد UTC به رشته‌ی روز تبدیل می‌شد.
- **رفع:** `toIsoDay` در ui و mobile؛ `packages/api/src/lib/local-day.ts` (همان قاعده؛ api به formatting وابسته نیست). `shiftDay` (کاملاً UTC روی رشته‌ی روز) و fallback نمایشی موبایل عمداً ماندند.
- **تست‌ها:** `local-calendar-day.test.ts` (3، شامل گارد ایستای ui/api/mobile با allow-list) · ui 648 ✅ · api 104 ✅ · mobile 224 ✅ · tsc ui/api/mobile/web/desktop ✅
- **جانبی:** tsc موبایل رگرسیون فاز ۵ را گرفت (`useUpdateOpportunity` با `any`) — تایپ صریح شد.

## BUG-005 — «ثبت فاکتور ناموفق بود» در حالی که فاکتور ثبت شده است

- **وضعیت:** 🔎 علت دقیق باز (منتظر Response بدنه‌ی `POST /api/invoices` از کاربر) · دو نقص قطعی رفع شد (🟡 منتظر انتشار)
- **الگو:** ۳ (خطا)، idempotency (تکرار = فاکتور دوم)، `[object Object]`-مانند (پیام سرور پنهان)
- **مسیر:** preview → `createInvoice.mutateAsync` → `InvoiceService.create`: insert فاکتور زودتر commit می‌شود؛ مراحل بعد (`recordCreationPayments`، `getById`) می‌توانند throw کنند → route ۵۰۰ در حالی که فاکتور وجود دارد.
- **نقص ۱ (رفع):** پیش‌نمایش `cause instanceof Error` چک می‌کرد؛ کلاینت API شیء ساده رد می‌کند → همیشه پیام عمومی، علت واقعی دیده نمی‌شد.
- **نقص ۲ (رفع):** وب کلید idempotency نمی‌فرستاد → «تأیید» دوباره = فاکتور دوم. حالا `requestKeyRef` یکتا برای هر صفحه‌ی پیش‌نمایش (migration فاکتور PASS).
- **تست:** `invoice-create-retry-safe.test.ts` (2) · ui ✅
- **قدم بعد:** بدنه‌ی پاسخ خطا (یا حالا متن کامل پیام زیر دکمه بعد از انتشار) → ریشه‌ی سمت سرور.

---

## صف کاندیدها (هنوز بررسی نشده — فرضیه، نه باگ)

| #   | کاندید | الگو |
| --- | ------ | ---- |
