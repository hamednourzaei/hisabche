# برنامه اجرایی فاز ۷ آفلاین (P7-0 Plan) — «این کار اینترنت می‌خواهد»

> **وضعیت سند:** تدوین برنامه (Step P7-0 — بدون تغییر در کدهای محصول)  
> **مرجع قابلیت‌ها:** `docs/offline/01-CAPABILITY-MATRIX.md`  
> **مرجع کلیدهای انحصاری:** `packages/validation/src/schemas/feature-registry.ts` (مطابق با `docs/offline/entitlement/00-CONTRACT.md` §14.2)  
> **پلتفرم‌های هدف:** وب (Next.js App Router)، ویندوز (Electron + App-Shell) و اندروید (Expo WebView + App-Shell)

---

## ۱. معماری سه‌گانه و پیوند تریگرها (Web, Windows, Android)

در حسابچه، رابط کاربری بر پایه اصل **«One UI, One Contract, Two Hosts»** بنا شده است:

1. **هسته مشترک رابط کاربری (`packages/ui`):** تمام کامپوننت‌ها، کانتینرها، دکمه‌ها (`Button`, `ActionButton`) و تریگرهای عملیاتی در `@hisabche/ui` پیاده‌سازی شده‌اند.
2. **نسخه وب (`apps/web`):** بر پایه Next.js 15 App Router با ساختار `apps/web/app/[lang]/(dashboard)/.../page.tsx` که صرفاً کانتینرهای `@hisabche/ui` را رندر می‌کند.
3. **نسخه ویندوز دسکتاپ (`apps/desktop`):** هسته Electron که پکیج شل (`packages/app-shell`) را بارگذاری می‌کند. روتر آن در `packages/app-shell/src/app/app.tsx` صفحات را به کانتینرهای `@hisabche/ui/screens` متصل می‌سازد.
4. **نسخه اندروید موبایل (`apps/mobile`):** هاست نیتیو Expo که دارای یک وب‌ویو اختصاصی آفلاین (`apps/mobile/src/host/shell-webview.tsx`) است و باندل بیلد شده پکیج `@hisabche/app-shell` را مستقیماً از حافظه داخلی بسته نصبی (`file:///android_asset/shell/index.html`) می‌خواند.

**نتیجه معماری:**  
هر دکمه و تریگر عملیاتی که در `@hisabche/ui` گاردگذاری شود، به‌طور خودکار و دقیقاً در هر سه پلتفرم (وب، ویندوز و اندروید) رفتار یکسان و هماهنگ خواهد داشت.

---

## ۲. جدول جامع نگاشت ردیف‌های کلاس C ماتریس به کلیدهای رسمی رجیستری

