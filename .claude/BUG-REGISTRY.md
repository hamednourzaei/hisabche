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

## BUG-014 — سیل ۴۰۱ در هر بارگذاری: «getter ثبت شد» با «session آماده است» یکی گرفته شده بود

- **الگو:** ۱ (قانونی هست و درست صدا زده نمی‌شود) + ترتیب راه‌اندازی
- **نشانه:** کنسول کاربر پر از `401` روی `/notifications`، `/notifications/unread-count`، `/billing/subscription`، `/accounting/accounts`، `/accounting/journal` و دو بار `/invoices` — با اینکه صفحه درست کار می‌کرد و کاربر تازه وارد شده بود.
- **ریشه:** `registerTokenGetter()` در `packages/api/src/lib/tokenProvider.ts` علاوه بر ثبت getter، خودِ `tokenReady` را هم resolve می‌کرد. `packages/store/src/slices/auth.slice.ts` آن را در سطح ماژول (هنگام import) صدا می‌زند — یعنی **قبل از** hydrate شدن zustand-persist. پس `waitForTokenReady()` در interceptor فوراً رد می‌شد و اولین درخواست‌ها بدون هدر `Authorization` بیرون می‌رفتند؛ ۴۰۱ می‌گرفتند و فقط به لطف `refreshOnce()` + یک retry موفق می‌شدند. خطا دیده می‌شد، ولی چون نتیجه درست بود هیچ‌وقت به‌عنوان باگ گزارش نشد.
- **رفع:** `markTokenReady()` جدا شد. وب بعد از `onRehydrateStorage` (که zustand برای storage خالی هم صدا می‌زند، پس کاربر خارج‌شده منتظر timeout نمی‌ماند)، دسکتاپ و موبایل در `finally` ی `hydrate()`، ادمین بعد از اولین `getSession()`. `registerTokenGetter` دیگر هیچ چیزی را resolve نمی‌کند.
- **تست:** `packages/api/src/__tests__/token-ready-waits-for-hydration.test.ts` (۸ تست: ثبت getter آزاد نمی‌کند، `markTokenReady` می‌کند، idempotent، کاربر خارج‌شده هم آزاد می‌شود، و هر چهار رندرر `markTokenReady` را صدا می‌زنند) — **injection-tested**: با برگرداندن باگ، تست اول قرمز شد.
- **مرورگر:** ❌ نیازمند ورود کاربر.

## BUG-015 — «ثبت پرداخت» حقوق هیچ‌وقت پرداخت نمی‌شد

- **الگو:** سرویسی که ورودی صریح کلاینت را بی‌صدا دور می‌ریزد
- **نشانه:** گزارش کاربر: «حقوق کار نمی‌کنه».
- **ریشه:** `HumanResourcesService.createPayroll` همیشه `status: 'draft'` می‌نوشت و `payment_date` را اصلاً در INSERT نمی‌آورد — در حالی که صفحه‌ی کارمند `status: 'paid'` و تاریخِ انتخاب‌شده را می‌فرستد. نتیجه: هیچ پرداختی «پرداخت‌شده» نمی‌شد و ردیف، به‌جای تاریخ پرداخت، **تاریخ شروع دوره** را نشان می‌داد.
- **رفع:** `status: data.status` و `payment_date: data.paymentDate ?? null`. پیش‌فرض `'draft'` در schema باقی است، پس فراخوانی‌ای که چیزی نگوید همچنان draft می‌سازد. گزارش سود/زیان تحت تأثیر نیست (فقط `cancelled`/`rejected` را کنار می‌گذارد).
- **مرورگر:** ❌ نیازمند ورود کاربر.

## BUG-016 — «مدیر شعبه: undefined undefined» و نام خالی کارمندها

- **الگو:** ۲ (تایپ، چکِ زمان اجرا نیست)
- **ریشه:** `GET /api/employees` ردیف خام دیتابیس را می‌فرستد (`first_name`، `last_name`، `hire_date`)، ولی `team-and-payroll-view.tsx` آن را camelCase تایپ کرده بود. tsc ساکت بود چون هوک `any` برمی‌گرداند. پس کارت‌ها نام خالی داشتند و گزینه‌های «مدیر شعبه» همه «undefined undefined» بودند.
- **رفع:** تایپ به snake_case اصلاح شد (`EmployeeRow`)، نام‌سازی در یک تابع مشترک `employeeName()` و گزینه‌ی بی‌نام از dropdown حذف می‌شود. کارت‌ها جای خود را به `EmployeeListTable` (همان DataTable انبار) دادند.
- **نکته‌ی باقی‌مانده:** `branches.manager_employee_id` کلید خارجی به `employees` دارد، پس **مالک** فقط وقتی قابل انتخاب است که به‌عنوان کارمند ثبت شده باشد.
- **مرورگر:** ❌ نیازمند ورود کاربر.

