# Hisabche Feature Catalog

## Domain: accounting

### # Accounting & Finance Audit

# Accounting & Finance Audit

| عنوان                                 | توضیحات                                                                                             | Backend                                                                                                                                                                 | Frontend                                                                                                                                                                   | Status      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| دفتر کل و حساب‌ها (Ledger & Accounts) | مدیریت حساب‌ها (کدینگ)، دفتر روزنامه و ثبت اسناد مالی                                               | `backend/src/services/accounting/accounting.service.ts`<br>`backend/src/services/accounting/ledger.port.ts`                                                             | `packages/ui/.../accounting/tabs/AccountsTab.tsx`<br>`packages/ui/.../accounting/tabs/JournalTab.tsx`                                                                      | Implemented |
| گزارش‌های مالی (Financial Reports)    | گزارش‌های تراز آزمایشی (Trial Balance)، ترازنامه (Balance Sheet) و سود و زیان (Income Statement)    | `backend/src/services/accounting/accounting.reports.ts`<br>`backend/src/services/accounting/profit-report.domain.ts`                                                    | `packages/ui/.../accounting/tabs/TrialBalanceTab.tsx`<br>`packages/ui/.../accounting/tabs/BalanceSheetTab.tsx`<br>`packages/ui/.../accounting/tabs/IncomeStatementTab.tsx` | Implemented |
| عملیات پایان دوره (Month/Year End)    | عملیات بستن ماه و پایان سال مالی                                                                    | `backend/src/services/accounting/month-end.service.ts`<br>`backend/src/services/accounting/month-end.domain.ts`<br>`backend/src/services/accounting/year-end.domain.ts` | `packages/ui/.../accounting/tabs/MonthEndTab.tsx`                                                                                                                          | Implemented |
| خزانه‌داری و بانک (Banking)           | مدیریت حساب‌های بانکی، صورتحساب‌ها، مغایرت‌گیری بانکی (Reconciliation) و دسته‌بندی خودکار تراکنش‌ها | `backend/src/services/banking/banking.service.ts`<br>`backend/src/services/banking/reconciliation.domain.ts`<br>`backend/src/services/banking/auto-match.domain.ts`     | `packages/ui/.../bank/containers/bank-container.tsx`                                                                                                                       | Implemented |
| دارایی‌های ثابت (Fixed Assets)        | مدیریت دارایی‌های ثابت سازمان و محاسبه هزینه استهلاک                                                | `backend/src/services/assets/assets.service.ts`<br>`backend/src/services/assets/depreciation.domain.ts`                                                                 | `packages/ui/.../assets/containers/assets-container.tsx`                                                                                                                   | Implemented |
| تامین مالی و وام (Financing)          | مدیریت تامین مالی و وام‌ها                                                                          | `backend/src/services/financing/financing.service.ts`<br>`backend/src/services/financing/working-capital.domain.ts`                                                     | `packages/ui/.../accounting/tabs/FinancingTab.tsx`                                                                                                                         | Implemented |
| بودجه‌بندی (Budgeting)                | برنامه‌ریزی، تخصیص و پایش بودجه سازمان                                                              | `backend/src/services/budgeting/budget.service.ts`<br>`backend/src/services/budgeting/budget.domain.ts`                                                                 | `packages/ui/.../budgets/containers/budgets-container.tsx`                                                                                                                 | Implemented |
| مالیات (Tax)                          | محاسبه مالیات، تهیه اسنپ‌شات‌های مالیاتی و مدیریت دوره‌ها                                           | `backend/src/services/tax/tax.service.ts`<br>`backend/src/services/tax/tax.domain.ts`<br>`backend/src/services/tax/tax.snapshot.ts`                                     | -                                                                                                                                                                          | Implemented |
| ابعاد مالی (Dimensions)               | مدیریت مراکز هزینه و ابعاد تفصیلی در سطح تراکنش‌ها                                                  | `backend/src/services/dimensions/dimensions.service.ts`<br>`backend/src/services/dimensions/dimension.domain.ts`                                                        | -                                                                                                                                                                          | Implemented |
| کیف پول (Wallet)                      | مدیریت موجودی و گردش‌های کیف پول کاربران                                                            | `backend/src/services/wallet/wallet.service.ts`                                                                                                                         | `packages/ui/.../wallet/`                                                                                                                                                  | Implemented |

### دفتر کل و حساب‌ها (Ledger & Accounts)

- **توضیحات**: مدیریت حساب‌ها (کدینگ)، دفتر روزنامه و ثبت اسناد مالی
- **Backend**: `backend/src/services/accounting/accounting.service.ts`<br>`backend/src/services/accounting/ledger.port.ts`
- **Frontend**: `packages/ui/.../accounting/tabs/AccountsTab.tsx`<br>`packages/ui/.../accounting/tabs/JournalTab.tsx`
- **Status**: COMPLETE

### گزارش‌های مالی (Financial Reports)

- **توضیحات**: گزارش‌های تراز آزمایشی (Trial Balance)، ترازنامه (Balance Sheet) و سود و زیان (Income Statement)
- **Backend**: `backend/src/services/accounting/accounting.reports.ts`<br>`backend/src/services/accounting/profit-report.domain.ts`
- **Frontend**: `packages/ui/.../accounting/tabs/TrialBalanceTab.tsx`<br>`packages/ui/.../accounting/tabs/BalanceSheetTab.tsx`<br>`packages/ui/.../accounting/tabs/IncomeStatementTab.tsx`
- **Status**: COMPLETE

### عملیات پایان دوره (Month/Year End)

- **توضیحات**: عملیات بستن ماه و پایان سال مالی
- **Backend**: `backend/src/services/accounting/month-end.service.ts`<br>`backend/src/services/accounting/month-end.domain.ts`<br>`backend/src/services/accounting/year-end.domain.ts`
- **Frontend**: `packages/ui/.../accounting/tabs/MonthEndTab.tsx`
- **Status**: COMPLETE

### خزانه‌داری و بانک (Banking)

- **توضیحات**: مدیریت حساب‌های بانکی، صورتحساب‌ها، مغایرت‌گیری بانکی (Reconciliation) و دسته‌بندی خودکار تراکنش‌ها
- **Backend**: `backend/src/services/banking/banking.service.ts`<br>`backend/src/services/banking/reconciliation.domain.ts`<br>`backend/src/services/banking/auto-match.domain.ts`
- **Frontend**: `packages/ui/.../bank/containers/bank-container.tsx`
- **Status**: COMPLETE

### دارایی‌های ثابت (Fixed Assets)

- **توضیحات**: مدیریت دارایی‌های ثابت سازمان و محاسبه هزینه استهلاک
- **Backend**: `backend/src/services/assets/assets.service.ts`<br>`backend/src/services/assets/depreciation.domain.ts`
- **Frontend**: `packages/ui/.../assets/containers/assets-container.tsx`
- **Status**: COMPLETE

### تامین مالی و وام (Financing)

- **توضیحات**: مدیریت تامین مالی و وام‌ها
- **Backend**: `backend/src/services/financing/financing.service.ts`<br>`backend/src/services/financing/working-capital.domain.ts`
- **Frontend**: `packages/ui/.../accounting/tabs/FinancingTab.tsx`
- **Status**: COMPLETE

### بودجه‌بندی (Budgeting)

- **توضیحات**: برنامه‌ریزی، تخصیص و پایش بودجه سازمان
- **Backend**: `backend/src/services/budgeting/budget.service.ts`<br>`backend/src/services/budgeting/budget.domain.ts`
- **Frontend**: `packages/ui/.../budgets/containers/budgets-container.tsx`
- **Status**: COMPLETE

### مالیات (Tax)

- **توضیحات**: محاسبه مالیات، تهیه اسنپ‌شات‌های مالیاتی و مدیریت دوره‌ها
- **Backend**: `backend/src/services/tax/tax.service.ts`<br>`backend/src/services/tax/tax.domain.ts`<br>`backend/src/services/tax/tax.snapshot.ts`
- **Frontend**: -
- **Status**: COMPLETE

### ابعاد مالی (Dimensions)

- **توضیحات**: مدیریت مراکز هزینه و ابعاد تفصیلی در سطح تراکنش‌ها
- **Backend**: `backend/src/services/dimensions/dimensions.service.ts`<br>`backend/src/services/dimensions/dimension.domain.ts`
- **Frontend**: -
- **Status**: COMPLETE

### کیف پول (Wallet)

- **توضیحات**: مدیریت موجودی و گردش‌های کیف پول کاربران
- **Backend**: `backend/src/services/wallet/wallet.service.ts`
- **Frontend**: `packages/ui/.../wallet/`
- **Status**: COMPLETE

## Domain: ai-content

### # AI & Content Domain Audit

# AI & Content Domain Audit

