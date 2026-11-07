# مطابقت ۱۶۰ باگ گزارش Antigravity با کد

> ۷ نوامبر ۲۰۲۶ · شاخه‌ی `claude/hisabche-user-journey-audit-fbe868` (کامیت پایه `28154aca`)
> ورودی: [AUDIT-80-BUGS-FULL-REPORT.md](AUDIT-80-BUGS-FULL-REPORT.md) (۱–۸۰) و [AUDIT-80-MORE-BUGS-DETAILED.md](AUDIT-80-MORE-BUGS-DETAILED.md) (۸۱–۱۶۰).
> روش: برای هر باگ، فایل‌های نام‌برده روی دیسک بررسی شد (۳۸ مورد به فایلی ارجاع می‌دهند که **وجود ندارد**)، شناسه‌های BUG-xxx با `.claude/BUG-REGISTRY.md` تطبیق داده شد، و ادعاهای قابل‌آزمون با خواندن کد سنجیده شد. **هیچ‌کدام روی سایت زنده یا دیتابیس واقعی بازتولید نشد.**

## خلاصه

| حکم                          | تعداد   | معنا                                                                                                                            |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 🔧 همین دور رفع شد           | ۴       | #14، #24، #146، #160                                                                                                            |
| ✅ قبلاً رفع شده             | ۹۲      | کد فعلی رفع را نشان می‌دهد یا رجیستری «رفع شد» + گارد سبز (برای BUG های تاریخی مبنا رجیستری + سوئیت سبز است، نه بازخوانی تک‌تک) |
| ❌ ادعا با کد نمی‌خواند      | ۲۳      | فایل/رفتار ادعاشده وجود ندارد یا برعکس است                                                                                      |
| 🟡 شکاف محصول، نه باگ        | ۱۱      | قابلیتی که ساخته نشده (ساختنش تصمیم محصولی است)                                                                                 |
| 🟠 تأییدشده، تصمیم با شما    | ۹       | مشکل واقعی است ولی رفعش یک سیاست تازه می‌خواهد                                                                                  |
| ⚪ مبهم، بدون فایل/خط/سناریو | ۲۱      | ادعا آن‌قدر کلی است که قابل‌تأیید یا رد نیست                                                                                    |
| **جمع**                      | **۱۶۰** |                                                                                                                                 |

