# شکاف‌ها و مسدودکننده‌های گردش‌کار

> کامیت `28154aca` · ۷ نوامبر ۲۰۲۶ · سند اصلی: [HISABCHE_MASTER_USER_JOURNEY.md](HISABCHE_MASTER_USER_JOURNEY.md)
> فقط گزارش؛ هیچ اصلاحی انجام نشد (§۱۳ «اول گزارش، بعد اصلاح»).
> **اولویت:** P0 = مانع ورود کاربر یا ریسک یکپارچگی مالی/داده · P1 = مانع یک گردش‌کار اصلی · P2 = ماژول ناقص یا نبودِ راحتی عملیاتی · P3 = UX.
> **اطمینان:** «تأییدشده در کد» یعنی خط کد را خواندم؛ «محتمل» یعنی استدلال از کد است ولی اجرا ندیدم.

## P0

> **به‌روزرسانی ۷ نوامبر (دور اصلاح P0):**
> GAP-01 و GAP-02 (بخش پایگاه‌داده) → `IMPLEMENTED_NOT_LIVE_VERIFIED`: workspace و عضویت مالک با تابع
> `workspace_create_with_owner` در یک تراکنش (`docs/workspace-create-01-migration.sql`،
> `workspace.service.ts`)؛ نتیجه‌ی نوشتن پروفایل خوانده و با `SIGNUP_PROFILE_NOT_WRITTEN` لاگ می‌شود؛ شکست workspace
> با `SIGNUP_WORKSPACE_NOT_PROVISIONED` و شناسه‌ی کاربر لاگ می‌شود و دیگر ردیف یتیم نمی‌گذارد. ایجاد حساب در
> Supabase Auth هم‌چنان بیرون از آن تراکنش است (API جدا؛ حذف جبرانی ممنوع). migration: PENDING HUMAN CONFIRMATION.
> GAP-05 → `IMPLEMENTED_NOT_LIVE_VERIFIED`: لاگ پیشوند و طول کلید حذف شد.
> GAP-03 و GAP-04 **اصلاح نشدند** (دلیل در گزارش دور اصلاح و `.claude/USER-REQUESTS.md`).

### GAP-01 · ثبت‌نام بدون workspace هم «موفق» برمی‌گردد

- **شاهد:** `backend/src/routes/auth.routes.ts:386-399` — `createWorkspace` در `try/catch`؛ catch فقط `fastify.log.error` می‌کند و پاسخ ۲۰۱ می‌رود.
- **اثر:** اگر INSERT workspace یا عضویت شکست بخورد (مثلاً قید یکتایی احتمالی روی slug ساخته‌شده از نام — `workspace.service.ts:134`؛ وجود قید در `docs/` پیدا نشد)، کاربر بدون workspace وارد می‌شود. onboarding با `POST /workspaces` آن را جبران می‌کند (`onboarding-container.tsx:128-136`)، ولی اگر **عضویت** شکست خورده باشد ردیف `workspaces` یتیم می‌ماند (`workspace.service.ts:180-195`).
- **اطمینان:** تأییدشده در کد. وقوع در production: `UNKNOWN`.

### GAP-02 · ثبت‌نام اتمیک نیست

- **شاهد:** `auth.routes.ts:357-418` — createUser، `profiles.upsert` (**نتیجه بررسی نمی‌شود**، خط ۳۷۵)، workspace، member، login: پنج نوشتن/فراخوانی جدا. پیام `'Account created but login failed'` (خط ۴۰۸) خودش وضعیت نیمه‌کاره را اعتراف می‌کند.
- **اثر:** حساب بدون پروفایل یا بدون workspace؛ تلاش دوباره با ۴۰۰ `Email already registered` رد می‌شود.
- **اطمینان:** تأییدشده در کد.

### GAP-03 · ساخت فاکتور یک تراکنش نیست: سند و دفتر می‌توانند از هم جدا شوند

- **شاهد:** `invoice.service.ts:1336-1378` — بعد از RPC `invoice_write_document` (فاکتور + خطوط + حرکت انبار)، `applyCosting` و `createAccountingEntries` جدا اجرا می‌شوند؛ خطا throw می‌شود ولی فاکتور و حرکت انبار می‌مانند. پرداخت همان لحظه هم جداست (`recordCreationPayments`، خط ۱۷۲۹).
- **کاهش موجود:** `POST /api/invoices/post-unposted` و `/:id/post-to-ledger` (`invoice.routes.ts:323,352`)؛ نشان «posted» با `markPosted`.
- **اثر:** موجودی کم شده و سند دفتر نیست تا کسی ترمیم را بزند؛ کاربر خطا می‌بیند ولی فاکتور ساخته شده.
- **اطمینان:** تأییدشده در کد (طراحی آگاهانه، ولی ریسک یکپارچگی).