| عنوان                                                  | توضیحات                                                                                                                                  | Backend                                                                                                                                                     | Frontend                                                                                                | Status                                                                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **چت هوش مصنوعی و پایپ‌لاین (AI Chat & MCP Pipeline)** | زیرساخت پرسش و پاسخ با مدل هوش مصنوعی برای اطلاعات فضای کاری و سیستم تایید درخواست‌های اکشن‌های هوش مصنوعی (Approval Queue) به شکل ایمن. | `ai-chat.service.ts`, `provider-client.ts`, `pipeline.service.ts`, `mcp-request.service.ts`<br>جداول: `ai_action_requests`, `ai_query_log`                  | `ai-assistants-panel.tsx`, `ai-insights.tsx`, `customer-ai-summary.tsx`                                 | زیرساخت بک‌اند و کامپوننت‌های فرانت‌اند پیاده‌سازی شده، اما طبق مستندات اتصال به Provider در حالت زیرساختی است (Infrastructure Only). |
| **بلاگ و هوش محتوایی (Blog & Content Intelligence)**   | مدیریت پست‌های بلاگ، دسته‌بندی‌ها، نظرات، واکنش‌ها به همراه ابزارهای هوش مصنوعی برای تولید بریف و انجام تحقیقات (Research Runs).         | `blog.service.ts`, `research.service.ts`, `draft.service.ts`, `quality-gate.service.ts`<br>جداول: `blog_posts`, `blog_content_briefs`, `blog_research_runs` | `blog-article-view.tsx`, `blog-list-view.tsx`, `blog-post-card.tsx`<br>مسیر: `apps/web/app/[lang]/blog` | پیاده‌سازی شده. بخش‌های هوش محتوایی و بریف نیز کدهای سرویس بک‌اند را دارند.                                                           |
| **سیستم مدیریت محتوا (CMS)**                           | مدیریت صفحات عمومی سایت و کتابخانه رسانه‌ها (Media Library). این ویژگی به صورت سراسری (بدون وابستگی به workspace) پیاده‌سازی شده است.    | `cms.service.ts`, `cms.domain.ts`, `cms.repository.ts`<br>جداول: `cms_pages`, `cms_media`                                                                   | فایلی در `apps/web` یا `packages/ui/src` یافت نشد.                                                      | فقط بک‌اند پیاده‌سازی شده (رابط کاربری مجزا ندارد).                                                                                   |
| **کمپین‌ها و نظرسنجی (Campaigns & NPS)**               | اجرای کمپین‌های پیامکی/ایمیلی برای مشتریان و جمع‌آوری امتیاز خالص ترویج‌کنندگان (NPS) با استفاده از سیستم Outbox.                        | `campaign.service.ts`, `campaign.domain.ts`<br>جداول: `customer_campaigns`, `campaign_recipients`                                                           | `campaigns-container.tsx`, `feedback-container.tsx`                                                     | پیاده‌سازی شده.                                                                                                                       |
| **هوش مالی و پیش‌بینی (Financial Intelligence)**       | پیش‌بینی جریان نقدینگی ناشی از مطالبات/بدهی‌ها (Cash Forecast) و فرصت‌های راکد فروش (Read-only Models).                                  | `forecast.service.ts`, `forecast.domain.ts`                                                                                                                 | احتمالاً یکپارچه در داشبورد (`ai-insights.tsx`)                                                         | پیاده‌سازی شده.                                                                                                                       |

### چت هوش مصنوعی و پایپ‌لاین (AI Chat & MCP Pipeline)

- **توضیحات**: زیرساخت پرسش و پاسخ با مدل هوش مصنوعی برای اطلاعات فضای کاری و سیستم تایید درخواست‌های اکشن‌های هوش مصنوعی (Approval Queue) به شکل ایمن.
- **Backend**: `ai-chat.service.ts`, `provider-client.ts`, `pipeline.service.ts`, `mcp-request.service.ts`<br>جداول: `ai_action_requests`, `ai_query_log`
- **Frontend**: `ai-assistants-panel.tsx`, `ai-insights.tsx`, `customer-ai-summary.tsx`
- **Status**: زیرساخت بک‌اند و کامپوننت‌های فرانت‌اند پیاده‌سازی شده، اما طبق مستندات اتصال به PROVIDER در حالت زیرساختی است (INFRASTRUCTURE ONLY).

### بلاگ و هوش محتوایی (Blog & Content Intelligence)

- **توضیحات**: مدیریت پست‌های بلاگ، دسته‌بندی‌ها، نظرات، واکنش‌ها به همراه ابزارهای هوش مصنوعی برای تولید بریف و انجام تحقیقات (Research Runs).
- **Backend**: `blog.service.ts`, `research.service.ts`, `draft.service.ts`, `quality-gate.service.ts`<br>جداول: `blog_posts`, `blog_content_briefs`, `blog_research_runs`
- **Frontend**: `blog-article-view.tsx`, `blog-list-view.tsx`, `blog-post-card.tsx`<br>مسیر: `apps/web/app/[lang]/blog`
- **Status**: پیاده‌سازی شده. بخش‌های هوش محتوایی و بریف نیز کدهای سرویس بک‌اند را دارند.

### سیستم مدیریت محتوا (CMS)

- **توضیحات**: مدیریت صفحات عمومی سایت و کتابخانه رسانه‌ها (Media Library). این ویژگی به صورت سراسری (بدون وابستگی به workspace) پیاده‌سازی شده است.
- **Backend**: `cms.service.ts`, `cms.domain.ts`, `cms.repository.ts`<br>جداول: `cms_pages`, `cms_media`
- **Frontend**: فایلی در `apps/web` یا `packages/ui/src` یافت نشد.
- **Status**: فقط بک‌اند پیاده‌سازی شده (رابط کاربری مجزا ندارد).

### کمپین‌ها و نظرسنجی (Campaigns & NPS)

- **توضیحات**: اجرای کمپین‌های پیامکی/ایمیلی برای مشتریان و جمع‌آوری امتیاز خالص ترویج‌کنندگان (NPS) با استفاده از سیستم Outbox.
- **Backend**: `campaign.service.ts`, `campaign.domain.ts`<br>جداول: `customer_campaigns`, `campaign_recipients`
- **Frontend**: `campaigns-container.tsx`, `feedback-container.tsx`
- **Status**: پیاده‌سازی شده.

### هوش مالی و پیش‌بینی (Financial Intelligence)

- **توضیحات**: پیش‌بینی جریان نقدینگی ناشی از مطالبات/بدهی‌ها (Cash Forecast) و فرصت‌های راکد فروش (Read-only Models).
- **Backend**: `forecast.service.ts`, `forecast.domain.ts`
- **Frontend**: احتمالاً یکپارچه در داشبورد (`ai-insights.tsx`)
- **Status**: پیاده‌سازی شده.

## Domain: customers-crm

### لیست ویژگی‌های یافت شده

لیست ویژگی‌های یافت شده

| عنوان ویژگی                                 | توضیحات                                                                                           | مسیرهای Backend / API                                                                                                                          | مسیرهای Frontend / UI                                                                                                                                                                                    | وضعیت کلی (Status)    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **مدیریت و لیست مشتریان (Customers)**       | ایجاد، ویرایش و نمایش لیست مشتریان همراه با فیلترها و گرید داده (DataGrid)، مدیریت نقش‌ها         | `backend/src/services/customer.service.ts`<br>`packages/api/src/hooks/customers.ts`<br>`packages/validation/src/schemas/customer.schema.ts`    | `packages/app-shell/src/features/customers/customer-list-page.tsx`<br>`packages/ui/src/components/ui/customers/customer-list.tsx`<br>`packages/ui/src/components/ui/customers/datagrid/`                 | پیاده‌سازی شده        |
| **پروفایل ۳۶۰ درجه مشتری**                  | پنل جامع شامل تاریخچه تعاملات، صورتحساب‌ها، پرداخت‌ها، خلاصه هوش مصنوعی (AI Summary) و تحلیل ریسک | `packages/api/src/hooks/customer-profile.ts`<br>`backend/src/__tests__/customer-profile-core.test.ts`                                          | `packages/app-shell/src/features/crm/customer-detail-page.tsx`<br>`packages/ui/src/components/ui/customers/customer-360-header.tsx`<br>`packages/ui/src/components/ui/customers/customer-ai-summary.tsx` | پیاده‌سازی شده        |
| **سیستم CRM و مدیریت تسک‌ها**               | ثبت تعاملات، تخصیص تسک‌های فالوآپ، رهگیری وضعیت (Outcomes) و نمایش نمودار آماری                   | `packages/api/src/hooks/crm.ts`<br>`packages/validation/src/schemas/crm.schema.ts`<br>`packages/validation/src/__tests__/crm-outcomes.test.ts` | `packages/app-shell/src/features/crm/customers-page.tsx`<br>`packages/ui/src/components/ui/crm/crm-view.tsx`<br>`packages/ui/src/components/ui/crm/task-customer-outcomes.tsx`                           | پیاده‌سازی شده        |
| **پورتال عمومی مشتری (Customer Portal)**    | فراهم کردن یک نمای ایزوله از تسک‌های عمومی و پنل مشتری جهت دسترسی‌های بیرون از سازمان             | `packages/api/src/hooks/customer-portal.ts`<br>`backend/src/__tests__/customer-portal.test.ts`                                                 | `packages/ui/src/components/ui/customers/containers/public-portal-container.tsx`<br>`packages/ui/src/components/ui/crm/containers/public-task-container.tsx`                                             | پیاده‌سازی شده        |
| **برنامه ریفرال (Referral System)**         | مدیریت لینک‌های دعوت، رهگیری عضویت‌های جدید و پاداش‌دهی بر اساس ارجاع                             | `packages/api/src/hooks/referrals.ts`<br>`backend/src/__tests__/referral-programme.test.ts`                                                    | `packages/ui/src/components/ui/referrals/referrals-view.tsx`<br>`packages/ui/src/components/ui/referrals/containers/referrals-container.tsx`                                                             | پیاده‌سازی شده        |
| **وصول مطالبات و سلامت مالی (Collections)** | گزارش‌گیری از میزان بدهی، یکپارچگی مانده‌حساب‌ها (Balance Integrity) و رفع مغایرت‌ها              | `backend/src/__tests__/customer-debt-report.test.ts`<br>`backend/src/__tests__/customer-balance-integrity.test.ts`                             | فاقد ماژول اختصاصی مستقل در UI (به‌احتمال زیاد ادغام‌شده در صورتحساب‌ها/Invoice و پروفایل)                                                                                                               | ترکیبی / در حال توسعه |