> ⚠️ **الگوی کلی گزارش:** بیشتر عنوان‌ها BUG-های قدیمیِ رجیستری را با جمله‌ی تازه بازگو کرده‌اند و چند عنوان با رجیستری **نمی‌خواند** (مثلاً #۵۶ «BUG-040 = قفل `useRef`»، در حالی که BUG-040 در رجیستری `deleted_at` است؛ #۴۳ «BUG-131 = تلورانس فلوت» در حالی که BUG-131 کپی ششم `round2` است). بند «نقش و عملکرد فایل» در همه‌ی ۸۰ مورد اول یک جمله‌ی تکراری است.

## چهار مورد که همین دور رفع شد

| #   | مشکل واقعی                                                                                                                                                                                                                                             | رفع                                                                                                                    | گارد                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ۱۴  | `/api/debug/routes                                                                                                                                                                                                                                     | check                                                                                                                  | info`به **هر کاربر واردشده‌ای** فهرست کل route ها، حافظه، نسخه‌ی Node و`NODE_ENV` را می‌داد (ادعای «سوابق اعضا» درست نبود) | `backend/src/routes/debug.routes.ts`: `preHandler: [authenticate, platformAdminGuard]` روی هر سه | `backend/src/__tests__/audit80-fixes.test.ts` |
| ۲۴  | `t(key as any)` در دو فایل — فقط نوع، کرش نمی‌کرد؛ ولی `any` در این مخزن ممنوع است                                                                                                                                                                     | `as Parameters<typeof t>[0]` در `first-value-checklist.tsx` و `sales-hub-container.tsx`                                | `packages/ui/src/__tests__/audit80-ui-fixes.test.ts`                                                                       |
| ۱۴۶ | ساخت قالب تأیید و ثبت شرطش اگر سرور رد می‌کرد، **هیچ پیامی نمی‌داد** (rejection بی‌صاحب، فرم بی‌صدا باز می‌ماند)                                                                                                                                       | `workflow-templates-container.tsx`: `toast.error` با `apiErrorMessage`؛ `workflow-templates-view.tsx`: فرم باز می‌ماند | همان                                                                                                                       |
| ۱۶۰ | `clearCache('workflows:*')` و `'workflow-instances:*'` کش **همه‌ی کسب‌وکارها** را پاک می‌کرد؛ و `clearCache('workflow-instance:<id>')` با کلید واقعی (`prefix:user:workspace:url`) **هرگز جور نمی‌شد** — بعد از تأیید، جزئیات تا ۶۰ ثانیه کهنه می‌ماند | `workflow.routes.ts`: هر دو → `*workflow*<workspaceId>*`                                                               | `audit80-fixes.test.ts`                                                                                                    |

تست تزریقی: برگرداندن گارد debug و حذف catch فرم، هر کدام یک تست را قرمز کرد؛ بازگردانی سبز.

## ۹ مورد تأییدشده که تصمیمش با شماست (رفع نشد)

| #   | چه دیدم                                                                                                                                                          | چرا رفع نکردم                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ۸   | route های نوشتنی پروژه (`project.routes.ts`) فقط عضویت می‌خواهند؛ بیننده هم می‌تواند پروژه بسازد/حذف کند. بخش بین‌مستأجری (N-31) با `assertProjectOwned` رفع شده | در `CAPABILITIES` هیچ مجوز پروژه‌ای نیست؛ ساختنش سیاست تازه است (G4)              |
| ۱۳  | `requireStepUpMfa` در `mfa.middleware.ts` هست و **هیچ route ای صدایش نمی‌زند** (الگوی §۷٫۱)                                                                      | ورود دومرحله‌ای مشتری قابلیت محصول نیست؛ وصل یا حذف، تصمیم شماست                  |
| ۴۰  | مالیات خط فاکتور در سند دفتر نمی‌نشیند (BUG-136 / N-37 — «گزارش، تعمیر نشد»)                                                                                     | تصمیم حسابداری مالک                                                               |
| ۶۸  | پول محلی صحیح شده (BUG-128) **به‌جز** جدول `payroll` در `app-bridge/src/local-schema.ts` (`base_salary`، `net_salary`، … `REAL`)                                 | تبدیل = migration محلی SQLite + تغییر موتور حقوق آفلاین؛ نیاز به آزمون روی دستگاه |
| ۶۹  | بی‌شبکه، دروازه‌ی نقش باز می‌ماند (BUG-125: `access?.blockedModules ?? []`)                                                                                      | رجیستری: «تصمیم مالک» — بستن دروازه بدون قابلیت ذخیره‌شده                         |
| ۸۴  | ستون «قیمت خرید» و ارزش در فهرست کالای هاب انبار بدون دروازه‌ی نقش (BUG-124 «رفع نشد»)                                                                           | رجیستری: تصمیم مالک                                                               |
| ۹۸  | PDF فاکتور برچسب‌هایش فقط فارسی است؛ `lang` فقط قالب عدد/تاریخ را عوض می‌کند (جهت معکوس نیست؛ زبان دوم نیست)                                                     | ترجمه‌ی PDF یک قابلیت است                                                         |
| ۱۱۸ | پرداختِ نقدیِ خروجی از صندوق، بیش از نقد صندوق را رد نمی‌کند (انتقال به بانک رد می‌کند). صندوق بسته رد می‌شود                                                    | ناهم‌سانی سیاست؛ مثل فروش بیش از موجودی، تصمیم است                                |
| ۱۵۶ | `services/webhook.service.ts` (Stripe) **صفر importer** دارد — آسیب‌پذیری نیست چون route ندارد، ولی کد مرده است (§۱۴)                                            | حذف فایل بی‌ربط با این دور؛ پیشنهاد حذف                                           |

## جدول کامل

| #   | حکم | شاهد                                                                                                                                                  |
| --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ✅  | `dashboard-layout.tsx:615` مسیر `/onboarding` را بدون workspace mount می‌کند                                                                          |
| 2   | ❌  | هیچ `.eq('user_id'` در سرویس‌های حسابداری نیست                                                                                                        |
| 3   | ❌  | route ها `request.tenancy.role` می‌خوانند؛ `userRole` فقط در middleware ست می‌شود                                                                     |
| 4   | ✅  | `Idempotency-Key` و `x-workspace-id` در `allowedHeaders` (`index.ts:590`)؛ گارد `cors-allowed-headers`                                                |
| 5   | ✅  | BUG-014/019؛ گارد `token-ready-waits-for-hydration` (فایل نام‌برده `packages/api/src/client.ts` وجود ندارد)                                           |
| 6   | ✅  | BUG-067؛ `useLocalePush`؛ گارد `dashboard-page-structure`                                                                                             |
| 7   | ✅  | `auth.slice.ts` در logout `workspaceId` را پاک می‌کند                                                                                                 |
| 8   | 🟠  | بالا                                                                                                                                                  |
| 9   | ✅  | BUG-018                                                                                                                                               |
| 10  | ❌  | مسیر `(auth)/reset-password` وجود ندارد؛ لینک از `FRONTEND_URL` ساخته می‌شود                                                                          |
| 11  | ❌  | دسکتاپ از `file://` بالا می‌آید ⇒ `usesCookieTransport()` false ⇒ توکن در بدنه؛ پوشه‌ی `electron/main/auth/` وجود ندارد                               |
| 12  | ✅  | `apps/web/scripts/copy-standalone-assets.js` هست                                                                                                      |
| 13  | 🟠  | بالا                                                                                                                                                  |
| 14  | 🔧  | بالا                                                                                                                                                  |
| 15  | ❌  | `refreshInFlight` در `packages/api/src/lib/client.ts:447` تمدید را یکی می‌کند؛ بین تب‌ها کوکی مشترک است                                               |
| 16  | ⚪  | بدون سناریو                                                                                                                                           |
| 17  | ✅  | BUG-085؛ گارد `robots-does-not-block-public`                                                                                                          |
| 18  | ✅  | `workspace.service.ts:645` ایمیل دعوت را حروف‌کوچک مقایسه می‌کند                                                                                      |
| 19  | ⚪  | حلقه‌ای در گارد دیده نشد؛ `redirected` ref تکرار را می‌گیرد                                                                                           |
| 20  | ❌  | `ui-contract/src/navigation.ts` هیچ منطق نقشی ندارد؛ نقش سفارشی از `hiddenModules` می‌آید                                                             |
| 21  | ✅  | `asList` (`packages/api/src/lib/as-list.ts`)                                                                                                          |
| 22  | ❌  | `as unknown as Record` عمداً برای خواندن دو شکل camel/snake است؛ UI نمی‌شکند (بوی کد)                                                                 |
| 23  | ✅  | BUG-093                                                                                                                                               |
| 24  | 🔧  | بالا                                                                                                                                                  |
| 25  | ✅  | BUG-109؛ گارد `unknown-is-not-zero`                                                                                                                   |
| 26  | ✅  | BUG-004؛ ۱۸ فایل هنوز `toISOString().slice(0,10)` دارند — برای query/Postgres درست است (`toIsoDay` میلادی)؛ روز محلی از `utils/local-day.ts`          |
| 27  | ✅  | BUG-070/071                                                                                                                                           |
| 28  | ✅  | BUG-072؛ گارد `dashboard-page-structure`                                                                                                              |
| 29  | ⚪  | بدون schema مشخص                                                                                                                                      |
| 30  | ✅  | BUG-003                                                                                                                                               |
| 31  | ✅  | BUG-127 «رفع نشد» بود؛ گارد `no-hardcoded-currency` سبز است                                                                                           |
| 32  | ❌  | فایل `packages/ui/src/lib/api-error.ts` وجود ندارد؛ `apiErrorMessage` در `packages/api/src/lib/api-error-message.ts` + گارد `error-reading-is-shared` |
| 33  | ✅  | گارد `dashboard-page-structure` (بدون `router.push` برهنه)                                                                                            |
| 34  | ⚪  | بدون مسیر مشخص؛ پول از خطوط در سرور (BUG-135)                                                                                                         |
| 35  | ✅  | گارد `select-consistency`                                                                                                                             |
| 36  | ✅  | BUG-055؛ نوشتن سند با RPC `invoice_write_document` و رد مسیر گام‌به‌گام                                                                               |
| 37  | ⚪  | «کانتینرهای فرم» بدون نام؛ قاعده‌ی idempotency یک‌بار به‌ازای فرم (BUG-122)                                                                           |
| 38  | ✅  | N-01/N-21؛ RPC `invoice_return_create` با `restockChoice` (migration ها منتظر VERIFY)                                                                 |
| 39  | ❌  | `invoice_lines` در `invoice-return.service.ts` وجود ندارد                                                                                             |
| 40  | 🟠  | بالا                                                                                                                                                  |
| 41  | ✅  | BUG-001                                                                                                                                               |
| 42  | ✅  | `payments_record` در SQL: `FOR UPDATE` + `PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING`                                                                     |
| 43  | ❌  | تابع ثبت سند تساوی دقیق `numeric` می‌سنجد (`v_total_debit <> v_total_credit`)؛ فلوتی نیست                                                             |
| 44  | ✅  | BUG-117 (`settlesInCurrency`)                                                                                                                         |
| 45  | ✅  | N-03/N-15: `assert_customer_credit` و حالت `block` در `invoice.service.ts:1664`                                                                       |
| 46  | ⚪  | `logBusinessEvent` روی فاکتور/پرداخت هست؛ ادعا کلی                                                                                                    |
| 47  | ✅  | BUG-091/092                                                                                                                                           |
| 48  | ✅  | `reverseEffects` (`invoice.service.ts:2132`)                                                                                                          |
| 49  | ✅  | BUG-118 (فایل `till.service.ts` وجود ندارد؛ `pos.service.ts`)                                                                                         |
| 50  | ❌  | ماژول چک (`cheque.service.ts`) وجود ندارد                                                                                                             |
| 51  | ❌  | کانال‌ها `hisabche-${workspaceId}-${table}` هستند (`realtime.ts:102`)                                                                                 |
| 52  | ✅  | BUG-012 + `invalidateMoneyCaches`                                                                                                                     |
| 53  | ✅  | BUG-011؛ کلید کش `prefix:scope:url`                                                                                                                   |
| 54  | ✅  | BUG-106                                                                                                                                               |
| 55  | ✅  | BUG-002                                                                                                                                               |
| 56  | ✅  | `workspace-container.tsx` — رفع با کامنت «FIX» همان مشکل                                                                                              |
| 57  | ✅  | BUG-008                                                                                                                                               |
| 58  | ✅  | `trial-balance` در `money-cache-keys.ts` و با هر تغییر پول پاک می‌شود                                                                                 |
| 59  | ⚪  | بدون سناریو                                                                                                                                           |
| 60  | ⚪  | بدون سناریو                                                                                                                                           |
| 61  | ✅  | N-30: `sync.service.ts:677` حذف از push را رد می‌کند                                                                                                  |
| 62  | ✅  | N-35: `.eq('version', expectedVersion)` در `sync.service.ts:771`                                                                                      |
| 63  | ✅  | N-36 (pg test منتظر محیط)                                                                                                                             |
| 64  | ✅  | BUG-033                                                                                                                                               |
| 65  | ❌  | یک اتصال، WAL، و timeout پیش‌فرض better-sqlite3                                                                                                       |
| 66  | ✅  | BUG-034 (فایل `till.routes.ts` وجود ندارد)                                                                                                            |
| 67  | ❌  | موبایل عمداً WebView روی `app-shell`/`packages/ui` است                                                                                                |
| 68  | 🟠  | بالا                                                                                                                                                  |
| 69  | 🟠  | بالا                                                                                                                                                  |
| 70  | ✅  | BUG-040                                                                                                                                               |
| 71  | ✅  | BUG-058                                                                                                                                               |
| 72  | ✅  | BUG-056                                                                                                                                               |
| 73  | ✅  | BUG-126 «رفع نشد» بود؛ حالا `workspaceId` در `partialize` ذخیره و در شکست شبکه نگه داشته می‌شود (`workspace.slice.ts:95,212`)                         |
| 74  | ❌  | logout بدنه‌ی پاسخ را parse نمی‌کند؛ axios بدنه‌ی خالی را می‌پذیرد                                                                                    |
| 75  | ✅  | BUG-114                                                                                                                                               |
| 76  | ⚪  | supabase-js روی HTTP است؛ بدون سناریو                                                                                                                 |
| 77  | ✅  | BUG-119                                                                                                                                               |
| 78  | ⚪  | بدون سناریو                                                                                                                                           |
| 79  | ✅  | BUG-069/089                                                                                                                                           |
| 80  | ❌  | pull حذف را با `data: null` می‌فرستد (`sync.service.ts:1061`)                                                                                         |
| 81  | ✅  | BUG-081                                                                                                                                               |
| 82  | ✅  | BUG-080 (`stockEditWarehouse`)                                                                                                                        |
| 83  | 🟡  | N-24b: واریانت موجودی/انبار ندارد                                                                                                                     |
| 84  | 🟠  | بالا                                                                                                                                                  |
| 85  | ✅  | BUG-049 (فایل `fefo.service.ts` وجود ندارد)                                                                                                           |
| 86  | ✅  | BUG-102 (علت واقعی نام پارامتر بود، نه «کد به‌جای UUID»)                                                                                              |
| 87  | 🟡  | N-39: رزرو موجودی ساخته نشده                                                                                                                          |
| 88  | ✅  | BUG-094                                                                                                                                               |
| 89  | ❌  | حرکت `adjustment` با `reference_type` و `notes` نوشته می‌شود (`warehouse.service.ts:452`)                                                             |
| 90  | ⚪  | فایل `stock-count-view.tsx` وجود ندارد؛ بدون سنجه                                                                                                     |
| 91  | ✅  | BUG-135                                                                                                                                               |
| 92  | ✅  | BUG-005 + `apiErrorMessage`                                                                                                                           |
| 93  | ❌  | `commission.service.ts` وجود ندارد؛ کمیسیون رفرال روی اشتراک است نه فاکتور                                                                            |
| 94  | ❌  | `quick-invoice-page.tsx` وجود ندارد                                                                                                                   |
| 95  | ❌  | `invoice-math.ts:208`: `taxable = subtotal − discount`                                                                                                |
| 96  | ✅  | `invoice-draft.slice.ts` با `persist`                                                                                                                 |
| 97  | 🟡  | ماژول پیگیری فروش با پیامک وجود ندارد                                                                                                                 |
| 98  | 🟠  | بالا                                                                                                                                                  |
| 99  | ✅  | `reverseEffects` پرداخت‌های خود فاکتور را لغو می‌کند؛ مشترک ⇒ `INVOICE_PAYMENT_SHARED`                                                                |
| 100 | ✅  | BUG-077                                                                                                                                               |
| 101 | ✅  | BUG-110                                                                                                                                               |
| 102 | ✅  | BUG-133                                                                                                                                               |
| 103 | ✅  | BUG-113                                                                                                                                               |
| 104 | ✅  | BUG-112                                                                                                                                               |
| 105 | 🟡  | تسعیر دستی هست (`/api/finance/currency/revalue`)؛ خودکار پایان ماه نیست                                                                               |
| 106 | ❌  | هیچ PATCH/DELETE برای سند روزنامه نیست؛ فقط post و reverse                                                                                            |
| 107 | ✅  | `ledgerLines` همه‌ی خطوط را صفحه‌به‌صفحه می‌خواند                                                                                                     |
| 108 | ✅  | FK در `db-integrity-01` (منتظر اجرا)                                                                                                                  |
| 109 | 🟡  | تفکیک سود عملیاتی/غیرعملیاتی ساخته نشده                                                                                                               |
| 110 | ✅  | BUG-084؛ دارایی اسقاط‌شده ردیف‌های آینده را `cancelled_at` می‌زند و `postDue` آن‌ها را نمی‌خواند                                                      |
| 111 | ✅  | `open-invoices-net-of-returns`                                                                                                                        |
| 112 | ✅  | `CUSTOMER_HAS_INVOICES` / `…_PAYMENTS` / `…_TRANSACTIONS`                                                                                             |
| 113 | ✅  | BUG-079 (فایل `portal.routes.ts` وجود ندارد)                                                                                                          |
| 114 | ✅  | BUG-016                                                                                                                                               |
| 115 | ✅  | حالت `block` در سرور؛ عبور فقط با `credit.override`                                                                                                   |
| 116 | ✅  | BUG-121                                                                                                                                               |
| 117 | ✅  | BUG-010                                                                                                                                               |
| 118 | 🟠  | بالا                                                                                                                                                  |
| 119 | ⚪  | فایل نام‌برده وجود ندارد؛ بدون سناریو                                                                                                                 |
| 120 | ⚪  | بدون سناریو                                                                                                                                           |
| 121 | ✅  | BUG-092                                                                                                                                               |
| 122 | ✅  | BUG-095                                                                                                                                               |
| 123 | 🟡  | سربار تولید ساخته نشده                                                                                                                                |
| 124 | ✅  | فرمول استفاده‌شده بازنگری می‌شود و تاریخچه از `work_order_lines` (snapshot)                                                                           |
| 125 | ✅  | BUG-091                                                                                                                                               |
| 126 | ⚪  | گذار وضعیت دستور لغوشده بدون سناریو                                                                                                                   |
| 127 | 🟡  | ضایعات تولید ساخته نشده                                                                                                                               |
| 128 | ✅  | قفل ماژول (`isNavLocked`)                                                                                                                             |
| 129 | 🟡  | N-50 واحد طول/مساحت                                                                                                                                   |
| 130 | 🟡  | محصول فرعی                                                                                                                                            |
| 131 | ✅  | BUG-015/017                                                                                                                                           |
| 132 | ✅  | BUG-088                                                                                                                                               |
| 133 | ✅  | BUG-097                                                                                                                                               |
| 134 | ✅  | unique index `attendance-01`                                                                                                                          |
| 135 | 🟡  | معافیت مالیاتی حقوق (`payroll-calculator.ts` وجود ندارد)                                                                                              |
| 136 | 🟡  | سهم بیمه‌ی کارفرما (N-37)                                                                                                                             |
| 137 | ❌  | `branch.service.ts:172` فقط مالک                                                                                                                      |
| 138 | ✅  | `requireCapability('payroll.read')` (فایل `payroll.routes.ts` وجود ندارد)                                                                             |
| 139 | ✅  | BUG-096                                                                                                                                               |
| 140 | ⚪  | cast شاخه‌ها فقط وقتی فهرست تخت خالی است؛ بدون اثر دیده‌شده                                                                                           |
| 141 | ✅  | BUG-098                                                                                                                                               |
| 142 | ⚪  | UX کلی                                                                                                                                                |
| 143 | ⚪  | BUG-043 در رجیستری درباره‌ی سفارش خرید است، نه سوییچ                                                                                                  |
| 144 | ⚪  | مسیر `.../loading.tsx` مبهم                                                                                                                           |
| 145 | ⚪  | «فرم‌های دیالوگ» بدون نام                                                                                                                             |
| 146 | 🔧  | بالا                                                                                                                                                  |
| 147 | ⚪  | قاعده‌ی `whitespace-nowrap` + `clamp()`؛ بدون سنجه                                                                                                    |
| 148 | ⚪  | فایل `table/data-table.tsx` وجود ندارد                                                                                                                |
| 149 | ❌  | `apps/mobile/screens/WarehouseScreen.tsx` وجود ندارد                                                                                                  |
| 150 | ✅  | `dashboard-sidebar.tsx` از `useRouteLang` می‌خواند                                                                                                    |
| 151 | ✅  | N-33: `workspace.manage` / `license.manage` روی همه‌ی route های مجوز                                                                                  |
| 152 | ✅  | BUG-107 (`dashboard-visibility.domain.ts`)                                                                                                            |
| 153 | ✅  | BUG-105                                                                                                                                               |
| 154 | ✅  | BUG-103                                                                                                                                               |
| 155 | ✅  | BUG-099                                                                                                                                               |
| 156 | 🟠  | بالا                                                                                                                                                  |
| 157 | ✅  | BUG-047                                                                                                                                               |
| 158 | ✅  | BUG-137                                                                                                                                               |
| 159 | ✅  | BUG-114                                                                                                                                               |
| 160 | 🔧  | بالا                                                                                                                                                  |

## گاردهای قرمز روی `main` که در این دور پیدا و رفع شدند (خارج از ۱۶۰ مورد)

روی checkout اصلی (کامیت `28154aca`) **پنج تست UI و سه تست بک‌اند قرمز بودند**؛ هیچ‌کدام از تغییرات امروز نبود:

| گارد                                         | مشکل واقعی                                                                                                                                                                          | رفع                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `no-self-barrel-import`، `no-import-cycles`  | چهار فایل اسکلتون (`customer-detail`، `developers`، `team-payroll`، `till`) `Skeleton` را از `@hisabche/ui` می‌گرفتند — چرخه‌ی barrel ⇒ خطر «Cannot access X before initialization» | `import { Skeleton } from '../skeleton'`                                                                              |
| `personal-view`                              | شاخه‌ی «بدون workspace» در `dashboard-layout.tsx` متن **فارسی ثابت** و رنگ پالت `text-neutral-400` داشت (کاربر انگلیسی/دری فارسی می‌دید)                                            | کلید `onboarding.preparingWorkspace` در سه زبان + `text-[hsl(var(--fg-tertiary))]`؛ گارد با همان سخت‌گیری بازنویسی شد |
| `header-sidebar-identity`                    | regex یک‌خطی، بعد از formatter چندخطی                                                                                                                                               | regex تحمل‌پذیر به ویرگول/خط                                                                                          |
| `activity-summaries-batched` (بک‌اند، ۳ تست) | `baseCurrencyOf` به double تست `.maybeSingle()` می‌خواست                                                                                                                            | `baseCurrencyOf` در همان تست stub شد؛ assertion دسته‌بندی دست نخورد                                                   |