### GAP-04 · migration های بحرانی مالی روی دیتابیس زنده تأیید نشده‌اند

- **شاهد (از CLAUDE.md، نه سنجش خودم):** `invoice-return-03/04/05`، `db-integrity-01`، `dashboard-fx-01`، `till-payments-01`، `invoice-exchange-rate-01`، `shelf-capacity-01`، `custom-units-01`، `attendance-*` — «منتظر اجرا و VERIFY».
- **اثر:** کدِ مرجوعی و صندوق RPC هایی را صدا می‌زند که شاید در production نباشند؛ وضعیت زنده `UNKNOWN`.
- **مسدودکننده:** `BLOCKED_BY_ENVIRONMENT` — دسترسی دیتابیس زنده در این ممیزی نبود و نباید باشد.

### GAP-05 · لاگ‌شدن پیشوند کلید Resend در stdout

- **شاهد:** `backend/src/services/email.service.ts:19-21` — هنگام import، وجود، **۵ نویسه‌ی اول** و طول `RESEND_API_KEY` با `console.log` چاپ می‌شود.
- **اثر:** بخشی از secret در لاگ‌های میزبان (Render). (مقدار کلید در این ممیزی خوانده یا چاپ نشد.)
- **اطمینان:** تأییدشده در کد. اولویت P0 به‌خاطر نشت secret؛ اگر صاحب پروژه ریسک را کم بداند، P1.

## P1

### GAP-06 · تأیید ایمیل/تلفن وجود ندارد

- **شاهد:** `email_confirm: true` در `auth.routes.ts:360`؛ هیچ endpoint تأییدی نیست؛ فیلد تلفن فرم وب جمع و دور ریخته می‌شود (`auth-container.tsx:137-142`).
- **اثر:** هر ایمیلی (حتی متعلق به دیگری) ثبت می‌شود؛ بازیابی رمز برای ایمیل اشتباه بی‌فایده است.

### GAP-07 · سفارش خرید هیچ UI ای ندارد و دریافتش سند دفتر نمی‌زند

- **شاهد:** `useCreatePurchaseOrder`, `usePurchaseOrders`, `useReceiveGoods` (`packages/api/src/hooks/purchasing.ts`) صفر مصرف‌کننده‌ی tsx؛ `Warehouse-container.tsx:116-129` صریحاً می‌گوید فرم ساخت وجود ندارد. `purchasing.service.ts:351-418` حرکت انبار + لایه‌ی بها می‌نویسد ولی دفتر نه.
- **اثر:** چرخه‌ی PO → GRN → فاکتور خرید وجود ندارد؛ خرید فقط با فاکتور خرید ممکن است. اگر کسی از API مستقیم هم PO دریافت کند و هم فاکتور خرید بزند، **احتمالاً موجودی دو بار اضافه می‌شود** (پیوندی بین فاکتور و PO در `invoice.service.ts` پیدا نشد) — محتمل.

### GAP-08 · ماژول هزینه وجود ندارد

- **شاهد:** هیچ `/api/expenses` یا `useExpenses`؛ فقط سند دستی یا «خروج نقد» صندوق با دلیل متنی (`pos.routes.ts:61`).
- **اثر:** دسته‌بندی هزینه، تأیید، هزینه‌ی تکراری و گزارش هزینه به تفکیک دسته ممکن نیست.

### GAP-09 · پرداخت اشتراک فقط دستی؛ درگاه وجود ندارد

- **شاهد:** `billing.routes.ts:150-200` درخواست ارتقا می‌سازد؛ `paymentMethod: 'gateway'` فقط یک مقدار enum است؛ callback یا ادغام درگاه پیدا نشد. فعال‌سازی = تأیید ادمین (`upgrade-requests-panel.tsx`, `/api/admin/upgrade-requests/:id/approve`).
- **اثر:** کاربر نمی‌تواند بدون کمک ادمین پولی شود.

### GAP-10 · مدت Trial در کد ثابت است

- **شاهد:** `TRIAL_DAYS = 7`, `GRACE_PERIOD_DAYS = 7` (`billing.service.ts:126-127`)؛ هیچ `trial_days` در `apps/admin` یا routes ادمین.
- **اثر:** تغییر مدت آزمایشی نیازمند deploy است.

### GAP-11 · Trial در ثبت‌نام ساخته نمی‌شود

- **شاهد:** `getOrCreateSubscription` (`billing.service.ts:280-325`) ردیف را در **اولین خواندن** billing می‌سازد.
- **اثر:** شروع Trial به لحظه‌ی اولین درخواست billing وابسته است، نه ثبت‌نام؛ گزارش «تاریخ شروع آزمایشی» با تاریخ ثبت‌نام فرق می‌کند. محتمل.