### مدیریت و لیست مشتریان (Customers)

- **توضیحات**: ایجاد، ویرایش و نمایش لیست مشتریان همراه با فیلترها و گرید داده (DataGrid)، مدیریت نقش‌ها
- **مسیرهای Backend / API**: `backend/src/services/customer.service.ts`<br>`packages/api/src/hooks/customers.ts`<br>`packages/validation/src/schemas/customer.schema.ts`
- **مسیرهای Frontend / UI**: `packages/app-shell/src/features/customers/customer-list-page.tsx`<br>`packages/ui/src/components/ui/customers/customer-list.tsx`<br>`packages/ui/src/components/ui/customers/datagrid/`
- **Status**: پیاده‌سازی شده

### پروفایل ۳۶۰ درجه مشتری

- **توضیحات**: پنل جامع شامل تاریخچه تعاملات، صورتحساب‌ها، پرداخت‌ها، خلاصه هوش مصنوعی (AI Summary) و تحلیل ریسک
- **مسیرهای Backend / API**: `packages/api/src/hooks/customer-profile.ts`<br>`backend/src/__tests__/customer-profile-core.test.ts`
- **مسیرهای Frontend / UI**: `packages/app-shell/src/features/crm/customer-detail-page.tsx`<br>`packages/ui/src/components/ui/customers/customer-360-header.tsx`<br>`packages/ui/src/components/ui/customers/customer-ai-summary.tsx`
- **Status**: پیاده‌سازی شده

### سیستم CRM و مدیریت تسک‌ها

- **توضیحات**: ثبت تعاملات، تخصیص تسک‌های فالوآپ، رهگیری وضعیت (Outcomes) و نمایش نمودار آماری
- **مسیرهای Backend / API**: `packages/api/src/hooks/crm.ts`<br>`packages/validation/src/schemas/crm.schema.ts`<br>`packages/validation/src/__tests__/crm-outcomes.test.ts`
- **مسیرهای Frontend / UI**: `packages/app-shell/src/features/crm/customers-page.tsx`<br>`packages/ui/src/components/ui/crm/crm-view.tsx`<br>`packages/ui/src/components/ui/crm/task-customer-outcomes.tsx`
- **Status**: پیاده‌سازی شده

### پورتال عمومی مشتری (Customer Portal)

- **توضیحات**: فراهم کردن یک نمای ایزوله از تسک‌های عمومی و پنل مشتری جهت دسترسی‌های بیرون از سازمان
- **مسیرهای Backend / API**: `packages/api/src/hooks/customer-portal.ts`<br>`backend/src/__tests__/customer-portal.test.ts`
- **مسیرهای Frontend / UI**: `packages/ui/src/components/ui/customers/containers/public-portal-container.tsx`<br>`packages/ui/src/components/ui/crm/containers/public-task-container.tsx`
- **Status**: پیاده‌سازی شده

### برنامه ریفرال (Referral System)

- **توضیحات**: مدیریت لینک‌های دعوت، رهگیری عضویت‌های جدید و پاداش‌دهی بر اساس ارجاع
- **مسیرهای Backend / API**: `packages/api/src/hooks/referrals.ts`<br>`backend/src/__tests__/referral-programme.test.ts`
- **مسیرهای Frontend / UI**: `packages/ui/src/components/ui/referrals/referrals-view.tsx`<br>`packages/ui/src/components/ui/referrals/containers/referrals-container.tsx`
- **Status**: پیاده‌سازی شده

### وصول مطالبات و سلامت مالی (Collections)

- **توضیحات**: گزارش‌گیری از میزان بدهی، یکپارچگی مانده‌حساب‌ها (Balance Integrity) و رفع مغایرت‌ها
- **مسیرهای Backend / API**: `backend/src/__tests__/customer-debt-report.test.ts`<br>`backend/src/__tests__/customer-balance-integrity.test.ts`
- **مسیرهای Frontend / UI**: فاقد ماژول اختصاصی مستقل در UI (به‌احتمال زیاد ادغام‌شده در صورتحساب‌ها/Invoice و پروفایل)
- **Status**: ترکیبی / در حال توسعه

## Domain: ecosystem

### Backend

Backend

- `backend/src/services/market` (market.service.ts)
- `backend/src/services/oauth` (oauth.domain.ts, marketplace.service.ts, oauth.repository.ts, oauth.service.ts)
- `backend/src/services/extensions` (extension.domain.ts, custom-fields.service.ts)
- `backend/src/services/plugins` (plugin.domain.ts)
- `backend/src/services/developer` (developer.domain.ts, developer.repository.ts, developer.service.ts, sandbox.service.ts)
- `backend/src/services/workflow` (approval-gate.domain.ts, approval.domain.ts, builder.domain.ts, compensation.service.ts, escalation.domain.ts, escalation.service.ts)
- `backend/src/services/rules` (rules.domain.ts, rules.service.ts)

### Tests

Tests

- **Backend Tests:** `approval-gate.test.ts`, `approval-routing.test.ts`, `automation-schedule.test.ts`, `automation-service.test.ts`, `connector-framework.test.ts`, `developer-platform.test.ts`, `escalation-and-compensation.test.ts`, `extension-boundary-guard.test.ts`, `goods-marketplace.test.ts`, `marketplace.test.ts`, `oauth.test.ts`, `sandbox.test.ts`, `workflow-builder.test.ts`, `rules-engine-rules.test.ts`
- **Frontend Tests:** `oauth-screens.test.ts`, `marketplace-screens.test.ts`, `goods-marketplace-pages.test.ts`, `workflow-escalation-ui.test.ts`, `approvals-hub.test.ts`, `developers-screen.test.ts`, `sandbox-screens.test.ts`

## Domain: hr

### مدیریت کارمندان و تیم (Employees & Team)

مدیریت کارمندان و تیم (Employees & Team)

- **توضیحات**: مدیریت اطلاعات کارمندان، استخدام، نقش‌ها، دسترسی‌ها و انتساب به شعب.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: حذف فایل‌های پراکنده اکسل برای اطلاعات پرسنل و خودکارسازی اعطای دسترسی به نرم‌افزار بدون نیاز به درگیری با مفاهیم پیچیده مجوزها.
- **الگوریتم / منطق کاری در Hisabche**: ثبت کارمند جدید، احراز هویت (در صورت داشتن دسترسی ورود) و انتساب نقش و شعبه مربوطه. پشتیبانی از Caching، صفحه‌بندی و Projection برای بهینه‌سازی.
- **نتیجه برای کسب‌وکار**: مدیریت متمرکز پرسنل و کنترل دسترسی‌های امن به اطلاعات مالی کسب‌وکار در شعب مختلف.
- **نحوه استفاده (مسیر واقعی UI)**: `apps/web/app/[lang]/(dashboard)/team-and-payroll`
- **Backend**: `backend/src/routes/human-resources.routes.ts`, `backend/src/services/human-resources.service.ts`
- **Frontend**: `packages/app-shell/src/features/human-resources/hr-page.tsx`, `packages/ui/src/components/ui/team-and-payroll/team-and-payroll-view.tsx`
- **API**: GET/POST/PATCH `/api/departments`, `/api/employees`
- **Data / DB**: `employees`, `employee_branch_assignments`, `departments`
- **Tests**: `backend/src/__tests__/employee-branch-columns.test.ts`, `packages/ui/src/__tests__/team-hub.test.ts`
- **Status**: COMPLETE
- **زاویه فروش**: پنل جامع منابع انسانی که مستقیماً با دسترسی‌ها و شعب متصل است و نیاز به نرم‌افزار مجزا را از بین می‌برد.
- **مشکل مشتری که حل می‌کند**: پراکندگی اطلاعات پرسنل، سردرگمی در مدیریت دسترسی سیستم و خطای انسانی.
- **مناسب برای چه نوع کسب‌وکاری**: کسب‌وکارهای متوسط تا بزرگ دارای چندین شعبه و پرسنل با سطوح دسترسی متفاوت.
- **Feature Relationships**: متصل به شعبه (Branch Management)، حقوق (Payroll) و حضور و غیاب (Attendance).
- **NEXT_HOOK**: سیستم ارزیابی عملکرد و پاداش‌دهی اتوماتیک.
- **زبان اثبات (برای دمو)**: "با ثبت یک کارمند در اینجا، سطح دسترسی او به سیستم و شعبه‌اش به صورت خودکار تنظیم می‌شود."
- **Evidence**: `human-resources.service.ts` حاوی تمامی مسیرها، مدیریت Cache و `employee_branch_assignments`.
- **Business Value**: 4
- **Demo Value**: 4
- **Differentiation**: 3
- **Frequency of Use**: 4
- **Sales Impact**: 3

