# Hisabche — Session Handoff

> اگر این گفت‌وگو به لیمیت خورد، این فایل را در گفت‌وگوی جدید paste/reference کن تا دقیقاً از همین‌جا ادامه بدهم. تاریخ آخرین بروزرسانی: این پیام.

## قوانین فعال (Product Constitution — الزامی برای تمام iteration های بعدی)

1. **قبل از هر تغییر، Root Cause را با خواندن کد واقعی Verify کن — هرگز حدس نزن.** اگر گزارش قبلی اشتباه بود، بدون تعصب اصلاحش کن.
2. **حداکثر ۲ فایل در هر iteration** (مگر برای وایرینگ یک فیچر واحد که ذاتاً چند فایل کوچک دارد — مثل barrel export + page route).
3. **هیچ Feature Fake نساز.** اگر UI چیزی را ادعا می‌کند که پشتش واقعی نیست، یا واقعی‌اش کن یا صادقانه Downgrade/حذفش کن.
4. **هیچ Refactor بزرگ نه.** اگر کاری >۲ فایل نیاز دارد، فقط یک Blueprint کوتاه بده و منتظر بمان.
5. **Build کامل فقط هر ۱۰ iteration.** بین آن‌ها فقط `tsc --noEmit` (Static Verification).
6. **حداکثر ۵ جمله تحلیل قبل از کدنویسی** — تمرکز روی کد، نه مقاله.
7. زبان گفت‌وگو: فارسی. کد/کامنت/مسیر فایل/commit: انگلیسی.
8. بعد از هر ویرایش، Static Verify کن (`tsc --noEmit`)؛ Build کامل را فقط طبق قانون ۵ اجرا کن.

## کارهای انجام‌شده (خلاصه‌ی زمانی)

### ۱. ناوبری Intent-Driven (کامل)

- `apps/web/app/[lang]/(dashboard)/constants/nav-items.ts` بازطراحی کامل شد: ۶ آیتم اصلی (Today, Sell, Get Paid, Stock, Buy, Money) + گروه‌های ثانویه (People, Work, System).
- عنوان تمام صفحات dashboard با واژگان یکسان (task-language، نه entity-language) هماهنگ شد.
- i18n keys در هر سه لوکال (`fa-AF.json`, `fa-IR.json`, `en.json`) اضافه شد.

### ۲. Today Workspace

- `business-health-panel.tsx`: اکشن چهارم «خرید جنس» (Buy) اضافه شد.

### ۳. Workflow / Approval Engine (Coverage ~۴۰٪ — کامل نیست، ادعای «کامل شد» قبلاً اشتباه بود)

- `packages/api/src/hooks/use-workflow.ts`: کامل شد (useWorkflows, useWorkflow, useCreateWorkflow, useWorkflowInstances, useWorkflowInstanceDetail, useStartWorkflowInstance, usePerformWorkflowAction) + Realtime.
- `packages/ui/.../workflow/approvals-view.tsx` + `containers/approvals-container.tsx` + route `/approvals` — صفحه‌ی واقعی Inbox تأیید.
- **Permission Enforcement فیکس شد**: `backend/src/services/workflow.service.ts`'s `performAction` قبلاً هیچ‌جا چک نمی‌کرد که `userRole` با `approver_role` مرحله مطابقت دارد — الان owner/admin override + تطبیق دقیق enforce می‌شود؛ `workflow.routes.ts` هم برای نمایش صحیح ۴۰۳ اصلاح شد.
- `packages/ui/.../workflow/workflow-templates-view.tsx` + `containers/workflow-templates-container.tsx` + route `/workflow-templates` (لینک از Settings) — بدون این، Automation موجود در `invoice.service.ts` (که خودکار `startWorkflow` می‌زد) عملاً هرگز اجرا نمی‌شد چون هیچ ادمینی نمی‌توانست template بسازد.
- **هنوز ناقص (Missing):** Escalation, SLA/Timeout, Delegation واقعی (فقط enum "forwarded" وجود دارد، منطقش پیاده نشده), Analytics, یکپارچگی Audit Trail با صفحه‌ی History, نمایش کاربرپسند خطای ۴۰۳ در فرانت.

### ۴. باگ‌های واقعی پیدا و رفع‌شده