## BUG-017 — تب «حقوق» همیشه خالی و «جمع حقوق پرداختی» همیشه صفر

- **الگو:** ۱ (کوئری‌ای که هیچ‌وقت فعال نمی‌شود) + ۲ (تایپ ≠ شکل واقعی پاسخ) + ۴ (عدد بی‌صدا غلط)
- **نشانه:** کاربر برای دو کارمند حقوق ثبت کرده بود؛ `/fa/team-and-payroll?tab=payroll` می‌گفت «هیچ سابقه حقوقی وجود ندارد» و کارت جمع، `۰ AFN`.
- **ریشه‌ها (سه تای مستقل، هرکدام به‌تنهایی کافی):**
  1. `usePayrolls()` در `packages/api/src/hooks/payroll.ts`: `enabled: authReady && !!employeeId` — فراخوانی سطح workspace (بدون employeeId) هرگز اجرا نمی‌شد. **کوئری غیرفعال و جدول خالی روی صفحه یکسان‌اند**، پس هیچ خطایی دیده نمی‌شد.
  2. کانتینر `payrollData?.payrolls` و `payrollData?.total` می‌خواند؛ route یک آرایه می‌فرستد و جمع در endpoint جداگانه‌ی `/payrolls/summary` است.
  3. `PayrollCard` فیلدهای `employeeName` / `period` / `amount` / `dueDate` را می‌خواند که هیچ‌کدام در ردیف واقعی (`net_salary`، `period_start`، `employee:{first_name,last_name}`) وجود ندارند.
- **رفع:** هوک فعال شد (employeeId فقط فیلتر است)، `asList<PayrollRow>()` + `usePayrollSummary()`، و `PayrollListTable` با ستون‌های واقعی جای کارت را گرفت (کارت حذف شد، §14). ضمناً `getPayrollSummary` صفحه‌بندی شد — `.select()` بدون `range` روی سقف ۱۰۰۰ ردیفی PostgREST بی‌صدا جمعِ کمتر می‌داد — و پرداخت لغوشده دیگر در جمع نمی‌آید (هم‌راستا با گزارش سود و زیان).
- **تست:** `packages/ui/src/components/ui/team-and-payroll/__tests__/payroll-tab-wiring.test.ts` (۷ تست) — **injection-tested**.
- **مرورگر:** ❌ نیازمند ورود کاربر.

## BUG-018 — `GET /api/referrals` روی سایت زنده ۵۰۰ می‌داد، با ۲۲۰۲ تست سبز

- **الگو:** چرخه‌ی ماژول (TDZ / نیمه‌مقداردهی) — راهنمای سشن §۸
- **ریشه:** `billing.service` → `services/referral/index` → `referral.service` → `billing.service`.
  کمیسیون باید در **یک نقطه** ثبت شود، پس `billing.service` هسته‌ی رفرال را import می‌کند؛ و هسته برای
  قیمت پلن `PLAN_PRICING` را از `billing.service` می‌خواست. Node چرخه را با تحویلِ ماژولِ **نیمه‌مقداردهی‌شده**
  حل می‌کند، بنابراین `referralService` هنگام اجرای بدنه‌ی `billing.service` برابر `undefined` بود.
- ⚠️ **چرا تست‌ها نگرفتند:** تست‌ها برگ‌ها را مستقیم import می‌کنند (`referral.domain`, `plan-pricing`) و
  هیچ‌وقت حلقه را نمی‌بندند. سوئیت سبز، هیچ چیزی درباره‌ی ترتیب مقداردهی ماژول‌ها ثابت نمی‌کند.
- **رفع:** ثابت‌های مشترک به `backend/src/services/plan-pricing.ts` منتقل شدند — ماژولی که **هیچ چیزی import نمی‌کند**
  و بنابراین نمی‌تواند جزو هیچ چرخه‌ای باشد. `billing.service` همان‌ها را دوباره export می‌کند تا واردکننده‌های قبلی نشکنند.