### حضور و غیاب (Attendance)

حضور و غیاب (Attendance)

- **توضیحات**: لیست روزانه حضور، ثبت ورود/خروج، مرخصی.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: پایان دادن به چک کردن دستی دفتر حضور و غیاب و محاسبه ذهنی ساعت کار و اضافه‌کاری برای پرداخت آخر ماه.
- **الگوریتم / منطق کاری در Hisabche**: قانون One Record Per Employee Per Day. سیستم بررسی می‌کند تا رکوردهای تکراری ذخیره نشوند و آپدیت روی همان رکورد روزانه انجام شود. یک روز Open ساعت کار محاسبه‌شده (null) ندارد.
- **نتیجه برای کسب‌وکار**: نظارت دقیق روی ساعات کاری پرسنل و جلوگیری از تقلب، پیش‌نیاز محاسبه صحیح حقوق.
- **نحوه استفاده (مسیر واقعی UI)**: زبانه Attendance در `TeamAndPayrollView` و شیت `attendance-sheet.tsx`
- **Backend**: `backend/src/services/attendance/attendance.domain.ts`, `backend/src/services/payroll/attendance.service.ts`, `backend/src/routes/attendance.routes.ts`
- **Frontend**: `packages/api/src/hooks/attendance.ts`, `packages/ui/src/components/ui/team-and-payroll/attendance-sheet.tsx`
- **API**: GET `/attendance-sheet`, PUT `/attendance-sheet`
- **Data / DB**: `attendance` table
- **Tests**: `backend/src/__tests__/attendance-service.test.ts`, `backend/src/__tests__/attendance-shifts-notes.test.ts`, `backend/src/__tests__/attendance.pg.test.ts`
- **Status**: PARTIAL
- **زاویه فروش**: شفافیت کامل در ساعات ورود و خروج به صورت ثبت سیستمی یکپارچه با شیفت‌ها.
- **مشکل مشتری که حل می‌کند**: ثبت دستی ساعات، تقلب در تایم ورود و خروج، خطای محاسبه ساعات در آخر ماه.
- **مناسب برای چه نوع کسب‌وکاری**: تمام شرکت‌ها و فروشگاه‌های دارای پرسنل ساعتی، شیفتی یا تمام‌وقت.
- **Feature Relationships**: متصل به شیفت‌ها (Work Shifts) و حقوق (Payroll).
- **NEXT_HOOK**: گزارش‌گیری پیشرفته تاخیرها.
- **زبان اثبات (برای دمو)**: "حضور و غیاب که زده میشه، ساعت کار محاسبه میشه اما تا زمانی که شما تایید نکنید، مستقیم روی لیست پرداختی حقوق نمی‌شینه."
- **Evidence**: لاجیک عدم محاسبه صفر در `attendanceFor`، اسکریپت تاییدنشده `attendance-01-migration.sql`.
- **Business Value**: 5
- **Demo Value**: 5
- **Differentiation**: 4
- **Frequency of Use**: 5
- **Sales Impact**: 4

### شیفت‌های کاری (Work Shifts)

شیفت‌های کاری (Work Shifts)

- **توضیحات**: تعریف شیفت‌های کاری، ساعات شروع و پایان و زمان‌های استراحت برای محاسبه خودکار تاخیر و کسر کار.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: برنامه‌ریزی آسان شیفت‌ها بدون نیاز به محاسبه دستی میزان تاخیر یا کسر کار هر شخص در پایان ماه.
- **الگوریتم / منطق کاری در Hisabche**: شیفت‌ها بازه زمانی (`startsAt`, `endsAt`) و زمان استراحت (`breakMinutes`) دارند و ساعات حضور و تاخیرها بر اساس آن‌ها اعتبارسنجی و محاسبه می‌شود.
- **نتیجه برای کسب‌وکار**: اتوماسیون کامل شیفت‌بندی و کسر کار.
- **نحوه استفاده (مسیر واقعی UI)**: تنظیمات شیفت‌ها در زبانه Attendance
- **Backend**: `backend/src/services/customers/attendance.domain.ts` (و درهم‌تنیده با لاجیک Attendance)
- **Frontend**: `packages/ui/src/components/ui/team-and-payroll/shift-manager.tsx`, `packages/ui/src/components/ui/team-and-payroll/shift-plan.tsx`
- **API**: GET `/work-shifts`
- **Data / DB**: `work_shifts`
- **Tests**: NOT FOUND
- **Status**: COMPLETE
- **زاویه فروش**: برنامه‌ریزی شیفت‌بندی بدون دردسر و پویا که مستقیما با کارکرد ماهانه لینک می‌شود.
- **مشکل مشتری که حل می‌کند**: سختی برنامه‌ریزی شیفت‌های چرخشی و اشتباه در محاسبه زمان‌های استراحت.
- **مناسب برای چه نوع کسب‌وکاری**: بیمارستان‌ها، فروشگاه‌های زنجیره‌ای، رستوران‌ها و کافه‌ها.
- **Feature Relationships**: وابسته و متصل به Attendance.
- **NEXT_HOOK**: تخصیص هوشمند شیفت‌ها بر اساس شلوغی پیش‌بینی‌شده با هوش مصنوعی.
- **زبان اثبات (برای دمو)**: "شما فقط شیفت رو تعریف کنید، سیستم خودش تاخیرها رو بر اساس ساعت شروع شیفت درمیاره."
- **Evidence**: توابع مرتبط با شیفت در `packages/api/src/hooks/attendance.ts` (`useWorkShifts`).
- **Business Value**: 4
- **Demo Value**: 4
- **Differentiation**: 3
- **Frequency of Use**: 3
- **Sales Impact**: 3

### حقوق و دستمزد (Payroll)

حقوق و دستمزد (Payroll)

- **توضیحات**: محاسبه حقوق، مالیات، کسورات و صدور خودکار سند حسابداری در دفتر کل (Ledger).
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: تسویه سریع حقوق پرسنل و اطمینان کامل از اینکه تمام پرداختی‌ها، کسورات و مالیات به‌صورت متوازن در دفاتر حسابداری شرکت لحاظ شده‌اند.
- **الگوریتم / منطق کاری در Hisabche**: تبدیل لیست حقوق به ژورنال‌های بالانس شده (Journal Entries). حقوق ناخالص به عنوان هزینه (`salary_expense`) بدهکار، و مالیات (`tax`)، کسورات (`payable`) و خالص پرداختی (`cash`/`bank`) بستانکار می‌شوند.
- **نتیجه برای کسب‌وکار**: یکپارچگی بی‌نقص حقوق پرداختی با حسابداری بدون نیاز به ثبت دستی اسناد.
- **نحوه استفاده (مسیر واقعی UI)**: زبانه Payroll در `TeamAndPayrollView`
- **Backend**: `backend/src/services/payroll/payroll-ledger.domain.ts`, `backend/src/routes/human-resources.routes.ts`
- **Frontend**: `packages/api/src/hooks/payroll.ts`, `packages/ui/src/components/ui/team-and-payroll/payroll-list-table.tsx`, `packages/ui/src/components/ui/team-and-payroll/payroll-outcome.tsx`
- **API**: GET/POST `/payrolls`, PATCH `/payrolls/:id`, GET `/payrolls/summary`
- **Data / DB**: `payrolls`, `journal_entries`, `transactions`
- **Tests**: `backend/src/__tests__/payroll-ledger.test.ts`, `packages/ui/src/components/ui/team-and-payroll/__tests__/payroll-tab-wiring.test.ts`, `packages/ui/src/__tests__/payroll-outcome.test.ts`
- **Status**: COMPLETE
- **زاویه فروش**: واریز حقوق و ثبت دقیق سند حسابداری آن با تمامی جزئیات فقط با یک کلیک.
- **مشکل مشتری که حل می‌کند**: ثبت نشدن سند حسابداری برای حقوق‌های پرداختی و ایجاد مغایرت پنهان در ترازنامه‌های آخر ماه (مشکل J0).
- **مناسب برای چه نوع کسب‌وکاری**: تمامی کسب‌وکارها.
- **Feature Relationships**: وابسته به Accounting و Attendance.
- **NEXT_HOOK**: واریز گروهی (Batch Payout) از طریق وب‌سرویس مستقیم بانکی.
- **زبان اثبات (برای دمو)**: "به محض اینکه فیش حقوقی رو پرداخت می‌زنید، سند حسابداری دقیقاً همون لحظه بدون دخالت دست ثبت میشه و حساب بانکی آپدیت میشه."
- **Evidence**: اسکریپت `phase-j-04-payroll-ledger-migration.sql`، متدهای ثبت و تسویه `useCreatePayroll` و `useSettlePayroll` در هوک‌ها، اعتبارسنجی تراز `linesBalance` در بک‌اند.
- **Business Value**: 5
- **Demo Value**: 5
- **Differentiation**: 5
- **Frequency of Use**: 4
- **Sales Impact**: 5