| باگ                                                                                                                        | فایل(ها)                                                                                                                                                                       | Root Cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace member list بعد از دعوت/تغییر نقش فریز می‌شد                                                                     | `workspace-container.tsx`                                                                                                                                                      | یک `useRef` بعد از اولین sync برای همیشه قفل می‌کرد                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| کلیک روی کارت پروژه هیچی نشون نمی‌داد / Kanban بعد رفرش ریست می‌شد                                                         | `projects/[id]/page.tsx`                                                                                                                                                       | Next.js 16: `params` یک Promise است؛ صفحه `await` نمی‌کرد، `id` همیشه `undefined` بود. **همین باگ در `human-resources/[id]/page.tsx` هم هست و هنوز فیکس نشده.**                                                                                                                                                                                                                                                                                                                                                                              |
| لیست مشتریان موبایل گاهی کار نمی‌کرد                                                                                       | `customer-view.tsx`                                                                                                                                                            | `useIsMobile` از `useState(initializer)` به‌جای `useEffect` استفاده می‌کرد — cleanup هرگز صدا زده نمی‌شد                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Switch (سویچ روشن/خاموش) در موبایل به دایره‌ی ثابت تبدیل می‌شد                                                             | `switch.tsx` (کامپوننت مشترک) + `settings-page.tsx`                                                                                                                            | کلاس Tailwind نامعتبر `inset-inline-start-*` (باید `start-*` باشد) — **باگ سیستمیک در کل Design System**؛ `settings-page.tsx` هم یک Switch تکراری با همین باگ داشت (حذف شد)                                                                                                                                                                                                                                                                                                                                                                  |
| عکس‌های لندینگ (`dashboard-desktop.png`, `dashboard-mobile.png`) در production ۴۰۴ می‌دادند                                | `next.config.js`, `apps/web/package.json`, `apps/web/scripts/copy-standalone-assets.js`                                                                                        | `output:'standalone'` بود ولی Next.js ریشه‌ی workspace را غلط حدس می‌زد (لاک‌فایل اضافه در `C:\Users\hamed`) + `public/`/`.next/static/` هیچ‌وقت خودکار کپی نمی‌شوند (gotcha رسمی Next.js). با `outputFileTracingRoot`/`turbopack.root` + یک `postbuild` script فیکس و Verify شد (فایل واقعاً در مسیر standalone دیده شد).                                                                                                                                                                                                                   |
| Notification badge واقعاً realtime نبود (فقط بعد رفرش آپدیت می‌شد)                                                         | `packages/api/src/supabase/realtime.ts`                                                                                                                                        | نام کانال فقط از نام جدول ساخته می‌شد؛ چون `useNotifications` و `useUnreadCount` همزمان روی جدول `notifications` subscribe می‌کنند، کانال‌هایشان تداخل می‌کرد — **این باگ روی هر صفحه‌ای با ≥۲ هوک روی یک جدول مشترک اثر دارد**، حالا هر subscription کانال یکتا می‌گیرد                                                                                                                                                                                                                                                                     |
| کلیک روی نوتیفیکیشن جای درست نمی‌رفت                                                                                       | `notification-bell.tsx`'s `resolveEntityUrl`                                                                                                                                   | فقط ۴ نوع entity پشتیبانی می‌شد؛ مسیرهای `customer`/`payment` اصلاً وجود نداشتند (۴۰۴ تضمینی). حالا همه‌ی entity type های واقعی (invoice, customer, product, payment, project, purchase_order, workflow, opportunity, employee) به مسیر درست می‌روند                                                                                                                                                                                                                                                                                         |
| CRM فقط Read-only بود                                                                                                      | `crm-view.tsx` + `crm-container.tsx`                                                                                                                                           | `useCreateInteraction` در barrel بود ولی هیچ UI برای ساخت تعامل جدید نبود — فرم inline اضافه شد                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Landing page کند بود (Lighthouse فاجعه‌بار)                                                                                | `landing-page.tsx`                                                                                                                                                             | تمام ۱۱ سکشن زیر fold با `dynamic(..., {ssr:true})` بدون `loading` بودند = هیچ code-splitting واقعی. حالا Hero eager، بقیه با `loading` skeleton                                                                                                                                                                                                                                                                                                                                                                                             |
| کلیک روی آیتم sidebar/bottom-bar هایلایت را اشتباه نشون می‌داد و مشخص نبود کدوم صفحه فعاله (مخصوص کاربران locale `af`/دری) | `packages/ui/src/components/ui/dashboard-sidebar.tsx` (`isPathActive`), `apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx` (`handleNavigate` و command-palette `onSelect`) | `isPathActive` پیشوندهای locale قدیمی `fa-IR`/`fa-AF` را strip می‌کرد، نه کدهای واقعی routing `fa`/`af`/`en`؛ در نتیجه پیشوند `af` هیچ‌وقت از مسیر جاری حذف نمی‌شد و با مسیر آیتم match نمی‌کرد. هم‌زمان `handleNavigate` مسیرهای بدون پیشوند locale را مستقیم push می‌کرد و کاربر را بی‌صدا به locale پیش‌فرض (`fa`) برمی‌گرداند. فیکس: یک هلپر مشترک `withLocale` که با `localePrefix: 'as-needed'` سازگاره (`fa` بدون پیشوند، `af`/`en` با پیشوند) اضافه شد و در هر دو فایل استفاده می‌شود؛ با `npx tsc --noEmit` در `apps/web` Verify شد |
| hreflang اشتباه                                                                                                            | `apps/web/app/[lang]/layout.tsx`                                                                                                                                               | `alternates.languages` به `/FA`/`/AF` (حروف بزرگ، مسیر ناموجود) اشاره می‌کرد؛ اصلاح به `/fa`/`/af`                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### ۵. Billing/Settings