- **تست:** `no-service-import-cycles.test.ts` — گرافِ import کل `backend/src/services` را می‌پیماید.
  `import type` نادیده گرفته می‌شود (کامپایلر پاکش می‌کند؛ `analytics.service` و aggregates عمداً تایپ همدیگر را می‌خوانند).
  **injection-tested.**
- **مرورگر:** ❌ نیازمند deploy.

## BUG-019 — سیل ۴۰۱ برگشت: «آماده» یک خط زودتر از «getter ثبت شد» اعلام می‌شد

- **الگو:** ترتیب راه‌اندازی — دنباله‌ی مستقیم BUG-014
- **ریشه:** رفع BUG-014 اعلام آمادگی را به `onRehydrateStorage` برد. ولی zustand-persist با استوریج **همگام**
  (اینجا `encryptedStorage` روی localStorage) آن callback را **حین `create()`** اجرا می‌کند — یعنی پیش از
  خط بعدیِ بدنه‌ی ماژول که `registerTokenGetter` را صدا می‌زند. پس `tokenReady` وقتی resolve می‌شد که
  `tokenGetter` هنوز `null` بود؛ `getToken()` هیچ برمی‌گرداند و اولین درخواست‌ها باز هم بدون هدر
  `Authorization` می‌رفتند. همان باگ، یک خط زودتر.
- **رفع:** `markTokenReady()` اگر getter نباشد سیگنال را **نگه می‌دارد** (`readyPending`) و
  `registerTokenGetter` آزادش می‌کند. حالا promise فقط وقتی resolve می‌شود که **هر دو** اتفاق افتاده باشند،
  و ترتیبِ خارج از کنترلِ store بی‌اهمیت می‌شود.
- **درس:** «سیگنال آمادگی بدون منبع داده، بدتر از نبودِ سیگنال است» — مصرف‌کننده را آزاد می‌کند تا با دستِ خالی برود.
- **تست:** `token-ready-waits-for-hydration.test.ts` (۱۰ تست) — **injection-tested**.
- **مرورگر:** ❌ نیازمند deploy.

## BUG-020 — پنجره‌ی dev سفید بود و ترمینال می‌گفت سرور بالاست

- **الگو:** §۷٫۵ «نبودِ یک نشانه، نشانه نیست» — به‌علاوه‌ی «نام، آدرس نیست»
- **نشانه:** `electron-vite dev` می‌نوشت `dev server running … http://localhost:5173/`، پنجره باز می‌شد و
  کاملاً خالی می‌ماند. کنسول فقط هشدار CSP خودِ Electron را داشت — که متنش می‌گوید بعد از بسته‌بندی دیده نمی‌شود.
  هیچ خطایی، هیچ‌جا.
- **ریشه:** `localhost` روی ویندوز **دو آدرس** است. Vite روی `127.0.0.1` گوش می‌داد و Chromium نام را اول به
  `::1` resolve می‌کرد → `ERR_CONNECTION_REFUSED`. لود هرگز اتفاق نمی‌افتاد، پس صفحه‌ای هم نبود که خطا بدهد.
- **چرا دیده نمی‌شد:** هیچ‌کس به `did-fail-load` گوش نمی‌داد. شکستِ لودِ رندرر **هیچ خروجی‌ای ندارد** مگر
  کسی listener بگذارد؛ پنجره‌ی سفید تنها علامت بود و علامتِ سه شکستِ کاملاً متفاوت است.
- **رفع:** (۱) `server: { host: '127.0.0.1' }` در `packages/app-shell/vite.shell.mjs` — نام حذف می‌شود، پس
  چیزی برای دو جور resolve شدن نمی‌ماند. (۲) چهار listener در `apps/desktop/electron/main/window.ts`
  (`did-fail-load` / `preload-error` / `render-process-gone` / `console-message`) که همه به `reportError` می‌روند.
  همین‌ها بودند که علت واقعی را نشان دادند.
- **درس:** رندرری که بی‌صدا شکست می‌خورد، یک پنجره‌ی سفید بدون توضیح است. listener را **قبل از** `loadURL` بگذار.
- **تست:** `dev-server-binds-a-literal-address.test.ts` (۴ تست) — **injection-tested**.
- **مرورگر:** — فقط دسکتاپ.

## BUG-021 — نرم‌افزار با یک design system کامل بالا می‌آمد و هیچ کلاس Tailwind نداشت