### تایم‌شیت (Timesheets)

تایم‌شیت (Timesheets)

- **توضیحات**: لاگ زمان کارمندان روی پروژه‌ها، محاسبه تایم‌های قابل پرداخت (Billable) و سودآوری پروژه‌ها.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: محاسبه خودکار هزینه نیروی انسانی صرف‌شده روی پروژه‌ها و فاکتور کردن سریع و بدون خطای آن‌ها برای مشتری.
- **الگوریتم / منطق کاری در Hisabche**: ثبت ساعات با نرخ توافقی (`rateMinor`). اگر ساعت‌ها فاکتور شوند، فیلد `invoice_id` تخصیص می‌یابد و به عنوان قفل عمل می‌کند تا از فاکتور شدن مجدد یا ویرایش پس از صدور جلوگیری کند.
- **نتیجه برای کسب‌وکار**: ردیابی دقیق هزینه نیروی انسانی در هر پروژه و عدم فراموشی در صدور فاکتور کارها برای مشتری.
- **نحوه استفاده (مسیر واقعی UI)**: `packages/ui/src/components/ui/timesheets/timesheets-view.tsx`
- **Backend**: `backend/src/services/timesheets/timesheets.service.ts`, `backend/src/services/timesheets/billing.domain.ts`
- **Frontend**: `packages/api/src/hooks/timesheets.ts`, `packages/ui/src/components/ui/timesheets/timesheets-view.tsx`, `packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx`
- **API**: متدهای `timesheets.service.ts` شامل listEntries, logTime, updateEntry, markBilled, previewBilling
- **Data / DB**: `time_entries`, `project_billing_config`, `invoices`
- **Tests**: NOT FOUND
- **Status**: COMPLETE
- **زاویه فروش**: هیچ ساعتی از کار کارمندان هدر نمی‌رود و دقیقاً تبدیل به پول (Invoice) می‌شود.
- **مشکل مشتری که حل می‌کند**: فراموشی فاکتور کردن ساعات کار پروژه‌ای و ضرر دادن شرکت‌های خدماتی.
- **مناسب برای چه نوع کسب‌وکاری**: شرکت‌های نرم‌افزاری، آژانس‌های مارکتینگ، فریلنسرها، شرکت‌های مشاور و خدماتی.
- **Feature Relationships**: وابسته به Invoices (برای صدور فاکتور) و Projects.
- **NEXT_HOOK**: پیشنهاد قیمت پروژه‌های جدید بر اساس عملکرد و تایم‌شیت پروژه‌های قبلی مشابه.
- **زبان اثبات (برای دمو)**: "ساعت کار پرسنل روی پروژه رو وارد کن، سیستم خودش آخر کار اون رو به پیش‌فاکتور مشتری تبدیل میکنه و اجازه دوبار فاکتور شدن هم نمیده."
- **Evidence**: منطق بررسی و جلوگیری از ویرایش `is('invoice_id', null)` در `timesheets.service.ts`.
- **Business Value**: 5
- **Demo Value**: 4
- **Differentiation**: 4
- **Frequency of Use**: 5
- **Sales Impact**: 4

## Domain: inventory

### # Inventory & Manufacturing Audit

# Inventory & Manufacturing Audit

| عنوان                                    | توضیحات                                                                               | Backend                                                                                                          | Frontend                                                                     | Status      |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------- |
| مدیریت انبار و چند انباری (Warehouse)    | مدیریت انبارها، انتقال موجودی بین انبارها و تاریخچه ورود/خروج                         | `backend/src/services/warehouse.service.ts`<br>`backend/src/services/warehouse/transfer.service.ts`              | `apps/web/app/.../warehouse`<br>`packages/ui/.../warehouse`                  | Implemented |
| بهای تمام شده موجودی (Inventory Costing) | محاسبه دقیق و لحظه‌ای بهای تمام شده کالای فروش رفته (COGS) و مدیریت ارزش کالاها       | `backend/src/services/inventory-costing/costing.service.ts`<br>`backend/src/routes/inventory-costing.routes.ts`  | `packages/app-shell/.../inventory-ops`                                       | Implemented |
| ردیابی و بچ‌نامبر (Traceability)         | مدیریت شماره سریال‌ها، بچ‌ها و تاریخ انقضا (Expiry) با تخصیص دقیق                     | `backend/src/services/traceability/traceability.service.ts`<br>`backend/src/services/traceability/lot.domain.ts` | `packages/ui/.../warehouse-detail/product-expiry-panel.tsx`                  | Implemented |
| تصاویر محصول (Product Images)            | مدیریت گالری تصاویر هر محصول با ظرفیت تا ۸ عکس و مرتب‌سازی                            | `backend/src/services/product-images/product-images.service.ts`                                                  | `packages/ui/.../warehouse-detail/product-images-panel.tsx`                  | Implemented |
| تولید و فرمول ساخت (Manufacturing)       | فرآیند تولید محصولات مبتنی بر BOM (دستورالعمل ساخت)، محاسبه هزینه تولید و سابقه تولید | `backend/src/services/manufacturing.service.ts`                                                                  | `apps/web/app/.../manufacturing/page.tsx`<br>`packages/ui/.../manufacturing` | Implemented |
| عملیات انبار (Inventory Operations)      | تاریخچه کالا، واحدهای کالا، شمارش دوره‌ای (Cycle count) و سفارش‌دهی مجدد              | `backend/src/services/inventory/cycle-count.service.ts`<br>`backend/src/services/inventory/reorder.service.ts`   | `packages/app-shell/.../inventory-ops/operations-page.tsx`                   | Implemented |

### مدیریت انبار و چند انباری (Warehouse)

- **توضیحات**: مدیریت انبارها، انتقال موجودی بین انبارها و تاریخچه ورود/خروج
- **Backend**: `backend/src/services/warehouse.service.ts`<br>`backend/src/services/warehouse/transfer.service.ts`
- **Frontend**: `apps/web/app/.../warehouse`<br>`packages/ui/.../warehouse`
- **Status**: COMPLETE

### بهای تمام شده موجودی (Inventory Costing)

- **توضیحات**: محاسبه دقیق و لحظه‌ای بهای تمام شده کالای فروش رفته (COGS) و مدیریت ارزش کالاها
- **Backend**: `backend/src/services/inventory-costing/costing.service.ts`<br>`backend/src/routes/inventory-costing.routes.ts`
- **Frontend**: `packages/app-shell/.../inventory-ops`
- **Status**: COMPLETE

### ردیابی و بچ‌نامبر (Traceability)

- **توضیحات**: مدیریت شماره سریال‌ها، بچ‌ها و تاریخ انقضا (Expiry) با تخصیص دقیق
- **Backend**: `backend/src/services/traceability/traceability.service.ts`<br>`backend/src/services/traceability/lot.domain.ts`
- **Frontend**: `packages/ui/.../warehouse-detail/product-expiry-panel.tsx`
- **Status**: COMPLETE

### تصاویر محصول (Product Images)

- **توضیحات**: مدیریت گالری تصاویر هر محصول با ظرفیت تا ۸ عکس و مرتب‌سازی
- **Backend**: `backend/src/services/product-images/product-images.service.ts`
- **Frontend**: `packages/ui/.../warehouse-detail/product-images-panel.tsx`
- **Status**: COMPLETE

### تولید و فرمول ساخت (Manufacturing)

- **توضیحات**: فرآیند تولید محصولات مبتنی بر BOM (دستورالعمل ساخت)، محاسبه هزینه تولید و سابقه تولید
- **Backend**: `backend/src/services/manufacturing.service.ts`
- **Frontend**: `apps/web/app/.../manufacturing/page.tsx`<br>`packages/ui/.../manufacturing`
- **Status**: COMPLETE