- `/billing` route جدید ساخته شد (BillingContainer از قبل وجود داشت ولی هیچ route‌ای نداشت) — از Settings لینک می‌شود.

### ۶. ماژول‌های گمشده + Fix Build (کامل — Build/TS/ESLint سبز)

- **Sales Follow-up module** (جدید): `packages/ui/src/components/ui/sales-followup/` (sales-followup-view.tsx + containers/sales-followup-container.tsx) + `packages/api/src/hooks/sales-followup.ts` (useSalesFollowups/useCreateFollowup/useUpdateFollowup/useDeleteFollowup) + route `/sales-followup`. شامل: status pipeline (new/contacted/meeting_scheduled/won/lost/pending)، next action date، assigned employee، reminder، فیلترها.
- **Team & Payroll module** (جدید): `packages/ui/src/components/ui/team-and-payroll/` (team-and-payroll-view.tsx + containers/team-and-payroll-container.tsx) + route `/team-and-payroll`. شامل: employee list، roles، salary، payroll status (paid/pending/processing/overdue)، history، KPI cards.
- **Approvals fix**: `packages/ui/src/components/ui/approvals/containers/approvals-container.tsx` (re-export از workflow با مسیر نسبی درست `../../workflow/...`) + `apps/web/app/[lang]/(dashboard)/approvals/page.tsx` (metadata کامل + Suspense).
- **VPS_MIGRATION.md** (جدید): docs کامل migration — server requirements، env vars، DB migration، build/deploy/rollback.
- **Build Fix**: `packages/ui/src/index.ts` بازنویسی شد (قبلاً کل محتوا دوبار کپی شده بود → ۱۴۷ خطای duplicate export). `packages/api/src/index.ts` sales-followup hooks اضافه شد. `apps/web/proxy.ts` تایپ میان‌افزار درست شد (NextRequest/NextResponse صریح، `as unknown as` برای نسخه‌ی تکراری next در pnpm). `apps/web/i18n/request.ts` و `nav-items.ts` و `next.config.js` — unused import/require lint فیکس شد.
- **نتیجه**: `next build` ✅ بدون خطا، `tsc --noEmit` (apps/web) ✅ بدون خطا، `eslint .` ✅ بدون خطا. Route ها در build ثبت شدند: `/sales-followup`، `/team-and-payroll`، `/approvals`.
- **به‌روزرسانی (Phase 2 / Stage 7)**: این rename انجام شد. مسیر از `team&page` به `team-and-payroll` تغییر کرد. دلیل: کاراکتر `&` در path segment یک خطر واقعی است (در بعضی parserها path را خاتمه می‌دهد و در context کوئری باید percent-encode شود)، و grep در کل سورس **صفر** ارجاع ورودی نشان داد — تمام hitها فقط در خروجی build داخل `.next/` بودند. حالا مسیر با همان base path‌ای که `team-and-payroll-container` به آن `router.push` می‌کند یکی است.
- **باقی‌مانده (deferred)**: دو مسیر فرزند `/team-and-payroll/employee/[id]` و `/team-and-payroll/payroll/[id]` که container به آن‌ها لینک می‌دهد هنوز وجود ندارند — این لینک‌ها از قبل شکسته بودند و ساختنشان یک تصمیم محصولی است، نه بخشی از مهاجرت معماری. همچنین آیتم `team` در nav به `/human-resources` اشاره می‌کند نه به این مسیر.