- **الگو:** «پیکربندی جست‌وجو می‌شود، پس می‌تواند پیدا نشود»
- **نشانه:** لوگو با اندازه‌ی طبیعی وسط صفحه، ناوبری متنِ ساده در گوشه. فایل CSS **بود** (۲۲۰ کیلوبایت)،
  لود هم **می‌شد**، توکن‌ها و فونت‌ها همه داخلش بودند. فقط `flex`، `grid`، `rounded-lg`، `ms-2` — یعنی
  هر کلاسی که کامپوننت‌ها واقعاً با آن نوشته شده‌اند — تولید نشده بود.
- **ریشه:** Vite دنبال `postcss.config.*` از `root` به بالا می‌گردد و root مشترک
  `packages/app-shell/src` است. کانفیگ در `apps/desktop/` بود — مسیری که اصلاً سر راه نیست.
  جست‌وجو چیزی پیدا نکرد، `@tailwind base/components/utilities` دست‌نخورده به مرورگر رسید
  (سه at-rule ناشناخته، بدون خطا)، و موبایل اصلاً هیچ‌وقت کانفیگی نداشت.
- **رفع:** `tailwind.config.ts` به `packages/app-shell` منتقل شد (glob ها **مطلق**، چون دو host از دو
  working directory مختلف بیلد می‌گیرند) و `css.postcss.plugins` در `vite.shell.mjs` **صریحاً** نام برده شد.
  کپی‌های `apps/desktop` حذف شدند (§۱۴).
- **درس:** چکِ «`@tailwind` باقی نمانده» کافی نیست — directive پردازش‌نشده و directiveی که چیزی تولید نکرده
  هر دو فایل را بدون آن رها می‌کنند. باید وجود خودِ utility ها را تست کرد.
- **تست:** `built-css-contains-utilities.test.ts` (۸ تست) — **injection-tested** (حذف بلوک + بیلد مجدد → ۵ قرمز).
- **مرورگر:** — دسکتاپ و موبایل.

## BUG-022 — داشبورد برای کسی باز می‌شد که session اش تمام شده بود

- **الگو:** §۷٫۲ «type/shape یک چک زمان‌اجرا نیست» — ادامه‌ی مستقیم باگِ گیتِ auth
- **ریشه:** `isSession()` فقط **شکل** را چک می‌کند: token رشته، `user.id` و `user.email` موجود.
  توکنی که ماه پیش صادر شده هر سه را دارد، پس دقیقاً مثل توکن تازه قبول می‌شد. `hydrate()` هیچ‌وقت
  `exp` را نمی‌خواند، پس برنامه مستقیم روی داشبورد باز می‌شد و صفحه‌ی لاگین هرگز نمی‌آمد.
- **چرا خطرناک‌تر از ۴۰۱ ساده است:** آنلاین همه‌ی درخواست‌ها ۴۰۱ می‌گیرند پشتِ UIای که خودش را
  لاگین‌شده می‌داند؛ **آفلاین هیچ ۴۰۱ای نمی‌آید که اشتباه را تصحیح کند** و برنامه همان‌طور می‌ماند.
- **رفع:** `sessionExpiresAt()` و `isSessionExpired()` در `packages/auth-core/src/session.ts` (پس هر سه host
  یک قاعده دارند). `hydrate()` حالا `hasShape && !hasExpired` را گیت می‌کند.
  ⚠️ توکنِ **بدون** `exp` منقضی حساب **نمی‌شود** — تاریخی که نوشته نشده را نمی‌شود خواند و حدس‌زدنش یعنی
  بیرون‌انداختن آدمی از session سالم (§12). انقضا هم **خطا نیست**: `INVALID_SESSION_DATA` فقط برای blob بدشکل.
- **تست:** `auth-gate.test.ts` — ۹ تست جدید (مجموع ۳۲) — **injection-tested** (بازگرداندن `return false` → ۲ قرمز).
- **مرورگر:** — فعلاً دسکتاپ/موبایل؛ وب مسیر auth جدا دارد.

## BUG-023 — بیلد محلی اندروید روی سه چیزِ «پیدانشده» می‌افتاد و هیچ‌کدام اسم خودش را نمی‌گفت

- **الگو:** «پیکربندی جست‌وجو می‌شود، پس می‌تواند پیدا نشود» (همان BUG-021، این‌بار در toolchain)
- **سه شکست، سه پیامِ بی‌ربط:**
  | چیزِ گمشده                 | چیزی که Gradle می‌گفت                           |
  | -------------------------- | ----------------------------------------------- |
  | JDK 17                     | `Unsupported class file major version 69`       |
  | `android/local.properties` | `SDK location not found`                        |
  | بیلدِ shell                | APK نصب می‌شد و `SHELL_MISSING_FROM_APK` می‌داد |