### عملیات انبار (Inventory Operations)

- **توضیحات**: تاریخچه کالا، واحدهای کالا، شمارش دوره‌ای (Cycle count) و سفارش‌دهی مجدد
- **Backend**: `backend/src/services/inventory/cycle-count.service.ts`<br>`backend/src/services/inventory/reorder.service.ts`
- **Frontend**: `packages/app-shell/.../inventory-ops/operations-page.tsx`
- **Status**: COMPLETE

## Domain: platform

### ﻿# Platform & Sync Audit

﻿# Platform & Sync Audit

| عنوان                                                                        | توضیحات                                                                                      | Backend                                                                                                         | Frontend                                                                                           | Status      |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| موتور همگام‌سازی (Sync Engine) <br> _Platform / Invisible Capability_        | موتور همگام‌سازی، کنترل همزمانی (Optimistic concurrency)، پردازش idempotent و مکانیسم cursor | `backend/src/services/sync.service.ts`<br>`backend/src/services/sync-stream.ts`                                 | `packages/ui/.../sync-status.tsx`<br>`packages/ui/.../sync-center`<br>`apps/web/.../data-and-sync` | Implemented |
| مدیریت تداخلات (Conflict Resolution) <br> _Platform / Invisible Capability_  | ثبت و رفع تداخلات مربوط به ویرایش‌های آفلاین و اعمال تغییرات تایید شده (Resolutions)         | `backend/src/services/conflict/conflict.service.ts`<br>`backend/src/services/conflict/conflict.domain.ts`       | `packages/ui/.../conflicts`                                                                        | Implemented |
| دسترسی و محیط کار (Workspace & Auth) <br> _Platform / Invisible Capability_  | کنترل دسترسی یکپارچه در سطح Workspace، نقش‌ها و قابلیت‌ها                                    | `backend/src/services/authorization/workspace-access.service.ts`<br>`backend/src/services/workspace.service.ts` | `packages/ui/.../workspace`<br>`packages/ui/.../auth`                                              | Implemented |
| مدیریت شعب (Branch Management) <br> _Platform / Invisible Capability_        | مدیریت ساختار درختی شعب، دسترسی به شعب و scope گزارش‌ها                                      | `backend/src/services/branch/branch.service.ts`<br>`backend/src/services/branch/branch.domain.ts`               | `packages/ui/.../branch`<br>`packages/ui/.../branch-tree-view.tsx`                                 | Implemented |
| مدیریت داده‌های اصلی و ادغام (MDM) <br> _Platform / Invisible Capability_    | پیدا کردن رکوردهای تکراری (Duplicates)، ارزش‌گذاری و ادغام امن رکوردها                       | `backend/src/services/mdm/mdm.service.ts`<br>`backend/src/services/mdm/mdm.domain.ts`                           | -                                                                                                  | Implemented |
| مهاجرت و انتقال داده (Data Migration) <br> _Platform / Invisible Capability_ | ابزار مهاجرت داده‌ها به صورت امن (Validation, Dry run, Commit)                               | `backend/src/services/migration/migration.service.ts`<br>`backend/src/services/migration/migration.validate.ts` | `packages/ui/.../data-migration`                                                                   | Implemented |
| پلتفرم توسعه‌دهندگان (OAuth Platform) <br> _Platform / Invisible Capability_ | ثبت اپلیکیشن‌های OAuth، دریافت توکن (PKCE) و مدیریت دسترسی‌ها (Consent)                      | `backend/src/services/oauth/oauth.service.ts`<br>`backend/src/services/oauth/oauth.domain.ts`                   | `packages/ui/.../developers`<br>`apps/web/.../oauth`                                               | Implemented |

### موتور همگام‌سازی (Sync Engine) Platform / Invisible Capability

- **توضیحات**: موتور همگام‌سازی، کنترل همزمانی (Optimistic concurrency)، پردازش idempotent و مکانیسم cursor
- **Backend**: `backend/src/services/sync.service.ts`<br>`backend/src/services/sync-stream.ts`
- **Frontend**: `packages/ui/.../sync-status.tsx`<br>`packages/ui/.../sync-center`<br>`apps/web/.../data-and-sync`
- **Status**: COMPLETE

### مدیریت تداخلات (Conflict Resolution) Platform / Invisible Capability

- **توضیحات**: ثبت و رفع تداخلات مربوط به ویرایش‌های آفلاین و اعمال تغییرات تایید شده (Resolutions)
- **Backend**: `backend/src/services/conflict/conflict.service.ts`<br>`backend/src/services/conflict/conflict.domain.ts`
- **Frontend**: `packages/ui/.../conflicts`
- **Status**: COMPLETE

### دسترسی و محیط کار (Workspace & Auth) Platform / Invisible Capability

- **توضیحات**: کنترل دسترسی یکپارچه در سطح Workspace، نقش‌ها و قابلیت‌ها
- **Backend**: `backend/src/services/authorization/workspace-access.service.ts`<br>`backend/src/services/workspace.service.ts`
- **Frontend**: `packages/ui/.../workspace`<br>`packages/ui/.../auth`
- **Status**: COMPLETE

### مدیریت شعب (Branch Management) Platform / Invisible Capability

- **توضیحات**: مدیریت ساختار درختی شعب، دسترسی به شعب و scope گزارش‌ها
- **Backend**: `backend/src/services/branch/branch.service.ts`<br>`backend/src/services/branch/branch.domain.ts`
- **Frontend**: `packages/ui/.../branch`<br>`packages/ui/.../branch-tree-view.tsx`
- **Status**: COMPLETE

### مدیریت داده‌های اصلی و ادغام (MDM) Platform / Invisible Capability

- **توضیحات**: پیدا کردن رکوردهای تکراری (Duplicates)، ارزش‌گذاری و ادغام امن رکوردها
- **Backend**: `backend/src/services/mdm/mdm.service.ts`<br>`backend/src/services/mdm/mdm.domain.ts`
- **Frontend**: -
- **Status**: COMPLETE

### مهاجرت و انتقال داده (Data Migration) Platform / Invisible Capability

- **توضیحات**: ابزار مهاجرت داده‌ها به صورت امن (Validation, Dry run, Commit)
- **Backend**: `backend/src/services/migration/migration.service.ts`<br>`backend/src/services/migration/migration.validate.ts`
- **Frontend**: `packages/ui/.../data-migration`
- **Status**: COMPLETE

### پلتفرم توسعه‌دهندگان (OAuth Platform) Platform / Invisible Capability

- **توضیحات**: ثبت اپلیکیشن‌های OAuth، دریافت توکن (PKCE) و مدیریت دسترسی‌ها (Consent)
- **Backend**: `backend/src/services/oauth/oauth.service.ts`<br>`backend/src/services/oauth/oauth.domain.ts`
- **Frontend**: `packages/ui/.../developers`<br>`apps/web/.../oauth`
- **Status**: COMPLETE

## Domain: purchasing

### 1

1

- **عنوان**: مدیریت سفارش‌های خرید (Purchase Orders)
- **توضیحات**: فرآیند ثبت، به‌روزرسانی، مشاهده و اعلام دریافت کالا (Receive Goods) برای سفارش‌های خرید. طبق رویکرد معماری جدید سیستم، فرم‌ها و نماهای مربوط به سفارش‌های خرید با بخش فاکتورها (Sales/Purchase Invoices) یکپارچه شده‌اند.
- **Backend**: بله (مسیر `/api/purchase-orders` از جمله متدهای GET، POST، PATCH و POST برای `receive` در `purchasing.routes.ts`).
- **Frontend**: بله (هوک‌های `usePurchaseOrders`, `usePurchaseOrder`, `useReceiveGoods` وجود دارند. صفحه مستقل `/purchasing` طبق مستندات UX Audit به صورت یکپارچه به عنوان تبی در `/invoices` و از طریق فرم `Quick Invoice` استفاده می‌شود).
- **Status**: پیاده‌سازی شده (یکپارچه با فرم‌های صورت‌حساب).

### 2

2

- **عنوان**: مدیریت تأمین‌کنندگان (Suppliers)
- **توضیحات**: ثبت، لیست کردن، ویرایش و مشاهده نمای ۳۶۰ درجه تأمین‌کنندگان. هیچ تأمین‌کننده‌ای به طور کامل حذف (Delete) نمی‌شود تا تاریخچه مالی از بین نرود (فقط غیرفعال می‌شود). همچنین در سیستم قابلیت لینک کردن مشتری به تأمین‌کننده (هنگامی که شخص همزمان خریدار و فروشنده است) وجود دارد.
- **Backend**: بله (مسیر `/api/suppliers` با قابلیت گرفتن اطلاعات کلی و نمای 360 درجه مالی در `supplier.routes.ts`).
- **Frontend**: بله (جستجوی تأمین‌کنندگان در فرم‌های فاکتور خرید و قابلیت پیوند تأمین‌کننده به مشتری در `customer-profile-panel.tsx`).
- **Status**: پیاده‌سازی شده.