| #   | ردیف قابلیت در ماتریس              | بخش ماتریس          | کلید رسمی در رجیستری (`feature-registry.ts`) | نوع اجرا (`execution`) | پلن‌های مجاز       |
| --- | ---------------------------------- | ------------------- | -------------------------------------------- | ---------------------- | ------------------ |
| ۱   | AI insight card                    | §4.1 Dashboard      | `dashboard.ai_insight`                       | `server`               | `FREE`, `ONLINE_*` |
| ۲   | Manufacturing card                 | §4.1 Dashboard      | `dashboard.manufacturing_card`               | `server`               | `FREE`, `ONLINE_*` |
| ۳   | Recurring invoice                  | §4.2 Invoices       | `invoice.recurring`                          | `server`               | `FREE`, `ONLINE_*` |
| ۴   | Approval on an invoice             | §4.2 Invoices       | `invoice.approval`                           | `server`               | `FREE`, `ONLINE_*` |
| ۵   | Manufacture from product / Produce | §4.3 & §4.7         | `manufacturing.produce`                      | `server`               | `FREE`, `ONLINE_*` |
| ۶   | Customer documents                 | §4.4 Customers      | `customer.documents`                         | `server`               | `FREE`, `ONLINE_*` |
| ۷   | Customer portal link               | §4.4 Customers      | `customer.portal_link`                       | `server`               | `FREE`, `ONLINE_*` |
| ۸   | Period lock                        | §4.5 Accounting     | `accounting.period_lock`                     | `server`               | `FREE`, `ONLINE_*` |
| ۹   | BOM list                           | §4.7 Manufacturing  | `manufacturing.bom`                          | `server`               | `FREE`, `ONLINE_*` |
| ۱۰  | Production definition              | §4.7 Manufacturing  | `manufacturing.definition`                   | `server`               | `FREE`, `ONLINE_*` |
| ۱۱  | Production runs                    | §4.7 Manufacturing  | `manufacturing.runs`                         | `server`               | `FREE`, `ONLINE_*` |
| ۱۲  | Work orders                        | §4.7 Manufacturing  | `manufacturing.work_orders`                  | `server`               | `FREE`, `ONLINE_*` |
| ۱۳  | Manufacturing report               | §4.7 Manufacturing  | `manufacturing.report`                       | `server`               | `FREE`, `ONLINE_*` |
| ۱۴  | Permission matrix                  | §4.9 Team & Payroll | `governance.permission_matrix`               | `server`               | `FREE`, `ONLINE_*` |
| ۱۵  | Attendance devices                 | §4.9 Team & Payroll | `hr.attendance_devices`                      | `server`               | `FREE`, `ONLINE_*` |
| ۱۶  | Attendance links                   | §4.9 Team & Payroll | `hr.attendance_links`                        | `server`               | `FREE`, `ONLINE_*` |
| ۱۷  | Member management                  | §4.9 Team & Payroll | `team.members`                               | `server`               | `FREE`, `ONLINE_*` |
| ۱۸  | Business stamp upload              | §4.10 Settings      | `settings.business_stamp`                    | `server`               | `FREE`, `ONLINE_*` |
| ۱۹  | Sync push / pull                   | §4.10 Sync          | `sync.push_pull`                             | `server`               | `FREE`, `ONLINE_*` |
| ۲۰  | Sync overview                      | §4.10 Sync          | `sync.overview`                              | `server`               | `FREE`, `ONLINE_*` |
| ۲۱  | Sync conflicts resolution          | §4.10 Sync          | `sync.conflicts`                             | `server`               | `FREE`, `ONLINE_*` |
| ۲۲  | Approvals / workflows              | §4.10 Approvals     | `approvals.workflows`                        | `server`               | `FREE`, `ONLINE_*` |
| ۲۳  | Peer benchmark                     | §4.10 Analysis      | `analysis.benchmark`                         | `server`               | `FREE`, `ONLINE_*` |
| ۲۴  | AI assistant chat                  | §4.11 C-by-nature   | `ai.assistant`                               | `server`               | `FREE`, `ONLINE_*` |
| ۲۵  | AI cashflow forecast               | §14.2 & §14.3       | `ai.cashflow_forecast`                       | `server`               | `FREE`, `ONLINE_*` |
| ۲۶  | Receipt OCR scan                   | §14.2 & Contract    | `ocr.receipt`                                | `server`               | `FREE`, `ONLINE_*` |
| ۲۷  | Bank statement import              | §14.2 & Accounting  | `bank.import`                                | `server`               | `FREE`, `ONLINE_*` |
| ۲۸  | Developer API keys / webhooks      | §4.11 Developers    | `developer.keys`                             | `server`               | `FREE`, `ONLINE_*` |
| ۲۹  | Marketplace apps                   | §4.11 Marketplace   | `marketplace.apps`                           | `server`               | `FREE`, `ONLINE_*` |
| ۳۰  | Public storefront                  | §4.11 Market Seller | `storefront.public`                          | `server`               | `FREE`, `ONLINE_*` |
| ۳۱  | Billing portal                     | §4.11 Billing       | `billing.portal`                             | `server`               | `FREE`, `ONLINE_*` |

### قابلیت‌های ترکیبی (Hybrid Features با بخش سروری نیازمند اینترنت)

| #   | قابلیت ترکیبی  | بخش محلی (آفلاین)            | بخش سروری (نیازمند اینترنت)   | کلید رجیستری               |
| --- | -------------- | ---------------------------- | ----------------------------- | -------------------------- |
| ۳۲  | Data backup    | پشتیبان‌گیری محلی روی دستگاه | تصویر ابری (`cloud snapshot`) | `data.backup`              |
| ۳۳  | Data migration | ورود اطلاعات محلی روی دستگاه | انتقال ابری سرور              | `data.migration`           |
| ۳۴  | Work queue     | صف کاری دستگاه محلی          | تاییدهای گردش کار دیگران      | `dashboard.work_queue`     |
| ۳۵  | Product images | فایل تصویر روی دستگاه        | ذخیره‌سازی شیء ابری           | `product.images`           |
| ۳۶  | Costing method | خواندن روش بهای تمام‌شده     | تغییر روش بهای تمام‌شده       | `inventory.costing_method` |

