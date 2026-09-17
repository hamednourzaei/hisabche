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

## BUG-006 — ثبت فاکتور در وب با خطای CORS: `idempotency-key is not allowed`

- **وضعیت:** 🟡 کد + تست + HTTP محلی ✅؛ منتظر انتشار backend
- **الگو:** «رفعِ یک باگ، باگ بعدی را ساخت» — رفع BUG-005 (نقص ۲) هدر `Idempotency-Key` را به `POST /api/invoices` اضافه کرد، ولی `allowedHeaders` در CORS بک‌اند به‌روز نشد.
- **کد:** `backend/src/index.ts` (`@fastify/cors` → `allowedHeaders`)؛ فرستنده: `packages/api/src/hooks/invoices.ts`؛ خواننده: `backend/src/utils/client-request.ts`.
- **علامت:** preflight رد می‌شد → درخواست اصلاً از مرورگر خارج نمی‌شد (`net::ERR_FAILED`)؛ از دید کاربر «تازه لاگین کردم ولی ثبت نمی‌شود».
- **رفع:** افزودن `Idempotency-Key` به `allowedHeaders`.
- **گارد:** `backend/src/__tests__/cors-allowed-headers.test.ts` — هر هدر غیر-safelisted که `packages/api` می‌فرستد باید در allow-list باشد (injection-tested: حذف هدر → قرمز).
- **HTTP واقعی (محلی):** `OPTIONS /api/invoices` با `Access-Control-Request-Headers: authorization,content-type,idempotency-key` → `204` و `access-control-allow-headers: …, Idempotency-Key`.
- **قاعده:** هر هدر جدید در کلاینت API = همان commit در CORS بک‌اند.

## BUG-007 — تعداد بیشتر از موجودی در `/invoices/new` هیچ هشداری نمی‌داد

- **وضعیت:** 🟡 کد + تست؛ منتظر انتشار
- **الگو:** ۵ (نبودِ نشانه) + `.limit(N)` روی خواندنی که تصمیم می‌سازد
- **کد:** `packages/ui/src/components/ui/invoice-builder/use-oversold-lines.ts` (جدید)، `oversold-warning.tsx` (جدید)، `containers/invoice-builder-container.tsx`، `invoice-builder-page.tsx`، `mobile/invoice-builder-mobile.tsx`، `containers/invoice-preview-container.tsx`؛ `packages/api/src/hooks/products.ts#useProductsByIds`.
- **ریشه:** (۱) هشدار فقط در مرحله‌ی پیش‌نمایش بود، نه هنگام تایپ تعداد. (۲) موجودی از `useProducts({ limit: 100 })` خوانده می‌شد → کالاهای بعد از صدم هرگز بررسی نمی‌شدند.
- **رفع:** یک hook مشترک برای فرم و پیش‌نمایش؛ موجودی از query جزئیات هر محصول لینک‌شده (cache مشترک با `useProduct`). **هشدار، نه مسدودسازی** — ثبت همچنان ممکن است (خواسته‌ی کاربر). فروش واحدِ متفاوت (گرم در برابر کیلو) قضاوت نمی‌شود؛ خطوط یک کالا جمع می‌شوند؛ خرید هشدار نمی‌دهد.
- **تست:** `invoice-oversold-warning.test.ts` (6) · `exhausted-stock.test.ts` به‌روز شد · ui 743 ✅ · tsc ui/api ✅
- **مرورگر:** ❌ انجام نشد — نیازمند ورود کاربر.

## BUG-008 — بعد از پرداخت کامل، صفحه‌ی فاکتور هنوز «باقی‌مانده ۳٬۰۰۰٬۰۰۰» نشان می‌داد