### 3

3

- **عنوان**: هوش و تحلیل ریسک تأمین‌کنندگان (Supplier Intelligence)
- **توضیحات**: یک موتور محاسباتی (N22) برای تعیین میزان ریسک تأمین‌کنندگان بدون نیاز به داده‌های خارجی. این سرویس بر اساس سابقه خرید فروشگاه مواردی از قبیل تأخیر در تحویل (Late Delivery)، تغییرات قیمت (Price Drift)، خریدهای دریافت نشده (Unreceived) و تمرکز/وابستگی بیش از حد به یک تأمین‌کننده (Concentration) را آنالیز می‌کند.
- **Backend**: بله (پیاده‌سازی در `supplier-intelligence.domain.ts` با تعیین دقیق سیگنال‌های ریسک).
- **Frontend**: بله (نمایش دلایل و مقادیر تاخیر و ریسک در بخش `analysis-container.tsx`).
- **Status**: به طور کامل در Backend پیاده‌سازی شده و در داشبورد تحلیل‌ها استفاده می‌شود.

### 4

4

- **عنوان**: پیشنهاد سفارش مجدد (Reorder Suggestions)
- **توضیحات**: ارزیابی مقدار موجودی و فروش کالا در بازه زمانی مشخص برای پیشنهاد دادن اقلامی که نیاز به شارژ مجدد دارند. این سرویس پیشنهاد سفارش را ارائه می‌دهد ولی به صورت خودکار PO ایجاد نمی‌کند. مقادیر در-سفارش (onOrder) به دلیل نبود مکانیزم جزئی در پایگاه داده صفر در نظر گرفته می‌شوند (رویکرد محافظه‌کارانه).
- **Backend**: بله (سرویس `reorder.service.ts` با متدهای محاسبه L3 Suggestions و L4 Dead Stock).
- **Frontend**: نامشخص (احتمالاً در بخش گزارشات یا انبار پیاده شده است).
- **Status**: بک‌اند کامل است و به صورت خواندنی (Read-only) پیشنهاد می‌دهد.

### 5

5

- **عنوان**: سفارشات فروش / استورفرانت (Storefront / Sales Orders)
- **توضیحات**: اگرچه دامنه اصلی مرتبط با خرید است، اما ماژول Orders (شامل مسیرهای `orders.routes.ts` و فایل‌های فرانت‌اند `orders-page.tsx`) عملیات ثبت، تایید، لغو، تحقق و فاکتور کردن سفارش‌های فروش (معمولاً مشتریان از فروشگاه) را هندل می‌کند.
- **Backend**: بله (مسیرهای `/api/orders` و مدیریت تنظیمات استورفرانت).
- **Frontend**: بله (صفحه مدیریت سفارش‌ها در داشبورد با وضعیت‌های گوناگون).
- **Status**: پیاده‌سازی شده و فعال.

## Domain: reports

### 1. Saved Reports

1. Saved Reports

- **عنوان**: Saved Reports (گزارش‌های ذخیره‌شده)
- **توضیحات**: A feature allowing users to define and save dynamic queries (specifying dataset, groupings, and measures). No results are stored; reports pull live data when executed.
- **Backend**: `backend/src/services/reporting/report.service.ts`, `backend/src/services/reporting/dataset.domain.ts`, `docs/saved-reports-01-migration.sql` (Table: `public.saved_reports`)
- **Frontend**: `packages/ui/src/components/ui/analysis/report-builder.tsx`, `packages/ui/src/components/ui/analysis/report-run-view.tsx`
- **Status**: Implemented

### 2. Report Dashboards

2. Report Dashboards

- **عنوان**: Report Dashboards (داشبوردهای تحلیلی)
- **توضیحات**: Arrangements of saved reports into tiles across a grid layout. Users arrange predefined reports dynamically. Like reports, dashboards pull live data at runtime and are versioned by replacing them.
- **Backend**: `backend/src/services/reporting/dashboard.service.ts`, `docs/report-dashboards-01-migration.sql` (Table: `public.report_dashboards`)
- **Frontend**: `packages/ui/src/components/ui/analysis/dashboard-builder.tsx`, `packages/ui/src/components/ui/analysis/analysis-container.tsx`
- **Status**: Implemented

### 3. AI Insights

3. AI Insights

- **عنوان**: AI Insights (بینش هوش مصنوعی)
- **توضیحات**: AI-generated intelligence and automated analysis of reporting datasets, producing insights that guide user decisions.
- **Backend**: `backend/src/services/insights/insights.service.ts`, `backend/src/services/ai/reporting-reader.ts`
- **Frontend**: `packages/ui/src/components/ui/dashboard/ai-insights.tsx`
- **Status**: Implemented

### 4. Operational & Profit Reports

4. Operational & Profit Reports

- **عنوان**: Operational & Profit Reports (گزارش‌های عملیاتی و سود و زیان)
- **توضیحات**: Specialized accounting/financial calculations to report on profit, income, and overall operational balance.
- **Backend**: `backend/src/services/accounting/profit-report.domain.ts`, `backend/src/services/accounting/operational-reports.ts`
- **Frontend**: `packages/ui/src/components/ui/accounting/tabs/IncomeStatementTab.tsx`, `packages/ui/src/components/ui/accounting/AccountingPage.tsx`
- **Status**: Implemented

### 5. Analytics & KPIs

5. Analytics & KPIs

- **عنوان**: General Analytics & KPIs (تحلیل‌های عمومی و شاخص‌ها)
- **توضیحات**: Dashboards containing key performance indicators, benchmarks, breakeven analysis, and high-level charts.
- **Backend**: `backend/src/services/analysis/analysis.service.ts`, `backend/src/services/analytics/benchmark.domain.ts`, `backend/src/services/analytics/break-even.domain.ts`
- **Frontend**: `packages/ui/src/components/ui/dashboard/dashboard-stats.tsx`, `packages/ui/src/components/ui/dashboard/dashboard-view.tsx`
- **Status**: Implemented

## Domain: sales-pos

### 1. Invoices (فاکتور فروش و خرید)

1. Invoices (فاکتور فروش و خرید)
   عنوان: Invoicing (فاکتور فروش و خرید)
   توضیحات: صدور و مدیریت فاکتورهای فروش و خرید، به‌روزرسانی خودکار موجودی کالا (Stock Movements)، و رهگیری وضعیت پرداخت‌ها (Settlement Status).
   چه کاری از صاحب کسب‌وکار را آسان کرده: پیگیری فاکتورهای پرداخت‌نشده، محاسبه خودکار مانده و کسر موجودی از انبار بدون نیاز به ثبت دستی حواله.
   الگوریتم / منطق کاری در Hisabche: یک فاکتور می‌تواند `sale` یا `purchase` باشد. وضعیت `status` (مثل 'paid') دارد و بر اساس پرداخت‌ها (allocations) `settlement_status` آپدیت می‌شود. موجودی کالا به‌صورت خودکار بر اساس `invoice_items` کم یا زیاد می‌شود. فرمول reversal برای برگشت انبار (netReversal) به‌کار گرفته می‌شود.
   نتیجه برای کسب‌وکار: دقت بالا در حسابداری و انبارگردانی بدون خطای انسانی در ثبت دوباره.
   نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/(dashboard)/invoices
   Backend: backend/src/services/invoices/invoice-related.service.ts, backend/src/services/invoices/outstanding.domain.ts
   Frontend: apps/web/app/[lang]/(dashboard)/invoices/page.tsx
   API: Fastify REST endpoints in `backend/src/routes/invoice.routes.ts` (GET/POST/PATCH /api/invoices)
   Data / DB: invoices, invoice_items, payment_allocations, journal_entries
   Tests: invoice-derived-money.test.ts, invoice-edit-rules.test.ts, outstanding-predicate.test.ts
   Status: COMPLETE
   زاویه فروش: اتوماسیون کامل بین فروش، انبار و حسابداری در یک کلیک.
   مشکل مشتری که حل می‌کند: گم شدن فاکتورها، مغایرت انبار، فراموشی پیگیری مطالبات.
   مناسب برای چه نوع کسب‌وکاری: عمده‌فروشی‌ها، شرکت‌های خدماتی و بازرگانی.
   Feature Relationships: وابسته به انبار (Inventory)، مشتریان (CRM) و پرداخت‌ها (Payments).
   NEXT_HOOK: اتصال به Portal برای پرداخت آنلاین فاکتور.
   زبان اثبات (برای دمو): "ببینید چطور با ثبت یک فاکتور، هم موجودی انبار کم میشه و هم سند حسابداریش اتوماتیک میخوره."
   Evidence: outstanding.domain.ts references trigger from payment_allocations. stock-reversal.domain.ts reverses stock on invoice edit.
   Business Value: 5
   Demo Value: 5
   Differentiation: 4
   Frequency of Use: 5
   Sales Impact: 5