### GAP-12 · قابلیت‌های صنفی فقط backend دارند

- **شاهد:** صفر مصرف‌کننده‌ی UI برای `useAppointments`, `useCreateAppointment`, `useOrderDeposits`, `useCreateOrderDeposit`, `useCropCycles`, `useFreightTrips`, `useCourierDeliveries`, `useVehicles`, `useLatestMetalRate`, `useDeliveryNotes` (`packages/api/src/hooks/universal-core.ts`؛ grep روی `packages/*` و `apps/*`).
- **اثر:** «سالن زیبایی با نوبت»، «پیش‌پرداخت سفارش»، «طلافروشی با نرخ روز»، «باربری» در UI قابل استفاده نیستند. گردش‌کار G (خدمات) از نوبت تا تسویه ناقص است.

### GAP-13 · تولید سند دفتر، WIP و ضایعات ندارد

- **شاهد:** نبود `postDocument` در `manufacturing*`؛ CLAUDE.md «تولید سند دفتر کل نمی‌زند». ماتریس آفلاین `manufacturing.* = online_required`.
- **اثر:** ارزش موجودی در دفتر با انبار بعد از تولید فاصله می‌گیرد.

### GAP-14 · مسیر ساخت فاکتور مجوز قابلیت ندارد

- **شاهد:** CLAUDE.md: `POST /api/invoices` و `POST|PATCH|DELETE /api/customers` در route هیچ `requireCapability` ندارند؛ نقش سفارشی «فاکتور: نمی‌بیند» با HTTP مستقیم دور زده می‌شود.
- **اطمینان:** گزارش موجود؛ در این ممیزی دوباره اجرا نشد.

### GAP-15 · حلقه‌ی «تأیید مدیر» برای اختلاف صندوق نیست

- **شاهد:** `closeSession` (`pos.service.ts:932`) فقط دلیل اختلاف را می‌گیرد؛ گام تأیید پیدا نشد.
- **اثر:** صندوق‌دار اختلاف را خودش می‌بندد.

## P2

| شناسه  | شکاف                                                                                                                             | شاهد                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| GAP-16 | وضعیت‌های `partial` و `overdue` در schema هستند ولی نویسنده‌ای در `invoice.service.ts` ندارند                                    | `invoice.schema.ts:231`؛ `grep` صفر نتیجه                               |
| GAP-17 | `pending` هم «پرداخت‌نشده» و هم «در انتظار تأیید» است                                                                            | `approval-gate.domain.ts:80`                                            |
| GAP-18 | «دریافت دسته» حرکت انبار و لایه‌ی بها نمی‌سازد؛ فقط برچسب                                                                        | `traceability.service.ts:138-171`                                       |
| GAP-19 | حضور و غیاب به حقوق وصل نیست                                                                                                     | CLAUDE.md؛ `payroll/attendance.service.ts`                              |
| GAP-20 | موجودی اول کالا سند دفتر ندارد                                                                                                   | CLAUDE.md «باز مانده»                                                   |
| GAP-21 | رزرو موجودی پیدا نشد                                                                                                             | grep                                                                    |
| GAP-22 | اعتبار فروشگاهی جدا از بازپرداخت (کیف اعتبار مشتری) پیدا نشد؛ بازپرداخت بسته‌ی اعتباری عمداً معوق                                | `invoice-return.service.ts:351`                                         |
| GAP-23 | سنجش تکرار `POST /workspaces` در onboarding کلید idempotency ندارد؛ با شبکه‌ی خراب و store خالی ممکن است workspace دوم ساخته شود | `onboarding-container.tsx:128-136`, `workspace.slice.ts:95-101` — محتمل |
| GAP-24 | پارامتر `?redirect=` بدون اعتبارسنجی به `router.push` می‌رود (خطر open redirect با نشانی مطلق)                                   | `auth-container.tsx:62,91,146` — محتمل، اجرا نشد                        |
| GAP-25 | endpoint حذف حساب کاربر پیدا نشد (فقط صفحه‌ی حقوقی)                                                                              | `/legal/data-deletion`                                                  |

## P3