- **وضعیت واقعی این لپ‌تاپ:** `JAVA_HOME` به JDK **۲۵** اشاره می‌کرد و `java` روی PATH به shim **۱.۸** —
  یعنی **هر دو** جای بدیهی جوابِ غیرقابل‌استفاده داشتند.
- **رفع:** `scripts/gradle.mjs` حالا خودش JDK 17/21 را در ریشه‌های نصب واقعی پیدا می‌کند،
  SDK را از `ANDROID_HOME` یا مسیر استاندارد Android Studio برمی‌دارد، `local.properties` را **می‌نویسد**
  (بک‌اسلش‌ها escape شده — در فایل `.properties` بک‌اسلش کاراکتر escape است و مسیر بی‌صدا عوض می‌شود)،
  و `JAVA_HOME`/`ANDROID_HOME` را **صریحاً** به Gradle پاس می‌دهد تا به شلِ جاری وابسته نباشد.
- ⚠️ **باگِ خودِ رفع:** اولین نسخه `spawnSync(join(home,'bin','java'), …, {shell:true})` بود.
  `C:\Program Files\...` بدون کوتیشن یعنی دستورِ `C:\Program` — پس **همه‌ی** probe ها شکست خوردند و اسکریپت
  با اطمینان اعلام کرد «هیچ JDKای نیست» روی ماشینی که سه تا داشت. جوابِ غلطِ بااطمینان از خطایی که
  جایش را گرفته بدتر است.
- **نصب‌شده:** Temurin JDK 17.0.20 (`winget`). Android SDK از قبل بود؛ `eas-cli@24.7.0` به devDependency
  موبایل اضافه شد تا هر بار دوباره دانلود نشود.
- ⚠️ **`allowBuilds` خالی خنثی نیست:** pnpm برای `protobufjs` جای‌نگهدار می‌نویسد و تا تصمیم‌گیری
  **روی هر install با کد ۱ خارج می‌شود** — و `android:debug` اول install می‌زند، پس بیلد محلی
  قبل از رسیدن به Gradle با یک stack trace از pnpm می‌مرد که اسم Android در آن نبود.
- **تست:** `scripts/__tests__/gradle-script.test.ts` (۱۱ تست، source-assertion با حذف کامنت‌ها).
- **مرورگر:** — فقط toolchain.

## BUG-024 — بیلد محلی اندروید: دو مانع که هیچ‌کدام اسم خودش را نمی‌گفت

### الف) `ninja: error: manifest 'build.ninja' still dirty after 100 tries`

- **الگو:** «پیام خطا درباره‌ی چیز دیگری حرف می‌زند»
- **چطور پیدا شد:** `ninja -d explain` — نه حدس. اولین خطش همه‌چیز را گفت:
  `output ../prefab/…/fbjniConfigVersion.cmake of phony edge with no inputs doesn't exist`
- **ریشه:** فایل **وجود داشت**. ninja آن را به‌صورت `../prefab/…` نسبت به build dir ی به عمق ۱۷۴ کاراکتر
  stat می‌کند و ویندوز MAX_PATH را روی رشته‌ی **جمع‌نشده** اعمال می‌کند — قبل از حذف `..`:

  |                           |                                 |
  | ------------------------- | ------------------------------- |
  | ۱۷۴ (cwd) + ۱ + ۸۹ (نسبی) | **۲۶۴** ← چیزی که ninja می‌سنجد |
  | مسیر جمع‌شده              | ۲۵۱                             |
  | سقف قابل‌استفاده          | ۲۵۹                             |

- ⚠️ **چرا هیچ بررسی‌ای نشانش نداد:** همین شکاف. هر ابزاری که اول path را resolve کند ۲۵۱ می‌بیند و
  می‌گوید فایل سر جایش است. من و کاربر هر دو دقیقاً همین را دیدیم و دو بار فرضیه را رد کردیم.
- ⚠️ **`LongPathsEnabled=1` کمک نمی‌کند** — فقط برای exe هایی که در manifest خودشان opt-in کرده باشند،
  و ninja ی Android CMake 3.22.1 نکرده. رجیستری را چک کردم: از قبل ۱ بود.