### ۷. Warehouse UI Refactor (Mobile Parity با Invoices — کامل)

- `packages/ui/src/components/ui/warehouse/warehouse-view.tsx`: کارت‌های خلاصه‌ی `/af/warehouse` زیر `<768px` حالا **همان `BentoStats` مشترک `/af/invoices`** را رندر می‌کنند (گرید نامتقارن ۲×۲، padding، تایپوگرافی، آیکون‌ها، shadow — پیکسل‌به‌پیکسل یکسان). دسکتاپ (≥md) تغییری نکرد — همان `WarehouseStats` قبلی با threshold picker.
- پیاده‌سازی: `BentoStats` (کامپوننت موجود) روی `<md` + `WarehouseStats` روی `≥md` با دو div مخفی (`md:hidden` / `hidden md:block`). هیچ JSX/Tailwind تکراری ساخته نشد — دقیقاً همان کامپوننت invoices.
- مقادیر کارت‌ها: totalValue / total / lowStockCount (threshold پیش‌فرض ۵، داخل view محاسبه می‌شود) / outOfStock. منطق بیزینس و API تغییر نکرد.
- Verify: `tsc --noEmit` ✅، `next build` ✅، `eslint .` ✅. (نکته: قبل از tsc باید `.next/dev` پاک شود — استایل‌های stale بین dev/prod build تداخل نوع می‌سازند.)

## صف اولویت فعلی (بازمحاسبه‌نشده از آخرین لحظه)

| #   | مورد                                                                                   | وضعیت                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~`human-resources/[id]/page.tsx` async params~~                                       | **غلط بود** — کد را دوباره خواندم؛ از قبل `await params` می‌کند و `id` را درست پاس می‌دهد. رفع نیازی نداشت.                                                                             |
| 2   | ادغام Activity → Notifications (کاربر می‌خواهد فعالیت‌های پروژه هم در نوتیفیکیشن باشد) | نیاز به Blueprint (احتمالاً >۲ فایل)                                                                                                                                                    |
| 3   | «دسته‌بندی/نام‌گذاری» Settings که کاربر گفته «افتضاح است»                              | نیاز به توضیح دقیق‌تر کاربر — کدام بخش دقیقاً                                                                                                                                           |
| 4   | Multi-item Invoice                                                                     | **Blueprint آماده است** (در گفتگو ثبت شده)، فقط اجرا مانده — بک‌اند/schema از قبل چندقلمی است، فقط UI `quick-invoice-page.tsx` تک‌قلمی است                                              |
| 5   | Escalation/SLA/Delegation واقعی در Workflow                                            | فیچر جدید، نه باگ                                                                                                                                                                       |
| 6   | Lighthouse سایر صفحات (login, signup, warehouse, invoices, accounting)                 | هنوز بررسی نشده به‌جز لندینگ                                                                                                                                                            |
| 7   | ~~نمایش کاربرپسند خطای ۴۰۳ در تأیید/رد Workflow~~                                      | **فیکس شد** — `approvals-container.tsx`: `handleAction` قبلاً catch نداشت (خطا کاملاً بی‌صدا می‌شد)؛ حالا با `useToast` پیام خطا (۴۰۳ = پیام اختصاصی «اجازه ندارید») نمایش داده می‌شود. |

## نکات معماری مهم که باید یادت بماند