- **وضعیت:** 🟡 کد + تست؛ منتظر انتشار backend
- **الگو:** «کلید کش حدسی» — invalidation با شکل کلیدی که هیچ‌کس نمی‌نویسد، بی‌صدا هیچ کاری نمی‌کند.
- **علامت:** فهرست فاکتورها «پرداخت شده» (درست)، صفحه‌ی جزئیات باقی‌مانده = کل مبلغ و «۰ ≠ ۳٬۰۰۰٬۰۰۰»؛ با هارد رفرش درست شد (کاربر تأیید کرد). دیتابیس درست بود (trigger `invoices_project_settlement`).
- **ریشه:** `GET /api/invoices/:id` با `cacheMiddleware` به کلید `invoice:<workspace>:<url>` برای ۱۲۰ ثانیه کش می‌شد. `PaymentsService.invalidate` فقط `memoryCache` با پیشوندهای `payments/invoices/accounting` را پاک می‌کرد → لیست (`invoices:`) تازه شد، جزئیات (`invoice:` مفرد) نه. در routeهای فاکتور هم `clearCache(invoice:<ws>:<id>)`، `dashboard:v2:<ws>` و `insights:<ws>` با هیچ کلید واقعی جور نبودند؛ در customer.routes هم `customer:<id>`.
- **رفع:** `backend/src/utils/money-cache.ts#invalidateMoneyCaches` — یک فهرست از پیشوندهای کش که عدد پولی/موجودی دارند، با شکل درست `<prefix>:<workspace>:*`، روی هر دو کش. استفاده در payments.service، invoice.routes (۵ جا)، customer.routes (۲ جا).
- **گارد:** `backend/src/__tests__/money-cache-invalidation.test.ts` — کلید واقعی میدل‌ور را می‌نویسد و پاک شدنش را ثابت می‌کند؛ workspace دیگر دست نمی‌خورد؛ هر `keyPrefix` در routeهای پولی باید در فهرست باشد (injection-tested؛ `warehouses` را همان لحظه پیدا کرد).
- **تست:** backend 2082 ✅ · tsc ✅
- **HTTP واقعی:** ❌ نیازمند ورود کاربر؛ بعد از انتشار: پرداخت → صفحه‌ی فاکتور بدون رفرش.
- **باز:** `activities:${workspaceId}:*` در invoice.routes هم با کلید user-scoped (`activities:<userId>:…`) جور نیست — پولی نیست، ثبت شد.

## BUG-009 — صفحه‌ی مشتری: فقط ۵۰ مشتری و ۲۰۰ فاکتور اول، جمع در مرورگر، ارز ثابت «AFN»

- **وضعیت:** 🟡 کد + تست؛ منتظر انتشار (Customer 360 فاز ۱)
- **الگو:** ۴ (عدد بی‌صدا غلط با `limit`) + جمع مالی در frontend
- **ریشه:** `customer-detail-container.tsx` مشتری را در `useCustomers({limit: 50})` پیدا می‌کرد (مشتری ۵۱ام «پیدا نشد»)، فاکتورها را از `useInvoices({limit: 200})` کل workspace جمع می‌زد، دنبال وضعیت ناموجود `partial` بود و همه‌ی مبالغ را «AFN» می‌نوشت (فاکتور کاربر IRR بود). `partyMovements` (صورت‌حساب) با `.limit(1000)` و بدون حذف فاکتورهای باطل.
- **رفع:** `payments.domain#summarizeParty` + `GET /api/payments/summary/:partyType/:partyId` (بدون کش)؛ `partyMovements` صفحه‌بندی کامل + `neq('status','cancelled')` + مانده‌ی اول دوره؛ ledger با `sourceType/sourceId/currency`؛ hookهای `usePartySummary`/`usePartyLedger`؛ container/view جدید.
- **نقص جانبی رفع‌شده:** نوع `OpenInvoice` در `packages/api` (`id`/`date`) با پاسخ واقعی سرور (`invoiceId`/`invoiceDate`) نمی‌خواند — مصرف‌کننده‌ای نداشت.
- **تست:** backend `party-summary.test.ts` (10) · ui `customer-360.test.ts` (7) · backend 2091 ✅ · ui 743 ✅ · tsc api/ui/web/desktop ✅ · build وب ✅ · route محلی 401 بدون توکن ✅
- **مرورگر:** ❌ نیازمند ورود کاربر.

## BUG-010 — CRM بدون هسته: کش اشتباه، شکل داده‌ی ناهمگون، سقف‌های بی‌صدا

- **الگو:** ۱ + ۴ + معماری موازی (خواندن مستقیم جدول در forecast)
- **ریشه‌ها (همه در `crm.service.ts` قدیمی / `crm.routes.ts`):** invalidate کش با `user_id` به‌جای workspace؛ `clearCache('interactions:*')` سراسری (کش همه‌ی workspaceها)؛ opportunities به‌صورت snake_case برمی‌گشت؛ تغییر وضعیت از لینک عمومی کش صاحب کار را پاک نمی‌کرد؛ `customerSnapshot` خطا را نادیده می‌گرفت؛ `.limit(2000/10000)` روی خواندن‌ها؛ `count: 'estimated'`؛ متدهای مرده؛ `forecast.service.ts` جدول‌ها را مستقیم می‌خواند و فرصت‌های won/lost را «راکد» نشان می‌داد.
- **رفع:** CRM Core در `backend/src/services/crm/{domain,repository,service,port,index}.ts` — فقط repository نام جدول را می‌داند؛ `CrmPort` (`listOpenOpportunityActivity`، `getCustomerCrm`) برای مصرف بین‌هسته‌ای؛ forecast از port؛ route جدید `GET /api/crm/customers/:customerId`؛ UI مشترک `CustomerCrmPanel` روی `useCustomerCrm`.
- **تست:** `crm-core.test.ts` (نگاشت، قواعد، خلاصه، گارد «فقط هسته جدول می‌خواند»، شمارش دقیق) · backend 2105 ✅ · ui 754 ✅ · tsc api/ui/web/desktop/mobile ✅
- **مرورگر:** ❌ نیازمند ورود کاربر.