- **رفع اول (برگردانده شد):** `virtualStoreDir: 'C:\pn'` — ninja را درست کرد ولی بخش «ج» را ببین.
- **رفع نهایی:** `virtualStoreDir: '.p'` + `virtualStoreDirMaxLength: 40` → عمیق‌ترین build dir از ۱۷۴ به
  **۱۵۲** (اندازه‌گیری‌شده بعد از `android:debug` کامل)، ninja می‌سنجد ۱۵۲+۱+۸۹ = **۲۴۲** — ۱۷ زیر سقف.
  ⚠️ این حاشیه به مسیر همین کلون بسته است؛ کلون در مسیری ~۱۷ کاراکتر بلندتر دوباره همین خطا را می‌دهد.
- ⚠️ **دو فرضیه‌ی غلط قبل از این:** (۱) symlink های pnpm — اسکریپتی برای dereference نوشتم که هیچ اثری
  نداشت چون Gradle از همان مسیر واقعی store بیلد می‌گیرد؛ **کد حذف شد** (§۱۴). (۲) `buildStagingDirectory`
  — AGP اجازه نمی‌دهد از ریشه‌ی پروژه تنظیم شود («It is too late to set»)، برگردانده شد.
- ⚠️ **عارضه‌ی جانبی جابه‌جایی store:** symlink های hoist‌شده در `node_modules` ریشه بازسازی نشدند و به
  مسیر حذف‌شده اشاره می‌کردند → `Included build '…\android\null' does not exist`. pnpm سه بار
  «Already up to date» گفت؛ لازم شد `.modules.yaml` و `.pnpm-workspace-state-v1.json` و همه‌ی
  `node_modules` حذف شوند.

### ب) `Unresolved reference: expo` در MainActivity/MainApplication

- **ریشه:** `useExpoModules()` در `settings.gradle` هر هجده ماژول را **include** می‌کند —
  `gradlew projects` همه را نشان می‌دهد و لاگ configure اسمشان را چاپ می‌کند، پس همه‌چیز وصل به‌نظر می‌رسد.
  ولی **include با dependency یکی نیست**: پروژه‌ی `:expo` است که `addExpoModulesDependencies` را صدا می‌زند
  و بقیه را re-export می‌کند، و `app/build.gradle` اصلاً به آن وابسته نبود.
- **رفع:** `implementation project(':expo')`.
- این مانع از قبل وجود داشت؛ بیلد محلی هیچ‌وقت به آن نرسیده بود چون همیشه زودتر روی ninja می‌افتاد.

### ج) عارضه‌های `C:\pn` — store بیرون از ریپو

- **علامت ۱:** هر ۱۰ سوئیت Jest موبایل: `Cannot find module '@babel/runtime/helpers/interopRequireDefault'`
  از `react-native/jest/react-native-env.js`.
- **ریشه:** Node برای وابستگیِ اعلام‌نشده به **بالا** می‌رود. از `C:\pn\…` هرگز به `node_modules` ریشه‌ی ریپو
  نمی‌رسد، که `publicHoistPattern` پکیج‌های `@babel/runtime` و `invariant` و … را آنجا می‌گذارد — و pnpm
  همان‌ها را در `C:\pn\node_modules` (hoist خصوصی) **تکرار نمی‌کند** (۱۵۳۳ پکیج آنجا بود، این‌ها نه).
  Metro سالم ماند چون `nodeModulesPaths` ریشه را صریح دارد؛ require ی خود Node ندارد.
- **علامت ۲:** مسیر درایو ویندوز در فایل commit‌شده‌ای که Vercel و EAS روی لینوکس می‌خوانند.
- **علامت ۳ (جدا، ولی همان سشن):** بعد از بازسازی `node_modules` هیچ `node_modules/.bin` ی در کل monorepo
  نبود → jest/vitest/tsc هیچ‌جا اجرا نمی‌شد. ریشه: `better-sqlite3@13.0.3` (ریشه) باینری را در `prebuilds/`
  دارد و `"gypfile": false`، ولی `binding.gyp` در tarball هست؛ `allowBuilds: better-sqlite3: true` باعث
  `node-gyp rebuild` شد → Python نبود → install **قبل از لینک bin** ها قطع شد. رفع: `allowBuilds` نسخه‌ای —
  `@11.10.0: true` (دسکتاپ، باینری دانلود می‌کند)، `@13.0.3: false`.
- **الگو:** «رفعی که وریفای شد، فقط همان چیزی را که وریفای شد رفع کرده». BUILD SUCCESSFUL درست بود؛ Jest اجرا نشده بود.