---

## ۳. مکان دقیق دکمه‌ها و تریگرهای عملیاتی (`file:line`) در پلتفرم‌ها

### ۱. `dashboard.ai_insight` (کارت هوش مصنوعی داشبورد)

- **Shared UI Component:** `packages/ui/src/components/ui/dashboard/dashboard-view.tsx:729` (`<AIInsightsPanel />`) و `packages/ui/src/hooks/dashboard/use-dashboard-data.ts:54` (`useAIInsights`)
- **Action Trigger:** `packages/ui/src/components/ui/dashboard/dashboard-view.tsx:231` (دکمه اکشن روی پیشنهاد هوشمند)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/dashboard/dashboard-page.tsx:8` (مسیر `/`)

### ۲. `dashboard.manufacturing_card` (کارت تولید در داشبورد)

- **Shared UI Component:** `packages/ui/src/components/ui/manufacturing/manufacturing-dashboard-card.tsx:26`
- **Action Trigger:** `packages/ui/src/components/ui/manufacturing/manufacturing-dashboard-card.tsx:40` (`useManufacturingReport({ from, to })`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/dashboard/dashboard-page.tsx:8`

### ۳. `invoice.recurring` (صورت‌حساب تکرارشونده)

- **Shared UI Component:** `packages/ui/src/components/ui/invoice-builder/containers/invoice-preview-container.tsx:67`
- **Action Trigger:** `packages/ui/src/components/ui/invoice-builder/containers/invoice-preview-container.tsx:321` (دکمه ثبت فاکتور دوره‌ای `createRecurring.mutateAsync(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/invoices/new/preview/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/app/app.tsx:107` (مسیر `invoices/new/preview`)

### ۴. `invoice.approval` (گردش کار و تایید صورت‌حساب)

- **Shared UI Component:** `packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx:183`
- **Action Trigger:** `packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx:410` (دکمه‌های اقدام گردش کار `performWorkflowAction({ action, ... })`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/invoices/[id]/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/sales/invoice-detail-page.tsx:8` (مسیر `invoices/:id`)

### ۵. `manufacturing.produce` (عملیات ثبت تولید)

- **Shared UI Component:** `packages/ui/src/components/ui/manufacturing/production-editor.tsx:133`
- **Action Trigger:** `packages/ui/src/components/ui/manufacturing/production-editor.tsx:302` (دکمه ثبت فرم تولید `produce.mutate(input, ...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/manufacturing/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/manufacturing/manufacturing-page.tsx:1` (مسیر `manufacturing` و تب تولید در `warehouse/:id`)

### ۶. `customer.documents` (آپلود و دریافت مدارک مشتری)

- **Shared UI Component:** `packages/ui/src/components/ui/customers/customer-profile-panel.tsx:68`
- **Action Trigger:** `packages/ui/src/components/ui/customers/customer-profile-panel.tsx:137` (دکمه ارسال سند مشتری `upload.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/customers/[id]/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/crm/customer-detail-page.tsx:8` (مسیر `customers/:id`)

### ۷. `customer.portal_link` (تولید لینک پرتال اختصاصی مشتری)

- **Shared UI Component:** `packages/ui/src/components/ui/customers/customer-portal-panel.tsx:41`
- **Action Trigger:** `packages/ui/src/components/ui/customers/customer-portal-panel.tsx:129` (دکمه ایجاد لینک دسترسی `create.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/customers/[id]/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/crm/customer-detail-page.tsx:8` (مسیر `customers/:id`)

### ۸. `accounting.period_lock` (قفل دوره مالی)

- **Backend Route:** `backend/src/routes/accounting.routes.ts:334` (`PUT /period-lock`)
- **Action Trigger:** اکشن سروری نیازمند اینترنت جهت بستن دسترسی ثبت سند در دوره مشخص.
- **Web Route:** `apps/web/app/[lang]/(dashboard)/accounting/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/accounting/accounting-page.tsx:8` (مسیر `accounting`)

### ۹. `manufacturing.bom` (ایجاد و ویرایش فرمول ساخت / BOM)

- **Shared UI Component:** `packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx:57`
- **Action Trigger:** `packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx:96` (دکمه تعریف فرمول جدید `handleNewBOM`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/manufacturing/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/manufacturing/manufacturing-page.tsx:1` (مسیر `manufacturing`)

### ۱۰. `manufacturing.definition` (تعریف ساختار تولید کالا)

- **Shared UI Component:** `packages/ui/src/components/ui/manufacturing/product-manufacturing-panel.tsx:43`
- **Action Trigger:** `packages/ui/src/components/ui/manufacturing/production-editor.tsx:132` (دکمه ذخیره تعریف تولید `saveDefinition.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/warehouse/[id]/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/inventory/product-detail-page.tsx:8` (مسیر `warehouse/:id`)

### ۱۱. `manufacturing.runs` (سوابق و تاریخچه دوره‌های تولید)

- **Shared UI Component:** `packages/ui/src/components/ui/manufacturing/production-history.tsx:40`
- **Action Trigger:** رندر لیست ران‌های تولید مبتنی بر گزارش سروری در تب سوابق.
- **Web Route:** `apps/web/app/[lang]/(dashboard)/manufacturing/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/manufacturing/manufacturing-page.tsx:1`

### ۱۲. `manufacturing.work_orders` (سفارش‌های کار تولید)

- **Shared UI Component:** `packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx:68`
- **Action Trigger:** `packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx:100` (دکمه ایجاد سفارش کار جدید `createWorkOrder(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/manufacturing/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/manufacturing/manufacturing-page.tsx:1`

### ۱۳. `manufacturing.report` (گزارش جامع تولید و مواد مصرفی)

- **Shared UI Component:** `packages/ui/src/components/ui/manufacturing/manufacturing-report.tsx:65`
- **Action Trigger:** `packages/ui/src/components/ui/manufacturing/manufacturing-report.tsx:66` (فراخوانی گزارش تجمعی `useManufacturingReport`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/manufacturing/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/manufacturing/manufacturing-page.tsx:1`

### ۱۴. `governance.permission_matrix` (ماتریس دسترسی‌ها و نقش‌ها)

- **Shared UI Component:** `packages/ui/src/components/ui/permissions/containers/permissions-container.tsx:95`
- **Action Trigger:** `packages/ui/src/components/ui/permissions/containers/permissions-container.tsx:120` (تغییر دسترسی در ماتریس `setCell.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/governance/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/permissions/governance-page.tsx:1` (مسیر `governance`)

### ۱۵. `hr.attendance_devices` (ثبت و مدیریت دستگاه‌های حضور و غیاب)

- **Shared UI Component:** `packages/ui/src/components/ui/team-and-payroll/attendance-devices.tsx:108`
- **Action Trigger:** `packages/ui/src/components/ui/team-and-payroll/attendance-devices.tsx:170` (دکمه ثبت دستگاه جدید `registerDevice.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/team-and-payroll/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/team-and-payroll/tap-page.tsx:8` (مسیر `team-and-payroll`)

### ۱۶. `hr.attendance_links` (ایجاد و ابطال لینک‌های حضور و غیاب پرسنل)

- **Shared UI Component:** `packages/ui/src/components/ui/team-and-payroll/attendance-link-dialog.tsx:79`
- **Action Trigger:** `packages/ui/src/components/ui/team-and-payroll/attendance-link-dialog.tsx:80` (دکمه تولید لینک تردد `create.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/team-and-payroll/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/team-and-payroll/tap-page.tsx:8`

### ۱۷. `team.members` (مدیریت اعضای تیم و دعوت کاربر جدید)

- **Shared UI Component:** `packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx:234`
- **Action Trigger:** `packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx:303` (دکمه افزودن مستقیم کاربر `createMemberDirect.mutateAsync(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/team-and-payroll/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/team-and-payroll/tap-page.tsx:8`

### ۱۸. `settings.business_stamp` (بارگذاری مهر دیجیتال کسب‌وکار)

- **Shared UI Component:** `packages/ui/src/components/ui/settings/settings-page.tsx:494` (`BusinessStampSection`)
- **Action Trigger:** `packages/ui/src/components/ui/settings/settings-page.tsx:516` (دکمه بارگذاری تصویر مهر `upload.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/settings/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/settings/settings-page.tsx:72` (مسیر `settings`)

### ۱۹. `sync.push_pull` (عملیات همگام‌سازی ابری Push/Pull)

- **Shared UI Component:** `packages/app-shell/src/features/sync/sync-page.tsx:10`
- **Action Trigger:** `packages/app-shell/src/features/sync/sync-page.tsx:119` (دکمه همگام‌سازی ابری `onClick={() => void sync()}`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/sync-center/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/sync/sync-page.tsx` (مسیر `sync-center`)

### ۲۰. `sync.overview` (گزارش وضعیت و سوابق سینک ابری)

- **Shared UI Component:** `packages/ui/src/components/ui/data-and-sync/containers/data-and-sync-container.tsx:51`
- **Action Trigger:** فراخوانی وضعیت سرور و سوابق از طریق `useSyncOverview()` در تب سینک
- **Web Route:** `apps/web/app/[lang]/(dashboard)/data-and-sync/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/sync/data-and-sync-page.tsx:8` (مسیر `data-and-sync`)

### ۲۱. `sync.conflicts` (بررسی و حل تعارض‌های همگام‌سازی ابری)

- **Shared UI Component:** `packages/ui/src/components/ui/conflicts/containers/conflicts-container.tsx:37`
- **Action Trigger:** `packages/ui/src/components/ui/conflicts/containers/conflicts-container.tsx:85` (دکمه حل تعارض با سرور)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/data-and-sync/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/sync/data-and-sync-page.tsx:8`

### ۲۲. `approvals.workflows` (هاب تاییدها و گردش کارها)

- **Shared UI Component:** `packages/ui/src/components/ui/workflow/containers/approvals-container.tsx:128`
- **Action Trigger:** `packages/ui/src/components/ui/workflow/containers/approvals-container.tsx:140` (`useWorkflowInstances`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/approvals/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/approvals/approvals-page.tsx:1` (مسیر `approvals`)

### ۲۳. `analysis.benchmark` (بنچ‌مارک و مقایسه با همتایان صنعت)

- **Shared UI Component:** `packages/ui/src/components/ui/analysis/peer-benchmark.tsx:32`
- **Action Trigger:** `packages/ui/src/components/ui/analysis/peer-benchmark.tsx:35` (`usePeerBenchmark()`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/analysis/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/analysis/analysis-page.tsx:8` (مسیر `analysis`)

### ۲۴. `ai.assistant` (دستیار گفتگوی هوشمند)

- **Shared UI Component:** `packages/ui/src/components/ui/ai/containers/ai-assistant-container.tsx:65`
- **Action Trigger:** `packages/ui/src/components/ui/ai/containers/ai-assistant-container.tsx:184` (دکمه ارسال پرامپت به سرور AI)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/assistant/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/ai/assistant-page.tsx:1` (مسیر `assistant`)

### ۲۵. `ai.cashflow_forecast` (پیش‌بینی هوشمند جریان نقدینگی)

- **Shared UI Component:** `packages/ui/src/components/ui/ai/containers/ai-assistant-container.tsx`
- **Action Trigger:** تریگر استعلام پیش‌بینی جریانات مالی ابری
- **Web Route:** `apps/web/app/[lang]/(dashboard)/assistant/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/ai/assistant-page.tsx:1`

### ۲۶. `ocr.receipt` (اسکن و پردازش هوشمند تصویر رسید/فاکتور)

- **Shared UI Component:** `packages/ui/src/components/ui/invoice-builder/camera-scan-button.tsx:45`
- **Action Trigger:** `packages/ui/src/components/ui/invoice-builder/camera-scan-button.tsx:184` (دکمه فعال‌سازی اسکن دوربین / ارسال به موتور ابری)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/invoices/new/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/sales/invoice-builder-page.tsx:8` (مسیر `invoices/new`)

### ۲۷. `bank.import` (ورود صورت‌حساب بانکی و تطبیق)

- **Shared UI Component:** `packages/ui/src/components/ui/bank/containers/bank-container.tsx:24`
- **Action Trigger:** `packages/ui/src/components/ui/bank/containers/bank-container.tsx:122` (دکمه آپلود صورت‌حساب `importStatement.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/accounting/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/accounting/accounting-page.tsx:8` (مسیر `accounting?tab=bank`)

### ۲۸. `developer.keys` (مدیریت کلیدهای API و وب‌هوک‌ها)

- **Shared UI Component:** `packages/ui/src/components/ui/developers/containers/developers-container.tsx:82`
- **Action Trigger:** `packages/ui/src/components/ui/developers/containers/developers-container.tsx:309` (دکمه صدور کلید API جدید `createPublishable.mutate(...)`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/developers/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/developers/developers-page.tsx:1` (مسیر `developers`)

### ۲۹. `marketplace.apps` (نصب و مدیریت افزونه‌های مارکت‌پلیس)

- **Shared UI Component:** `packages/ui/src/components/ui/marketplace/containers/marketplace-container.tsx:37`
- **Action Trigger:** `packages/ui/src/components/ui/marketplace/containers/marketplace-container.tsx:90` (دکمه نصب برنامه از مخزن ابری)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/marketplace/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/marketplace/marketplace-page.tsx:8` (مسیر `marketplace`)

### ۳۰. `storefront.public` (فروشگاه عمومی آنلاین)

- **Shared UI Component:** `packages/ui/src/components/ui/market/market-seller-container.tsx:83`
- **Action Trigger:** `packages/ui/src/components/ui/market/market-seller-container.tsx:213` (دکمه ذخیره و انتشار فروشگاه ابری `onClick={submit}`)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/market-seller/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/market/market-seller-page.tsx:1` (مسیر `market-seller`)

### ۳۱. `billing.portal` (پرتال مالی، اشتراک و ارتقای پلن)

- **Shared UI Component:** `packages/ui/src/components/ui/billing/containers/billing-hub-container.tsx:37`
- **Action Trigger:** `packages/ui/src/components/ui/billing/containers/billing-hub-container.tsx:110` (دکمه‌های ارتقای پلن و پرداخت اشتراک)
- **Web Route:** `apps/web/app/[lang]/(dashboard)/billing/page.tsx`
- **Desktop/Mobile Shell Route:** `packages/app-shell/src/features/billing/billing-page.tsx:1` (مسیر `billing`)

---

## ۴. برنامه گام‌های بعدی (P7-1 تا P7-4)

### گام P7-1 (بخش‌های مستقل از رجیستری):

1. ایجاد کامپوننت مشترک اعلان نیازمندی به سرور:
   `packages/ui/src/components/ui/cloud-required-notice.tsx`
   - استفاده انحصاری از توکن‌های طراحی، کلاس‌های منطقی راست‌به‌چپ (`ms-`, `me-`, `text-start`) و بدون رنگ‌های هاردکد.
   - نمایش پیام صادقانه «این کار اینترنت می‌خواهد»، علت عدم امکان در حالت آفلاین، و راهکار پیش‌رو.
2. تزریق کلیدهای ترجمه خانواده `offline.cloudRequired.*` در سه فایل زبان (`fa`, `af`, `en`) از طریق اسکریپت تک‌عملیاتی بر اساس قوانین فایلهای مشترک.
3. نگارش تست‌های کامپوننت برای بررسی دقیق متون و رفتار در حالات مختلف.

### گام P7-2 (هوک ارزیابی دسترسی اکشن):

1. پیاده‌سازی `packages/ui/src/lib/capability/use-action-availability.ts`:
   - دریافت `featureKey` رسمی از `@hisabche/validation`.
   - استعلام از `resolveEntitlement` بر پایه ویرایش دستگاه (`edition: 'local' | 'cloud'`).
   - خروجی دقیق: `AVAILABLE | REQUIRES_ONLINE | NOT_ENTITLED | REQUIRES_UPGRADE | EXHAUSTED | EXPIRED`.
   - آماده‌سازی درزگاه اتصال به سیستم اشتراک Agent E.

### گام P7-3 (اتصال تریگرها):

1. تجهیز تمام دکمه‌ها و تریگرهای استخراج‌شده در این گزارش به `useActionAvailability` و کامپوننت `CloudRequiredNotice`.
2. پوشش خطای `501 OFFLINE_NOT_AVAILABLE` موتور محلی به نحوی که به‌جای خطای خام سرور، کامپوننت استاندارد به کاربر نمایش داده شود.
3. اعتبارسنجی عدم تغییر در نسخه آنلاین/کلود (باید ۱۰۰٪ مطابق رفتار فعلی بماند).

### گام P7-4 (دروازه کنترل و آزمون Gate 7):

1. اجرای تست جامع `cloud-required.test.ts` (رد شدن تست در صورت وجود قابلیت C بدون گارد).
2. بررسی و تست عدم ارسال هیچ درخواست تحت شبکه در زمان استفاده آفلاین از قابلیت‌های کلاس C.
3. درج گزارش درس‌های آموخته و عبارت «P7 done» در `docs/parallel/handoff.md`.
4. تهیه چک‌لیست تست دستی روی ویندوز و اندروید برای کاربر.