- **سه مسیر auth موازی وجود دارد** (`packages/auth`, `packages/api/hooks/auth.ts`, `store/auth.slice.ts`) — فقط سومی واقعاً فعال است.
- **Offline/Sync واقعی نیست** — همه‌چیز local/mock بود؛ فقط Sync Center بخشی از آن (backup واقعی، sync fake) اصلاح شد.
- ~~دو سیستم locale ناهم‌خوان~~ **حل شد** — کل `apps/web`+`packages/ui` از react-i18next به next-intl مهاجرت کامل شد (`fa`/`af`/`en`)؛ `packages/i18n` (react-i18next) فقط برای `apps/mobile` باقی مانده چون next-intl در React Native کار نمی‌کند.
- **Accounting و Invoices کاملاً مستقل‌اند** — ساخت فاکتور خودکار سند حسابداری نمی‌سازد.
- Redis گاهی از این محیط dev قابل‌دسترس نیست (هاست داخلی Render) — `cache.service.ts` یک fallback درون‌حافظه‌ای دارد که قبلاً اضافه شده.

## Mobile Parity Gap (Verify شده — نه از حافظه)

اگر قرار است `apps/mobile` طبق وب کامل شود، این‌ها را از همین الان بدان تا دوباره کدبیس را نخوانی:

### وضعیت فعلی موبایل

- فقط **۱۰ فایل صفحه** در `apps/mobile/screens/`: LoginScreen, OnboardingScreen, CustomersScreen, InvoicesScreen, InvoiceDetailScreen, QuickInvoiceScreen, ProductDetailScreen, SettingsScreen, SyncCenterScreen, WarehouseScreen.
- **هیچ react-navigation یا کتابخانه‌ی ناوبری واقعی نصب نیست.** `App.tsx` یک `type Screen = 'dashboard' | 'warehouse' | 'invoices' | 'customers' | 'settings' | 'invoiceDetail' | 'productDetail'` دستی دارد و با `useState<Screen>('dashboard')` + یک `global.navigation` شیم سوییچ می‌کند — یعنی حتی onboarding/sync-center/quick-invoice هم در همین union اصلی نیستند (جدا هندل می‌شوند).
- پکیج‌های مشترک (`@hisabche/api`, `@hisabche/store`, `@hisabche/ui`, `@hisabche/i18n`, `@hisabche/validation`) به‌عنوان dependency وصل‌اند، پس هوک‌های TanStack Query و Zustand store ها (از جمله همه‌ی فیکس‌های امروز مثل realtime channel یکتا) **خودکار روی موبایل هم اثر می‌گذارند** — نیازی به تکرار آن فیکس‌ها نیست.
- **`@nozbe/watermelondb` اصلاً به `package.json` موبایل اضافه نشده** — یعنی حتی اگر بعداً offline واقعی برای وب ساخته شود، مسیر موبایلش از پیش‌شرط dependency خالی است.

### ماژول‌هایی که کلاً روی موبایل غایب‌اند (باید از صفر ساخته شوند)

Accounting, CRM, Manufacturing, Purchasing, Human Resources, Projects/Kanban, Workflow/Approvals, Billing, Permissions, Audit, Activities/Notifications — یعنی تقریباً هر چیزی که امروز روی وب ساختیم یا فیکس کردیم (Approvals, Workflow Templates, Billing route) روی موبایل اصلاً وجود ندارد.

### پیشنهاد ترتیب کار (اگر خواستی شروع کنی)

1. اول یک navigator واقعی نصب کن (`@react-navigation/native` + stack/tab) — بدون این، اضافه کردن ۱۰+ صفحه‌ی جدید به همان الگوی `useState<Screen>` دستی غیرقابل‌نگهداری می‌شود؛ این خودش طبق قانون «Refactor بزرگ» باید اول Blueprint بگیرد.
2. بعد صفحات را به‌ترتیب همان اولویت نویگیشن وب اضافه کن (Today, Sell, Get Paid, Stock, Buy, Money) — چون هوک‌ها و منطق business logic از قبل در `@hisabche/api`/`@hisabche/store` مشترک و آماده‌اند، فقط UI موبایل لازم است، نه منطق جدید.
3. برای هرکدام همان قانون «حداکثر ۲ فایل هر iteration» را رعایت کن.

## Build Commands مرجع

```bash
cd apps/web && npx tsc --noEmit          # static verify فرانت
cd backend && npx tsc --noEmit           # static verify بک‌اند
cd apps/web && npm run build              # build کامل فرانت (شامل postbuild کپی assets)
cd backend && npm run build               # build کامل بک‌اند
```