**نتیجه (۲۵ سپتامبر، با store داخل ریپو):** `BUILD SUCCESSFUL in 3m 30s`، ۳۲ تسک CMake، بدون ninja؛
`app-debug.apk` شامل `assets/shell/index.html` (۴.۷ مگابایت)، `libexpo-modules-core.so` و `libfbjni.so`.
Jest موبایل ۱۰/۱۰ سوئیت، ۱۶۲/۱۶۲ تست.

## BUG-025 — APK ی release: سه مانع پشت سر هم، هیچ‌کدام در debug دیده نمی‌شد

debug APK بدون JS ی جاسازی‌شده است و از Metro می‌خواند؛ پس هر سه فقط در release ظاهر شدند.

### الف) `createBundleReleaseJsAndAssets` — «None of these files exist» برای فایلی که وجود دارد

- **ریشه (لاگ‌شده، نه حدس):** پلاگین Gradle ی RN همیشه entry را **مطلق** می‌دهد؛ `@expo/cli` بک‌اسلش را
  اسلش می‌کند و `./` جلویش می‌گذارد → resolver درخواست `./C:/Users/…/index.js` می‌گیرد: مسیر **نسبی** به پوشه‌ای به اسم `C:`.
- **رفع:** `metro.config.js` — درخواست drive-letter (با یا بی `./`) نسبت به مبدأ بازنویسی می‌شود.
- **گارد:** `src/__tests__/metro-windows-entry.test.ts` (injection-tested).

### ب) `SHELL_MISSING_FROM_APK` در حالی که `assets/shell/index.html` داخل APK بود

- **ریشه:** `expo-file-system` برای `file://` از `java.io.File.exists()` استفاده می‌کند؛ `android_asset` روی دیسک
  نیست. چک برای **هر** APK «نیست» می‌گفت. فقط `asset:///` از AssetManager می‌رود.
- **رفع:** `getInfoAsync('asset:///shell/index.html')`؛ WebView همچنان `file:///android_asset/…` را می‌گیرد.
- **گارد:** `one-ui-two-hosts.test.ts` (injection-tested).

### ج) WebView کد مینیفای‌شده را به‌صورت متن نشان داد

- **الگو:** «`String.replace` با رشته‌ی جایگزین». در رشته‌ی جایگزین `` $` `` و `$'` و `$&` الگو هستند و کد مینیفای
  آن‌ها را دارد → تکه‌هایی از خود HTML (با `</script>`) وسط باندل کپی شد. فایل ۲۴ `</script` داشت به‌جای ۱.
- **رفع:** `packages/app-shell/vite.shell.mjs` — جایگزین به‌صورت **تابع** (`() => …`) برای script و style.
- **گارد:** `one-ui-two-hosts.test.ts` (injection-tested).

### د) بعد از ورود: `ReferenceError: __VITE_PRELOAD__ is not defined`

- **ریشه:** Vite جای‌نگهدار `__VITE_PRELOAD__` را در `generateBundle` ی `vite:build-import-analysis` پر می‌کند.
  `enforce: 'post'` روی پلاگین کافی نبود — inliner زودتر اجرا شد و کد خام را در HTML گذاشت (۴ جای‌نگهدار).
  صفحه‌ی ورود (بدون lazy route) سالم بود؛ اولین route ی lazy بعد از ورود مرد.
- **رفع:** `generateBundle: { order: 'post', handler }`. بعد از رفع: ۰ جای‌نگهدار؛ داشبورد با داده‌ی واقعی رندر شد.
- **گارد:** `one-ui-two-hosts.test.ts` (injection-tested).

**نتیجه (۲۵ سپتامبر):** `app-release.apk` (۱۰۵ مگابایت) روی شبیه‌ساز نصب شد، ورود و داشبورد رندر شد؛ API
در هر دو باندل `https://api.hisabche.com/api`. ⚠️ `.env` محلی `EXPO_PUBLIC_API_URL` دارد — بیلد release
را همیشه با این متغیر **صریح** بساز. Jest موبایل ۱۱/۱۱ سوئیت، ۱۶۶ تست.

## BUG-026 — پوسته‌ی دسکتاپ/موبایل: شش «قانون بدون صداکننده» که آفلاین را از کار انداخته بودند (۲۵ سپتامبر)

الگوی مسلط: §۷٫۱ — انتزاع ساخته شده، درست هم هست، هیچ caller ندارد.