---

### 2. POS / Till (صندوق فروشگاهی)

2. POS / Till (صندوق فروشگاهی)
   عنوان: POS / Till (صندوق فروشگاهی)
   توضیحات: ماژول فروشگاهی با مدیریت شیفت (Session)، محاسبه موجودی کشو (Drawer Ledger) و مغایرت‌گیری (Variance).
   چه کاری از صاحب کسب‌وکار را آسان کرده: بستن روزانه صندوق، محاسبه دقیق پولی که باید در کشو باشد، و جداسازی فروش نقد از نسیه و کارت.
   الگوریتم / منطق کاری در Hisabche: مفهوم Session که با `openingFloat` (پول خرد اول روز) شروع می‌شود. سیستم تمام دریافتی‌های نقدی (sales, cash_in, settlements) را جمع و پرداختی‌ها را کسر می‌کند تا `expectedCash` به‌دست آید. صندوقدار پول موجود را می‌شمارد (`countedCash`) و اختلاف با `expectedCash` در سیستم به عنوان `varianceMinor` ثبت می‌شود تا مغایرت‌ها شفاف شود.
   نتیجه برای کسب‌وکار: جلوگیری از دزدی یا اشتباهات صندوق، رهگیری دقیق جریانات نقدی روزانه.
   نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/(dashboard)/till/page.tsx
   Backend: backend/src/services/pos/pos.domain.ts, backend/src/services/pos/pos.service.ts
   Frontend: apps/web/app/[lang]/(dashboard)/till/page.tsx
   API: pos.service.ts methods
   Data / DB: pos_sessions, pos_orders, cash_movements
   Tests: pos-rules.test.ts, till-settlement-drawer.test.ts, offline-pos-conflict.test.ts
   Status: COMPLETE
   زاویه فروش: کنترل دقیق صندوقداران و بستن شیفت بدون استرس کسری صندوق.
   مشکل مشتری که حل می‌کند: مغایرت‌های روزانه صندوق و مشخص نبودن دلیل کسری یا اضافه‌آوردن پول.
   مناسب برای چه نوع کسب‌وکاری: خرده‌فروشی‌ها، فروشگاه‌ها، سوپرمارکت‌ها.
   Feature Relationships: به Inventory (کاهش آنی موجودی)، Payments و Invoices متصل است.
   NEXT_HOOK: گزارش روزانه شیفت و مقایسه عملکرد صندوقداران.
   زبان اثبات (برای دمو): "در پایان روز، سیستم بهتون میگه دقیقا چقدر باید تو کشو پول باشه و کسری یا اضافات رو با دقت یک ریال ثبت میکنه."
   Evidence: pos.domain.ts (buildDrawerLedger, buildPosting) handles cashMinor, varianceMinor, expectedCashMinor.
   Business Value: 5
   Demo Value: 5
   Differentiation: 4
   Frequency of Use: 5
   Sales Impact: 5

---

### 3. Payments & Customer 360

3. Payments & Customer 360
   عنوان: Payments & Customer 360 (مدیریت دریافت/پرداخت و پروفایل مالی مشتری)
   توضیحات: ثبت دریافت‌ها و پرداخت‌ها، تخصیص به فاکتورها، گزارش‌گیری عمر بدهی‌ها (Aging) و صورت‌حساب مشتری (Party Ledger / Statement).
   چه کاری از صاحب کسب‌وکار را آسان کرده: دید جامع ۳۶۰ درجه به هر مشتری، تشخیص اینکه چه کسی بدهکارتر است و پیگیری مطالبات.
   الگوریتم / منطق کاری در Hisabche: مشتری `openingBalance` دارد. تراکنش‌ها شامل Invoices و Payments با هم ترکیب شده و یک دفتر کل (Ledger) با `runningLedger` می‌سازند. مانده در لحظه (netBalance) و عمر بدهی (AgingBuckets: 1-30, 31-60, ...) محاسبه می‌شود. `rankPartyProducts` محصولاتی که مشتری بیشتر خریده را استخراج می‌کند.
   نتیجه برای کسب‌وکار: وصول سریع‌تر مطالبات، کاهش ریسک اعتباری مشتریان، شناخت بهتر الگوهای خرید.
   نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/(dashboard)/customers/[id]/page.tsx
   Backend: backend/src/services/payments/payments.service.ts, backend/src/services/payments/payments.domain.ts
   Frontend: apps/web/app/[lang]/(dashboard)/customers/[id]/page.tsx
   API: getAging, getPartyLedger, getPartySummary, getPartyActivity
   Data / DB: payments, payment_allocations, invoices, customers
   Tests: party-ledger.test.ts, party-summary.test.ts, payments-ar-ap-rules.test.ts, customer-debt-report.test.ts
   Status: COMPLETE
   زاویه فروش: صورت‌حساب لحظه‌ای و هوشمند که نه‌تنها مانده، بلکه محصولات محبوب مشتری را هم نشان می‌دهد.
   مشکل مشتری که حل می‌کند: دعوا با مشتری سر مانده‌حساب، از دست دادن مشتریان خوب به دلیل فراموشی، رسوب سرمایه در مطالبات سوخت‌شده.
   مناسب برای چه نوع کسب‌وکاری: همه کسب‌وکارهای B2B و B2C که فروش اعتباری/نسیه دارند.
   Feature Relationships: وابسته به Invoices و Customers.
   NEXT_HOOK: ارسال اتوماتیک پیامک سررسید بدهی.
   زبان اثبات (برای دمو): "شما با باز کردن پروفایل مشتری نه‌تنها می‌بینید چقدر بدهکاره و چند روزه که پول نداده، بلکه می‌فهمید بیشتر چه کالاهایی رو ازتون خریده."
   Evidence: summarizeParty, ageInvoices, getPartyLedger in payments.domain.ts and payments.service.ts.
   Business Value: 5
   Demo Value: 5
   Differentiation: 5
   Frequency of Use: 5
   Sales Impact: 5

---

### 4. Customer Portal

4. Customer Portal
   عنوان: Customer Portal (پورتال اختصاصی مشتری)
   توضیحات: ساخت لینک امن و عمومی (Token-based) برای هر مشتری تا بتواند فاکتورها، مانده حساب، پرداخت‌ها و سفارشات خود را آنلاین ببیند.
   چه کاری از صاحب کسب‌وکار را آسان کرده: کاهش تماس‌های مشتریان برای پرسیدن "حساب من چقدره؟" یا "فاکتور منو بفرست".
   الگوریتم / منطق کاری در Hisabche: سرویس `createLink` یک توکن ۶۴ کاراکتری یک‌بارمصرف یا دارای تاریخ انقضا می‌سازد. ویوی پورتال با `view(token)` کار می‌کند که در آن اطلاعات `balance`، لیستی از `invoices`، `payments` و `orders` واکشی می‌شود و همچنین `isDebtor` بودن مشتری مشخص می‌گردد. لینک در دیتابیس با `last_used_at` آپدیت می‌شود تا فروشنده بداند مشتری کی پورتال را دیده است.
   نتیجه برای کسب‌وکار: پرستیژ بالاتر کسب‌وکار، شفافیت بی‌نظیر با مشتریان و صرفه‌جویی شدید در وقت حسابدار.
   نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/portal/[token]/page.tsx
   Backend: backend/src/services/customer-portal/customer-portal.service.ts
   Frontend: apps/web/app/[lang]/portal/layout.tsx, apps/web/app/[lang]/portal/[token]/page.tsx
   API: createLink, view, listLinks, revokeLink
   Data / DB: customer_portal_links, invoices, payments, sales_orders
   Tests: customer-portal.test.ts
   Status: COMPLETE
   زاویه فروش: دادن یک پنل حرفه‌ای به مشتریان شما، بدون نیاز به نصب هیچ اپلیکیشنی از سمت آن‌ها.
   مشکل مشتری که حل می‌کند: پاسخگویی مداوم به درخواست‌های تکراری ارسال صورت‌حساب.
   مناسب برای چه نوع کسب‌وکاری: کسب‌وکارهای خدماتی، عمده‌فروشی‌ها، شرکت‌های پخش.
   Feature Relationships: وابسته به Invoices, Payments, Customers.
   NEXT_HOOK: امکان پرداخت مستقیم از داخل پورتال (Payment Gateway Integration).
   زبان اثبات (برای دمو): "یک لینک به مشتری میدید، خودش باز میکنه و تمام فاکتورها و پرداختی‌هاش رو همراه با مانده حسابش زنده می‌بینه."
   Evidence: createLink, view methods in customer-portal.service.ts. customer_portal_links table with expires_at and revoked_at.
   Business Value: 4
   Demo Value: 5
   Differentiation: 5
   Frequency of Use: 3
   Sales Impact: 4