| شناسه  | شکاف                                                                                                                | شاهد                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| GAP-26 | اعتبارسنجی رمز وب (فقط ≥۸) با سرور (بزرگ+کوچک+رقم) ناهم‌سان؛ کاربر ۴۰۰ کلی می‌بیند                                  | `auth-container.tsx:39` در برابر `auth.schema.ts:25-32` |
| GAP-27 | سوییچ ورود↔ثبت‌نام و لینک «فراموشی رمز» بدون پیشوند locale؛ زبان ممکن است عوض شود                                   | `auth-container.tsx:70,72`؛ `AuthShell.tsx:801`         |
| GAP-28 | گارد داشبورد به `/login` بدون `?redirect=` می‌فرستد؛ بعد از ورود به صفحه‌ی مقصد برنمی‌گردد                          | `dashboard-layout.tsx:213-216`                          |
| GAP-29 | دکمه‌ی «ورود نمایشی» نشست جعلی سمت کلاینت می‌سازد که سرور نمی‌پذیرد؛ احتمالاً با اولین 401 به صفحه‌ی ورود برمی‌گردد | `auth.slice.ts:296-316, 491-502` — محتمل                |
| GAP-30 | چک‌باکس پذیرش شرایط در فرم ثبت‌نام پیدا نشد                                                                         | `AuthShell.tsx`                                         |
| GAP-31 | لینک دمو یا دانلود اپ در لندینگ پیدا نشد                                                                            | `landing/*`, `site-footer-view.tsx`                     |

## مسدودکننده‌های محیطی این ممیزی

| مسدودکننده                                                                      | اثر                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| باینری `@embedded-postgres/windows-x64/native/bin/postgres.exe` روی دستگاه نیست | `invoice-return-05.pg.test.ts`, `workspace-access.pg.test.ts`: ۲ فایل شکست، ۲۵ تست skip — `BLOCKED_BY_ENVIRONMENT` |
| worktree بدون `node_modules`                                                    | تست‌ها از checkout اصلی (همان کامیت) اجرا شدند؛ Jest دسکتاپ/موبایل و E2E اجرا نشد                                  |
| نبود staging امن و حساب تست                                                     | هیچ HTTP واقعی، هیچ اسکرین‌شات، هیچ سنجش ارائه‌دهنده‌ی ایمیل                                                       |
| ممنوعیت دسترسی به دیتابیس زنده                                                  | وضعیت migration های منتظر = `UNKNOWN`                                                                              |

## جدول نهایی وضعیت

| گردش‌کار                                | پیاده‌سازی                                                                 | شاهد                                                      | سنجش                               | حلقه‌ی گم                        |
| --------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- | -------------------------------- |
| لندینگ → ثبت‌نام → onboarding → داشبورد | `PARTIALLY_IMPLEMENTED`                                                    | `auth.routes.ts:304`, `onboarding-container.tsx:103`      | `BLOCKED_BY_ENVIRONMENT`           | اتمیک‌بودن، تأیید ایمیل          |
| ورود/تمدید/خروج                         | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `auth.routes.ts:442,501,582`                              | `UNKNOWN` (زنده)                   | —                                |
| A. فروش نقدی                            | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `invoice.service.ts:1336-1378`, `payments.service.ts:670` | `PARTIALLY_VERIFIED`               | تراکنش واحد                      |
| B. فروش نسیه                            | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `/api/payments/*`                                         | `PARTIALLY_VERIFIED`               | وضعیت `partial` نوشته نمی‌شود    |
| C. خرید نسیه                            | `IMPLEMENTED_NOT_LIVE_VERIFIED` (فاکتور خرید) / PO `PARTIALLY_IMPLEMENTED` | `purchasing.service.ts:351`                               | `PARTIALLY_VERIFIED`               | UI سفارش خرید، GRN، دفترِ دریافت |
| D. مرجوعی مشتری                         | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `invoice-return.service.ts:391,542`                       | `PARTIALLY_VERIFIED`؛ pg `BLOCKED` | migration زنده                   |
| E. بستن صندوق                           | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `pos.service.ts:932,1006`                                 | `PARTIALLY_VERIFIED`               | تأیید مدیر                       |
| F. تولید                                | `PARTIALLY_IMPLEMENTED`                                                    | `manufacturing_complete`                                  | —                                  | WIP، سند دفتر، ضایعات            |
| G. کسب‌وکار خدماتی                      | `PARTIALLY_IMPLEMENTED`                                                    | `service-delivery-container.tsx`                          | —                                  | UI نوبت و پیش‌پرداخت             |
| هزینه                                   | `NOT_IMPLEMENTED`                                                          | —                                                         | —                                  | کل ماژول                         |
| حقوق                                    | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `human-resources.service.ts:764`                          | `PARTIALLY_VERIFIED`               | اتصال حضور                       |
| آفلاین/همگام‌سازی                       | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `offline-endpoint-matrix.ts`, `local-engine`              | `PARTIALLY_VERIFIED`               | سنجش روی دستگاه                  |
| Trial → اشتراک                          | `PARTIALLY_IMPLEMENTED`                                                    | `billing.service.ts:126,300`, `billing.routes.ts:150`     | `PARTIALLY_VERIFIED`               | درگاه، تنظیم ادمین               |
| ادمین                                   | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                            | `apps/admin/app/[lang]/(admin)/*`                         | —                                  | تنظیم Trial                      |