| #   | چه چیزی وجود داشت و صدا زده نمی‌شد                                   | اثر                                                                                      | رفع                                                                                                                         |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ۱   | `fetchWorkspace` فقط در صفحه‌ی تنظیمات workspace                     | `workspaceId` همه‌جا null → realtime به هیچ چیز subscribe نمی‌کرد، sync با workspace تهی | `useLoadWorkspace` در `app-shell/providers.tsx` + وب `dashboard-layout.tsx` (گارد `workspace-is-loaded-on-sign-in.test.ts`) |
| ۲   | `useBackgroundSync` و `useWorkspaceCache` هرگز mount نشده بودند      | SQLite دستگاه هیچ‌وقت پر نمی‌شد؛ آفلاین «فاکتوری یافت نشد»                               | mount در `app-shell.tsx`، با `workspaceId` در deps                                                                          |
| ۳   | `db.enqueue` هیچ caller نداشت (جز retry صفحه‌ی sync)                 | فاکتور آفلاین: دکمه می‌چرخید و فروش گم می‌شد                                             | `registerOfflineQueue` + `submitInvoice` (همان payload و همان Idempotency-Key) — گارد `offline-invoice-queue.test.ts`       |
| ۴   | `setRefreshSession` در پوسته ثبت نشده بود؛ refreshToken ذخیره نمی‌شد | هر نشست دسکتاپ/موبایل ~۱ ساعت بعد خارج می‌شد؛ آفلاین نشست **پاک** می‌شد                  | ذخیره‌ی `refreshToken`، `isSessionUsable` در auth-core، ثبت refresh (خطای شبکه = sign-out نیست) — گارد `auth-gate.test.ts`  |
| ۵   | Supabase client بدون توکن کاربر (anon)                               | realtime با RLS هیچ ردیفی تحویل نمی‌داد                                                  | `accessToken` option + `setSupabaseTokenSource` — گارد `realtime-runs-as-the-user.test.ts`                                  |
| ۶   | `ThemeProvider` برای `next-themes` mount نشده بود                    | دکمه‌ی تم کار نمی‌کرد (دسکتاپ و موبایل)                                                  | `useThemeStore` (همان store وب)                                                                                             |

و موارد وابسته: جدول‌های داده در publication نبودند (`docs/realtime-data-tables-migration.sql` — **PASS ۱۴/۱۴**، ۲۶ سپتامبر)؛
خطای شبکه با ۵۰۰ واقعی قابل تشخیص نبود (`NETWORK_ERROR`)؛ WebView اندروید `online/offline` را اعلام نمی‌کرد (NetInfo → رویداد)؛
`scalesPageToFit` + نبود `minimum-scale` صفحه را zoom-out و منوی پایین را بیرون می‌برد؛ blur در WebView لکه می‌انداخت (`data-host`)؛
`better-sqlite3` به‌عنوان optionalDependency در بسته‌ی ویندوز جمع نمی‌شد (`Cannot find module`) → dependencies.

## BUG-027 — دیپلوی ورسل: `ERR_PNPM_IGNORED_BUILDS` روی `@embedded-postgres/linux-x64` (۲۶ سپتامبر)

- **علامت:** `pnpm install --frozen-lockfile` روی Vercel با exit 1 تمام شد؛ commit `97b5440`.
- **ریشه:** `embedded-postgres` (تست‌های Postgres واقعی بک‌اند) پکیج جدا برای هر پلتفرم دارد و pnpm فقط نسخه‌ی
  همان ماشین را نصب می‌کند. در `allowBuilds` فقط `windows-x64` تأیید شده بود (ماشینی که روی آن اضافه شد)؛
  ورسل لینوکس است و pnpm 11 روی build script بی‌تصمیم کل نصب را می‌شکند. نصب محلی سبز بود و هیچ نشانه‌ای نداشت.
- **رفع:** هر هشت نسخه‌ی پلتفرم در `pnpm-workspace.yaml` (اسکریپت فقط symlink داخل باینری خودش را می‌سازد).
- **گارد:** `backend/src/__tests__/workspace-build-approvals.test.ts` — اگر یک نسخه‌ی پلتفرمیِ پکیجی تأیید شده،
  همه‌ی نسخه‌های آن در lockfile باید تصمیم داشته باشند. injection: حذف `linux-x64` → قرمز با نام همان پکیج.
- **درس:** «نصب روی ماشین من سبز است» برای پکیج‌های پلتفرمی چیزی ثابت نمی‌کند؛ lockfile همه‌ی پلتفرم‌ها را دارد، ماشین نه.
