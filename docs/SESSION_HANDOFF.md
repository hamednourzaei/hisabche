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
| باگ | فایل(ها) | Root Cause |
|---|---|---|
| Workspace member list بعد از دعوت/تغییر نقش فریز می‌شد | `workspace-container.tsx` | یک `useRef` بعد از اولین sync برای همیشه قفل می‌کرد |
| کلیک روی کارت پروژه هیچی نشون نمی‌داد / Kanban بعد رفرش ریست می‌شد | `projects/[id]/page.tsx` | Next.js 16: `params` یک Promise است؛ صفحه `await` نمی‌کرد، `id` همیشه `undefined` بود. **همین باگ در `human-resources/[id]/page.tsx` هم هست و هنوز فیکس نشده.** |
| لیست مشتریان موبایل گاهی کار نمی‌کرد | `customer-view.tsx` | `useIsMobile` از `useState(initializer)` به‌جای `useEffect` استفاده می‌کرد — cleanup هرگز صدا زده نمی‌شد |
| Switch (سویچ روشن/خاموش) در موبایل به دایره‌ی ثابت تبدیل می‌شد | `switch.tsx` (کامپوننت مشترک) + `settings-page.tsx` | کلاس Tailwind نامعتبر `inset-inline-start-*` (باید `start-*` باشد) — **باگ سیستمیک در کل Design System**؛ `settings-page.tsx` هم یک Switch تکراری با همین باگ داشت (حذف شد) |
| عکس‌های لندینگ (`dashboard-desktop.png`, `dashboard-mobile.png`) در production ۴۰۴ می‌دادند | `next.config.js`, `apps/web/package.json`, `apps/web/scripts/copy-standalone-assets.js` | `output:'standalone'` بود ولی Next.js ریشه‌ی workspace را غلط حدس می‌زد (لاک‌فایل اضافه در `C:\Users\hamed`) + `public/`/`.next/static/` هیچ‌وقت خودکار کپی نمی‌شوند (gotcha رسمی Next.js). با `outputFileTracingRoot`/`turbopack.root` + یک `postbuild` script فیکس و Verify شد (فایل واقعاً در مسیر standalone دیده شد). |
| Notification badge واقعاً realtime نبود (فقط بعد رفرش آپدیت می‌شد) | `packages/api/src/supabase/realtime.ts` | نام کانال فقط از نام جدول ساخته می‌شد؛ چون `useNotifications` و `useUnreadCount` همزمان روی جدول `notifications` subscribe می‌کنند، کانال‌هایشان تداخل می‌کرد — **این باگ روی هر صفحه‌ای با ≥۲ هوک روی یک جدول مشترک اثر دارد**، حالا هر subscription کانال یکتا می‌گیرد |
| کلیک روی نوتیفیکیشن جای درست نمی‌رفت | `notification-bell.tsx`'s `resolveEntityUrl` | فقط ۴ نوع entity پشتیبانی می‌شد؛ مسیرهای `customer`/`payment` اصلاً وجود نداشتند (۴۰۴ تضمینی). حالا همه‌ی entity type های واقعی (invoice, customer, product, payment, project, purchase_order, workflow, opportunity, employee) به مسیر درست می‌روند |
| CRM فقط Read-only بود | `crm-view.tsx` + `crm-container.tsx` | `useCreateInteraction` در barrel بود ولی هیچ UI برای ساخت تعامل جدید نبود — فرم inline اضافه شد |
| Landing page کند بود (Lighthouse فاجعه‌بار) | `landing-page.tsx` | تمام ۱۱ سکشن زیر fold با `dynamic(..., {ssr:true})` بدون `loading` بودند = هیچ code-splitting واقعی. حالا Hero eager، بقیه با `loading` skeleton |
| hreflang اشتباه | `apps/web/app/[lang]/layout.tsx` | `alternates.languages` به `/FA`/`/AF` (حروف بزرگ، مسیر ناموجود) اشاره می‌کرد؛ اصلاح به `/fa`/`/af` |

### ۵. Billing/Settings
- `/billing` route جدید ساخته شد (BillingContainer از قبل وجود داشت ولی هیچ route‌ای نداشت) — از Settings لینک می‌شود.

## صف اولویت فعلی (بازمحاسبه‌نشده از آخرین لحظه)

| # | مورد | وضعیت |
|---|---|---|
| 1 | **`human-resources/[id]/page.tsx`** — همان باگ async params که در projects فیکس شد، اینجا هنوز نه | آماده برای فیکس فوری (۱ فایل، کاملاً شناخته‌شده) |
| 2 | ادغام Activity → Notifications (کاربر می‌خواهد فعالیت‌های پروژه هم در نوتیفیکیشن باشد) | نیاز به Blueprint (احتمالاً >۲ فایل) |
| 3 | «دسته‌بندی/نام‌گذاری» Settings که کاربر گفته «افتضاح است» | نیاز به توضیح دقیق‌تر کاربر — کدام بخش دقیقاً |
| 4 | Multi-item Invoice | **Blueprint آماده است** (در گفتگو ثبت شده)، فقط اجرا مانده — بک‌اند/schema از قبل چندقلمی است، فقط UI `quick-invoice-page.tsx` تک‌قلمی است |
| 5 | Escalation/SLA/Delegation واقعی در Workflow | فیچر جدید، نه باگ |
| 6 | Lighthouse سایر صفحات (login, signup, warehouse, invoices, accounting) | هنوز بررسی نشده به‌جز لندینگ |
| 7 | نمایش کاربرپسند خطای ۴۰۳ در تأیید/رد Workflow | باگ کوچک شناخته‌شده |

## نکات معماری مهم که باید یادت بماند

- **سه مسیر auth موازی وجود دارد** (`packages/auth`, `packages/api/hooks/auth.ts`, `store/auth.slice.ts`) — فقط سومی واقعاً فعال است.
- **Offline/Sync واقعی نیست** — همه‌چیز local/mock بود؛ فقط Sync Center بخشی از آن (backup واقعی، sync fake) اصلاح شد.
- **دو سیستم locale ناهم‌خوان**: next-intl از `fa/af/en` استفاده می‌کند، بقیه‌ی کد قدیمی از `fa-IR/fa-AF/en` — مسیرهایی مثل `/fa-AF/...` همیشه ۴۰۴ می‌دهند.
- **Accounting و Invoices کاملاً مستقل‌اند** — ساخت فاکتور خودکار سند حسابداری نمی‌سازد.
- Redis گاهی از این محیط dev قابل‌دسترس نیست (هاست داخلی Render) — `cache.service.ts` یک fallback درون‌حافظه‌ای دارد که قبلاً اضافه شده.

## Build Commands مرجع
```bash
cd apps/web && npx tsc --noEmit          # static verify فرانت
cd backend && npx tsc --noEmit           # static verify بک‌اند
cd apps/web && npm run build              # build کامل فرانت (شامل postbuild کپی assets)
cd backend && npm run build               # build کامل بک‌اند
```