## BUG-011 — گزارش بدهی مشتریان فاکتور باطل‌شده و خرید را بدهی حساب می‌کرد (کاندید C-cancelled-debt)

- **الگو:** ۴ (عدد بی‌صدا غلط) + دو صفحه، دو قاعده
- **ریشه:** `operational-reports.ts#getCustomerDebtReport` و تابع SQL `accounting_customer_debt` با `status <> 'paid'` می‌خواندند → `cancelled` هم بدهی بود؛ فاکتور `purchase` با customer_id هم بدهی مشتری حساب می‌شد؛ مسیر JS بدون صفحه‌بندی (سقف ۱۰۰۰). Customer 360 (`summarizeParty`) هر دو را حذف می‌کند، پس دو صفحه برای یک مشتری عدد متفاوت می‌دادند.
- **رفع:** مسیر JS: `.not('status','in','("paid","cancelled")')` + `.or('type.is.null,type.neq.purchase')` + `fetchAllPages`. SQL: `docs/customer-debt-cancelled-fix-migration.sql` (CREATE OR REPLACE، grant‌ها بدون تغییر، verify داخل فایل) — PENDING HUMAN CONFIRMATION. fake-supabase: `.not(in)` و `.or()` با معنای PostgREST (NULL match نیست).
- **تست:** `customer-debt-report.test.ts` (injection-tested) · `perf-aggregates.test.ts` سبز.

## BUG-012 — پاک‌کردن کش فید فعالیت هیچ‌وقت چیزی پاک نمی‌کرد

- **الگو:** ۱ (قانون هست، اثر ندارد) — همان خانواده‌ی BUG-008
- **ریشه:** کش `activities`/`activities-unread` با scope `user` است (`<prefix>:<userId>:<url>`). `invoice.routes` با `workspaceId` پاک می‌کرد، و `activities-unread:${userId}` بدون `:*` بود → هیچ کلیدی match نمی‌شد.
- **رفع:** همه‌ی clearها `activities(-unread):<userId>:*`؛ در invoice routes کاربر عامل (`request.tenancy.userId`). فید بقیه‌ی اعضای workspace با TTL ۱۵–۳۰ ثانیه تازه می‌شود.
- **تست:** `activity-cache-keys.test.ts` (injection-tested).

## BUG-013 — مسیرهای ناموجودِ نقطه‌دار کل لندینگ را با ۲۰۰ و canonical به /fa سرو می‌کردند

- **منبع:** گزارش Coverage سرچ کنسول (۱۷ سپتامبر): «Alternate page with proper canonical» ۲، «Crawled – currently not indexed» ۳.
- **الگو:** ۵ (نبود نشانه) — `resolveLocale` بی‌صدا به `fa` برمی‌گشت
- **ریشه:** matcher در `apps/web/proxy.ts` هر مسیر دارای پسوند را رد می‌کند؛ `/wp-login.php` و `/sitemap-0.xml` مستقیم به `[lang]` رسیدند با `lang = "wp-login.php"`؛ layout به `fa` fallback کرد → صفحه‌ی کامل ۷۴۳KB، `index, follow`، canonical به `/fa`. روی دامنه‌ی زنده با curl تأیید شد.
- **رفع:** در `RootLayout` قبل از هر رندر: `if (!isLocale(lang)) notFound()`.
- **اثبات:** بیلد production محلی (`NEXT_STANDALONE=0`) + `next start`: `/wp-login.php` و `/sitemap-0.xml` → 404 + noindex؛ `/fa` `/en` `/af` about/docs/features → 200 index؛ `/fa` هنوز `x-nextjs-prerender: 1` و `x-nextjs-cache: HIT` (پرفورمنس دست نخورد).
- **تست:** `packages/ui/src/__tests__/unknown-locale-404.test.ts` (injection-tested).
- **بقیه‌ی گزارش (کد نیست):** ۹۰ URL سایت‌مپ همه ۲۰۰ + index + canonical خودی. redirect ۴ = http/www/`/`/اسلش انتهایی (درست). noindex ۲ = login/signup (عمدی). ۴۰۴ ۱ = URL قدیمی/خارجی (فهرست URL در zip نبود). «Discovered – not indexed» ۷۵ = زمان‌بندی خزش گوگل برای دامنه‌ی جدید. محتوای کم: docs/branches ۱۳۰، data-and-backup ۱۲۵، pos ۱۴۶ کلمه — نیازمند محتوای واقعی.

## صف کاندیدها (هنوز بررسی نشده — فرضیه، نه باگ)

| #   | کاندید | الگو |
| --- | ------ | ---- |
