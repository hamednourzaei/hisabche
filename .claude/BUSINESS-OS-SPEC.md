# HISABCHE — BUSINESS OS SPEC

> تاریخ: ۳۰ سپتامبر ۲۰۲۶ · مبنا: استخراج ۴۸ Engine از کد واقعی ریپو
> این سند **نقشه** است. قوانین اجرا در `BUSINESS-OS-EXECUTION.md`.

---

## ۰. اصل حاکم

۱۵۰ قابلیت، **۱۵۰ سرویس نیست**. هر قابلیت روی یک Engine موجود سوار می‌شود، یا
یک Engine مشترکِ جدید می‌سازد که چند قابلیت از آن استفاده کنند.

```
۱۵۰ قابلیت  →  ۱۲ Engine جدیدِ مشترک  +  ۲۰ Engine موجودِ گسترش‌یافته
```

اگر روزی تعداد سرویس‌های جدید از تعداد قابلیت‌های کمتر نشد، یعنی اشتباه شده‌ایم.

---

## ۱. تصحیح‌های لازم نسبت به استخراج اول

سه چیز در بازبینی کد پیدا شد که status قبلی را تغییر می‌دهد:

| ادعا                                 | واقعیت                                                                                                                               | اثر                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| SoD «۲ از ۵ قانون هرگز فعال نمی‌شود» | قانونین در J5 **حذف** شدند، نه اینکه معیوب بمانند. الان ۴ قانون است و `sod-rule-coverage.test.ts` هر ۴ را در **دو سر** assert می‌کند | SoD از PARTIAL به **COMPLETE** ارتقا؛ ریسک از باقی‌مانده حذف شد |
| Escalation «PARTIAL»                 | `shouldEscalate`/`escalatedRole` هیچ caller ندارند — منطق نوشته شده، اجرا نمی‌شود                                                    | Escalation یک قابلیت **واقعاً غایب** است (#68)                  |
| Background Work «۳ مکانیزم»          | `queue.ts` یک in-process array است با **صفر caller**؛ `queue/pdf-queue.ts` یک BullMQ جدا با Redis خودش                               | ۴ مکانیزم، و ۲ تای آن مرده یا موازی                             |

**قاعده‌ای که از این بیرون می‌آید:** «تابع هست ولی caller ندارد» یک قابلیت
نیست. Escalation در جدول زیر «ندارد» است، نه «دارد ولی ناقص».

---

## ۲. Engine Ledger — وضعیت واقعی امروز

۴۸ Engine. ستون «قابلیت #» یعنی کدام شماره‌های ۱۵۰گانه روی این Engine سوار می‌شوند.

### ۲.۱ Financial Core

| Engine                | وضعیت    | مسیر                                                                               | قابلیت‌ها                 |
| --------------------- | -------- | ---------------------------------------------------------------------------------- | ------------------------- |
| Ledger / Journal      | COMPLETE | `services/accounting/accounting.{domain,service,repository}.ts` + `ledger.port.ts` | — (زیربنای ۲،۳۲،۶۵،۶۹،۷۰) |
| Tax                   | COMPLETE | `services/tax/tax.domain.ts`                                                       | ۶۵                        |
| FX / Revaluation      | COMPLETE | `services/currency/revaluation.domain.ts`                                          | ۱۲۱                       |
| Payroll Ledger        | PARTIAL  | `services/payroll/payroll-ledger.domain.ts`                                        | ۹۹                        |
| Fixed Assets          | PARTIAL  | `services/assets/` + `depreciation.domain.ts`                                      | ۱۲۷، ۷۰                   |
| Accounting Dimensions | PARTIAL  | `services/dimensions/dimension.domain.ts`                                          | ۳۲                        |
| Year-End Close        | COMPLETE | `services/accounting/year-end.domain.ts`                                           | ۶۹                        |
| Costing               | COMPLETE | `services/inventory-costing/costing.domain.ts`                                     | ۱۲۹، ۱۳۲، ۱۳۳             |

### ۲.۲ Commerce

| Engine                        | وضعیت        | مسیر                                                          | قابلیت‌ها                        |
| ----------------------------- | ------------ | ------------------------------------------------------------- | -------------------------------- |
| Invoice Orchestration         | COMPLETE     | `services/invoice.service.ts` (۳۰۱۱ خط)                       | ۳۹ (partial)                     |
| Payment / Settlement          | COMPLETE     | `services/payments/`                                          | ۱۲۳، ۱۲۴                         |
| Customer 360                  | FRAGMENTED   | `payments.domain.summarizeParty` + `customer-profile` + `crm` | ۳، ۱۰، ۱۳، ۱۸، ۱۰۷               |
| Customer Profile              | PARTIAL      | `services/customer-profile/`                                  | ۹ (سقف اعتبار)                   |
| MDM                           | COMPLETE     | `services/mdm/mdm.domain.ts`                                  | ۱۴ (تشخیص خطای داده)             |
| CRM                           | COMPLETE     | `services/crm/` + `crm.port.ts`                               | ۱۰۶، ۱۰۷، ۱۱۱، ۱۱۲               |
| Sales Order Lifecycle         | PARTIAL      | `services/orders/`                                            | ۱۱۳، ۲۲                          |
| Timesheet Billing             | PARTIAL      | `services/timesheets/billing.domain.ts`                       | ۹۸                               |
| Pricing / Promotion / Loyalty | ❌ **ندارد** | —                                                             | ۱۹، ۱۱۴، ۱۱۵، ۱۱۶، ۱۱۷، ۱۲۰، ۱۰۹ |
| Commission                    | ❌ **ندارد** | —                                                             | —                                |
| Installment / BNPL            | ❌ **ندارد** | —                                                             | ۱۲۳، ۱۲۴                         |

### ۲.۳ Treasury

| Engine              | وضعیت        | مسیر                                        | قابلیت‌ها    |
| ------------------- | ------------ | ------------------------------------------- | ------------ |
| Till / Cash         | COMPLETE     | `services/pos/pos.domain.ts`                | ۵۶           |
| Bank Reconciliation | PARTIAL      | `services/banking/reconciliation.domain.ts` | ۵۵، ۶۲       |
| Collections         | ❌ **ندارد** | —                                           | ۵۱، ۵۳       |
| Cash Forecast       | PARTIAL      | `services/intelligence/forecast.domain.ts`  | ۵ (۱۳ هفته)  |
| Working Capital     | ❌ **ندارد** | —                                           | ۳۸، ۱۲۵، ۱۲۶ |
| Loans / Investments | ❌ **ندارد** | —                                           | ۱۲۵، ۱۲۶     |
| Payment Scheduling  | ❌ **ندارد** | —                                           | ۶۶           |

### ۲.۴ Inventory & Supply Chain

| Engine                   | وضعیت        | مسیر                                             | قابلیت‌ها   |
| ------------------------ | ------------ | ------------------------------------------------ | ----------- |
| Stock Movement           | COMPLETE     | trigger `stock_movements_project`                | —           |
| Multi-Warehouse          | PARTIAL      | `services/inventory/warehouse-summary.domain.ts` | —           |
| Traceability             | COMPLETE     | `services/traceability/lot.domain.ts`            | —           |
| Unit Conversion          | COMPLETE     | `services/inventory/unit-conversion.domain.ts`   | —           |
| Cycle Count              | PARTIAL      | `services/inventory/cycle-count.service.ts`      | —           |
| Reorder / Dead Stock     | PARTIAL      | `services/inventory/reorder.domain.ts`           | ۶۰          |
| Stock Transfer           | PARTIAL      | `services/warehouse/transfer.service.ts`         | —           |
| Procurement Approval     | PARTIAL      | `purchasing.service` + `BudgetService`           | ۵۹، ۱۵      |
| Supplier Intelligence    | ❌ **ندارد** | —                                                | ۱۰، ۱۹، ۱۳۵ |
| RMA / Warranty / Quality | ❌ **ندارد** | —                                                | —           |
| Landed Cost              | ❌ **ندارد** | `repost.domain.ts` has a stub                    | —           |
| MRP / Capacity           | ❌ **ندارد** | —                                                | —           |
| RFQ / Vendor Quote       | ❌ **ندارد** | —                                                | ۱۵          |
| Bin / Location           | ❌ **ندارد** | —                                                | —           |

### ۲.۵ Manufacturing

| Engine                   | وضعیت        | مسیر                                           | قابلیت‌ها |
| ------------------------ | ------------ | ---------------------------------------------- | --------- |
| Manufacturing            | COMPLETE     | `services/manufacturing.service.ts`            | ۱۳، ۱۴    |
| BOM                      | PARTIAL      | `boms` + `bom_items` + `manufacturing.service` | —         |
| Production Costing       | PARTIAL      | via `CostingPort` (issue + receive)            | —         |
| MRP / Capacity / Quality | ❌ **ندارد** | —                                              | —         |

### ۲.۶ Security

| Engine                 | وضعیت        | مسیر                                             | قابلیت‌ها       |
| ---------------------- | ------------ | ------------------------------------------------ | --------------- |
| Tenancy Resolution     | COMPLETE     | `services/tenancy.service.ts`                    | —               |
| Authorization          | COMPLETE     | `services/authorization/authorization.domain.ts` | ۹۱، ۹۳، ۹۴، ۱۰۵ |
| Segregation of Duties  | **COMPLETE** | `services/authorization/sod.domain.ts`           | ۱۰۵             |
| Credential (API/OAuth) | COMPLETE     | `services/developer/` + `services/oauth/`        | ۱۳۶–۱۴۰         |

### ۲.۷ Control Plane

| Engine                  | وضعیت        | مسیر                                      | قابلیت‌ها           |
| ----------------------- | ------------ | ----------------------------------------- | ------------------- |
| Budget                  | COMPLETE     | `services/budgeting/budget.domain.ts`     | ۱۲۸، ۶۰، ۵۹         |
| Approval Routing & Gate | PARTIAL      | `services/workflow/`                      | ۱۰۴، ۵۴، ۶۷، ۶۸     |
| Rules Engine            | PARTIAL      | `services/rules/rules.domain.ts`          | ۶۷، ۱۵، ۱۹، ۱۵      |
| Event Fan-out           | COMPLETE     | `services/event-log.service.ts`           | ۵۷، ۵۸، ۶۳، ۶۴، ۱۱۲ |
| Notification            | COMPLETE     | `services/notification.service.ts`        | ۵۱، ۵۲، ۵۷          |
| Scheduler               | COMPLETE     | `services/distributed-work.ts`            | ۵۸، ۶۹، ۱۱۲         |
| Email Outbox            | COMPLETE     | `services/email-outbox.ts`                | ۵۰، ۱۴۳             |
| **Escalation**          | ❌ **ندارد** | منطق هست، صفر caller                      | ۶۸                  |
| **Action Executor**     | ❌ **ندارد** | —                                         | ۶۳، ۶۴، ۵۹          |
| **Compensation / Undo** | ❌ **ندارد** | —                                         | ۸۱                  |
| **Mention / Comment**   | ❌ **ندارد** | `blog_comments` فقط                       | ۸۵                  |
| **Saved Views**         | PARTIAL      | `ui-contract/list-engine.ts` — فقط کلاینت | ۸۷، ۸۸، ۸۹          |

### ۲.۸ Intelligence

| Engine                 | وضعیت        | مسیر                                       | قابلیت‌ها       |
| ---------------------- | ------------ | ------------------------------------------ | --------------- |
| AI Reporting Boundary  | COMPLETE     | `services/ai/reporting-reader.ts`          | —               |
| Insight / Anomaly      | PARTIAL      | `services/insights/insights.domain.ts`     | ۳، ۴، ۷، ۱۴، ۲۰ |
| Forecast               | PARTIAL      | `services/intelligence/forecast.domain.ts` | ۵، ۱۱، ۱۲، ۱۲۹  |
| OCR                    | ❌ **ندارد** | N2 صریحاً OUT OF SCOPE شده                 | ۱۶، ۴۸          |
| Document Translation   | ❌ **ندارد** | —                                          | ۲۰              |
| Voice Summary          | ❌ **ندارد** | —                                          | ۸               |
| Scenario Planning      | ❌ **ندارد** | —                                          | ۱۳۴             |
| Benchmarking           | ❌ **ندارد** | —                                          | ۱۳۵             |
| Cohort Analysis        | ❌ **ندارد** | —                                          | ۱۳۰             |
| Break-Even             | ❌ **ندارد** | —                                          | ۱۳۳             |
| Expense Categorization | ❌ **ندارد** | —                                          | ۱۵              |

### ۲.۹ Platform

| Engine                       | وضعیت        | مسیر                                         | قابلیت‌ها      |
| ---------------------------- | ------------ | -------------------------------------------- | -------------- |
| Subscription / Billing       | COMPLETE     | `services/billing.service.ts`                | ۱۱۸، ۱۳۹، ۱۵۰  |
| Wallet                       | PARTIAL      | `services/wallet/wallet.service.ts`          | —              |
| Referral                     | COMPLETE     | `services/referral/`                         | ۱۱۰            |
| Sandbox                      | COMPLETE     | `services/developer/sandbox.service.ts`      | ۱۴۰            |
| Developer Platform           | COMPLETE     | `services/developer/`                        | ۱۳۷، ۱۳۸، ۱۴۷  |
| OAuth / Marketplace          | COMPLETE     | `services/oauth/`                            | ۱۳۶، ۱۴۹       |
| Data Migration               | COMPLETE     | `services/migration/`                        | ۳۶، ۳۸، ۳۹، ۴۷ |
| Backup                       | COMPLETE     | `services/workspace/backup.service.ts`       | ۳۷، ۶۱، ۴۴     |
| **Connector Framework**      | ❌ **ندارد** | —                                            | ۲۱–۳۵، ۱۳۲     |
| **Custom Objects / Fields**  | ❌ **ندارد** | `metadata.entity_catalog` فقط کاتالوگ است    | ۱۴۱، ۱۴۲، ۱۴۳  |
| **Workflow Builder**         | ❌ **ندارد** | `workflow.service` CRUD است، builder نیست    | ۱۴۴            |
| **Report/Dashboard Builder** | ❌ **ندارد** | —                                            | ۱۴۵، ۱۴۶       |
| **White Label**              | PARTIAL      | رنگ/لوگو در سفارشی‌سازی هست، دامنه/کامل نیست | ۹۵، ۹۶، ۱۴۸    |

### ۲.۱۰ Sync

| Engine              | وضعیت    | مسیر                       | قابلیت‌ها |
| ------------------- | -------- | -------------------------- | --------- |
| Sync Engine         | PARTIAL  | `services/sync.service.ts` | —         |
| Conflict Resolution | COMPLETE | `services/conflict/`       | —         |
| Money Cache         | COMPLETE | `utils/money-cache.ts`     | —         |

### ۲.۱۱ Organization

| Engine         | وضعیت        | مسیر                                          | قابلیت‌ها   |
| -------------- | ------------ | --------------------------------------------- | ----------- |
| Branch         | COMPLETE     | `services/branch/`                            | —           |
| Team / Payroll | PARTIAL      | `services/human-resources.service.ts`         | ۹۸، ۹۹، ۱۰۲ |
| Shift          | PARTIAL      | `phase-m-01` اجرا شد ولی `pos_shift` یافت نشد | ۱۰۰، ۱۰۱    |
| Attendance     | ❌ **ندارد** | —                                             | ۱۰۰         |
| Task           | COMPLETE     | `routes` + `crm`                              | ۱۰۲، ۱۰۳    |
| Custom Roles   | PARTIAL      | `role-capabilities.service`                   | ۹۱          |

---

## ۳. شمارش

| دسته                         | تعداد  |
| ---------------------------- | ------ |
| Engine موجود                 | ۴۸     |
| Engine موجودِ COMPLETE       | ۲۶     |
| Engine موجودِ PARTIAL        | ۱۸     |
| Engine موجودِ FRAGMENTED     | ۱      |
| **Engine جدیدِ لازم**        | **۲۲** |
| قابلیت ۱۵۰گانه               | ۱۵۰    |
| قابلیتِ «کاملاً جدید»        | ۷۱     |
| قابلیتِ «تکمیل قابلیت موجود» | ۷۹     |

**۲۲ Engine جدید برای ۱۵۰ قابلیت.** نسبت ۶٫۸ به ۱. اگر این نسبت از ۱ بالاتر برود،
یعنی capability‌ها را به‌جای ساختن روی Engine موجود، جدا ساخته‌ایم.

---

## ۴. ۲۲ Engine جدید — فهرست با دلیل

هر کدام باید با **شاهد کد** توجیه شود (یک Engine جدید بدون شاهد = G4).

| #   | Engine جدید                        | قابلیت‌ها              | شاهدِ نیاز                                                                                                                                                                                        |
| --- | ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | **Pricing & Promotion**            | ۱۹، ۱۱۴، ۱۱۵، ۱۱۶، ۱۲۰ | `computeInvoiceMoney` قیمت خط را از `items[].price` می‌گیرد؛ هیچ لایه‌ای قیمت پایه/تخفیف پلکانی ندارد. Rules Engine یک تخفیف _پیشنهاد_ می‌کند ولی قیمت‌گذاری را نمی‌تواند اجرا کند (خودش می‌گوید) |
| N2  | **Collections**                    | ۵۱، ۵۳، ۱۰             | `ageInvoices` فقط bucket می‌سازد؛ هیچ نوبت‌بندی، هیچ یادآوری، هیچ promise-to-pay                                                                                                                  |
| N3  | **Working Capital & Financing**    | ۳۸، ۱۲۵، ۱۲۶           | فقط `accountRootTypes` وجود دارد؛ هیچ ساختاری برای وام/سرمایه‌گذاری نیست                                                                                                                          |
| N4  | **Installment / BNPL**             | ۱۲۳، ۱۲۴               | `PaymentDirection` فقط `'in'\|'out'`؛ برنامه‌ی اقساطی در `TASKS-UI-AND-PRODUCT.md` صریحاً STOP CONDITION شد                                                                                       |
| N5  | **Connector Framework**            | ۲۱–۳۵                  | `developer.domain` فقط webhook _outbound_ دارد؛ هیچ connector _inbound_ با auth abstraction وجود ندارد                                                                                            |
| N6  | **Comment & Mention**              | ۸۵، ۱۰۳                | تنها `blog_comments` است، یک‌سطحی، با RLS عمومی-دسترس                                                                                                                                             |
| N7  | **Custom Object / Field Registry** | ۱۴۱، ۱۴۲، ۱۴۳          | `metadata.entity_catalog` یک کاتالوگ _توضیحی_ است، نه لایه‌ی ذخیره‌سازی                                                                                                                           |
| N8  | **Workflow Builder Runtime**       | ۱۴۴                    | `workflow.service` CRUD دارد؛ `approval.domain` محاسبات دارد؛ هیچ DSL/نسخه‌بندی/activation نیست                                                                                                   |
| N9  | **Report / Dataset Layer**         | ۱۴۵، ۱۴۶، ۶، ۷، ۱۳۱    | گزارش‌ها هر کدام کوئری خودشان را دارند                                                                                                                                                            |
| N10 | **Cohort / Funnel / Segmentation** | ۱۳۰، ۱۳۱، ۱۰۸          | قیف فقط از داده‌ی نمودار فروش ساخته می‌شود (`/crm/funnel` حذف شد)                                                                                                                                 |
| N11 | **Break-Even & Scenario**          | ۱۳۳، ۱۳۴               | `buildProfitReport` نقطه‌ی سربه‌سر ندارد                                                                                                                                                          |
| N12 | **Benchmark**                      | ۱۳۵                    | هیچ داده‌ی بیرونی (صنعت/منطقه) در محصول نیست                                                                                                                                                      |
| N13 | **Expense Management**             | ۱۵، ۳۱، ۱۰۳            | `expense` فقط یک `accountRootType` است؛ **جدول expense وجود ندارد**                                                                                                                               |
| N14 | **Document Ingestion (OCR)**       | ۱۶، ۴۸، ۳۰             | N2 صریحاً OUT OF SCOPE شد: Storage+Queue+Provider+Security لازم است                                                                                                                               |
| N15 | **Document Translation**           | ۲۰                     | —                                                                                                                                                                                                 |
| N16 | **Scheduled Automation**           | ۵۸، ۶۳، ۶۴، ۵۷         | `claim_scheduled_run` زیرساخت هست؛ **م DSL برای تعریف کار تکرارشونده نیست**                                                                                                                       |
| N17 | **Escalation Runtime**             | ۶۸                     | `shouldEscalate` نوشته شده، **صفر caller**                                                                                                                                                        |
| N18 | **Action Executor**                | ۵۹، ۶۳، ۶۴، ۱۱۲        | `RuleAction` یک union است ولی هیچ executor ندارد                                                                                                                                                  |
| N19 | **Compensation / Undo**            | ۸۱                     | `reverseDocument` فقط برای سند است؛ undo سازمانی نیست                                                                                                                                             |
| N20 | **Saved View Server**              | ۸۷، ۸۹                 | `SavedView` فقط در `ui-contract` (کلاینت) است                                                                                                                                                     |
| N21 | **Customer Risk Scoring**          | ۱۰، ۱۸، ۹              | `creditControl` فقط سقف را می‌خواند؛ هیچ امتیاز ریسکی نیست                                                                                                                                        |
| N22 | **White Label / Domain**           | ۹۵، ۹۶، ۱۴۸            | `SITE_URL` یک ثابت است؛ per-tenant نیست                                                                                                                                                           |

---

## ۵. فازبندی

هر فاز فقط وقتی شروع می‌شود که فاز قبل **سبز** باشد.
هر فاز = یک PR. بدون استثنا.

### فاز ۰ — رفع بدهی زیربنایی

_هیچ قابلیتی اضافه نمی‌شود. فقط مالکیت حقیقت تثبیت می‌شود._

| #   | کار                                        | وضعیت                             |
| --- | ------------------------------------------ | --------------------------------- |
| 0.1 | خط پایه: `tsc` + کل سوئیت                  | ✅ ۱۹۰ فایل · ۲۹۹۸ تست · tsc تمیز |
| 0.2 | **مکانیزم job: یک مالک**                   | ✅ انجام‌شده (زیر)                |
| 0.3 | **`round2` پنج‌گانه**                      | ✅ انجام‌شده (زیر)                |
| 0.4 | گزارش «Still owed» — **۴ قاعده، نه ۳ کپی** | ✅ مستند · تصمیم: الف             |
| 0.5 | Escalation — نگه‌داشتن با وضعیت صریح       | ✅ انجام‌شده (زیر)                |
| 0.6 | Dead code audit باقی‌مانده                 | ⬜                                |
| 0.7 | گزارش تقارن گردکردن                        | ✅ مستند · تصمیم: الف             |

#### 0.2 — مکانیزم job (انجام‌شده)

**یافته:** پنج فایل `setInterval`/`cron` دارند، ولی فقط **دو** ادعای کار قابل‌claim
می‌کردند و هر دو مرده بودند:

| فایل                               | وضعیت قبل                                                                                                               | تصمیم             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/queue.ts`                     | InProcessQueue، **صفر caller**، بدون persist                                                                            | ❌ حذف            |
| `src/queue/pdf-queue.ts`           | BullMQ جدا با Redis خودش، **صفر caller** (`enqueuePdfJob` صفر مصرف‌کننده؛ مسیر زنده `routes/invoice-pdf.routes.ts` است) | ❌ حذف            |
| `bullmq` در `backend/package.json` | تنها consumer‌اش همان فایل حذف‌شده                                                                                      | ❌ حذف dependency |
| `plugins/job-scheduler.plugin.ts`  | poller که **claim می‌کند**                                                                                              | ✅ نگه‌داشته      |
| `scheduler/index.ts`               | cron که هر tick را `runScheduledOnce` می‌کند                                                                            | ✅ نگه‌داشته      |
| `services/instance-registry.ts`    | heartbeat برای صفحه‌ی admin                                                                                             | ✅ نگه‌داشته      |
| `services/sync-stream.ts`          | یک poller به‌ازای هر workspace، فقط می‌خواند                                                                            | ✅ نگه‌داشته      |
| `routes/sync-stream.routes.ts`     | heartbeat هر WebSocket                                                                                                  | ✅ نگه‌داشته      |
| `routes/system-metrics.routes.ts`  | sampling متریک                                                                                                          | ✅ نگه‌داشته      |

**گارد:** `backend/src/__tests__/job-authority-guard.test.ts` (۵ تست)

- هیچ فایلی بیرون از دو مالک، `Queue`/`Worker` خودش را نمی‌سازد
- هر `setInterval` باید طبقه‌بندی‌شده باشد (فهرست بسته — تایمر تازه باید
  بررسی شود، نه اینکه بی‌سروصدا اضافه شود)
- هر pollerِ کار واقعی باید واقعاً claim کند
- دو صف مرده **حذف‌شده**، نه فقط بی‌استفاده

**دو تصحیح حین نوشتن گارد** (هر دو درس ۸۸: گاردِ خودم روی کدِ درست قرمز شد):

1. کامنتی که توضیح می‌داد «glob داخل کامنت خطی، کامنت بلوکی جعلی می‌سازد»
   خودش همان باگ را داشت — `*` در انتهای مسیر، کامنت را می‌بست.
2. نام `complete_scheduled_run` را نوشته بودم؛ کد `finish_scheduled_run` صدا
   می‌زند. **گاردی که تابعی را assert کند که هرگز وجود نداشته، یک اعتقاد است
   نه یک بررسی.**

⚠️ اصلاح راهنمای فاز: «۳ مکانیزم» غلط بود؛ **۵ تایمر، ۲ مالک** است.

#### 0.3 — گردکردن پول (انجام‌شده)

**یافته:** چهار کپی `round2` **بایت‌به‌بایت یکسان** بودند + یک کپی در
`packages/validation` که بک‌اند نمی‌تواند import کند. `payments` علاوه بر آن یک
کپی دیگر از `minor` داشت.

**کار:** `backend/src/utils/money.ts` (leaf، صفر import) با `round2` ·
`roundHalfAwayFromZero` · `minor` · `sumRounded`. چهار دامنه به آن اشاره
می‌کنند و برای حفظ importerهای موجود re-export می‌کنند.

**گارد:** `money-primitive-guard.test.ts` (۶ تست، injection-tested)

#### 0.7 — گزارش، نه تعمیر: تقارن گردکردن 🔒

`round2` از `Math.round` استفاده می‌کند ⇒ تساوی‌ها به سمت `+∞` می‌روند. برای
مبالغ منفی یعنی **نامتقارن**: `Math.round(-1.5) === -1`.

- موتور مالی **چهار** جا از این استفاده می‌کند (فاکتور، مطالبات، بینش، بها)
- موتور مالیات از قبل نسخه‌ی متقارن خودش را دارد (`roundHalfAwayFromZero`) و
  دلیلش کامنت‌شده است: یک یادداشت اعتباری نباید با فاکتورش متفاوت گرد شود

**پیدا شد حین نوشتن تست:** `round2(1.005)` برابر **۱** است، نه ۱٫۰۱ —
`1.005 * 100` در IEEE-754 می‌شود `100.49999999999999`. اولین نسخه‌ی تست عدد
۱٫۰۱ را assert کرده بود چون «گرد کردن به دو رقم یعنی این»؛ **تست اشتباه بود،
نه کد.** رفتار واقعی حالا قفل شده.

**تصمیم لازم از شما:** آیا دفتر کل باید برای مبالغ منفی متقارن شود؟

| گزینه                          | اثر                                                     |
| ------------------------------ | ------------------------------------------------------- |
| الف — همین‌طور بماند           | صفر تغییر. ولی یک برگشت سند، دقیقاً معکوسِ اصلش نمی‌شود |
| ب — فقط سندِ برگشتی متقارن شود | نیازمند بررسی اسناد موجود                               |
| ج — همه متقارن شوند            | مانده‌ی دفترهای موجود جابه‌جا می‌شود                    |

⚠️ **این یک تصمیم محصولی درباره‌ی کتاب‌های موجود است، نه یک refactor.**
فعلاً هیچ‌کدام انجام نشده و هیچ رفتاری تغییر نکرده.

#### 0.4 — «هنوز بدهکار است»: گزارش (نه consolidation) 🔒

فرض من غلط بود. فکر می‌کردم سه نمایش از **یک** قاعده‌اند که باید یکی شوند.
کد نشان داد **چهار قاعده‌ی متفاوت** وجود دارد و هرکدام جای درستی دارد:

| #   | قاعده                                     | کجا                                                                                        | چرا فرق دارد                                                                                                                               |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `status !== 'paid'`                       | `invoices/outstanding.domain.ts` + `invoice.service:169` + `analytics.service:113,212,447` | لیست و KPI داشبورد. **دو نیمه‌اش consolidate شده و گارد دارد** (`outstanding-predicate.test.ts` — NULL semantics را روی هر دو اجرا می‌کند) |
| 2   | `status NOT IN ('paid','cancelled')`      | `accounting/operational-reports.ts:144`                                                    | گزارش **بدهی مشتریان**، که BUG-011 درستش کرد                                                                                               |
| 3   | `total − allocated`                       | `payments.domain.outstandingOf`                                                            | **مشتق از تخصیص‌ها**، نه از وضعیت                                                                                                          |
| 4   | `allocated ≤ 0 → unpaid · ≥ total → paid` | trigger `invoices_project_settlement`                                                      | پروژکسیون دیتابیس روی `payment_allocations`                                                                                                |

**قاعده‌ی ۱ و ۲ عمداً فرق دارند:** یکی `cancelled` را طلب می‌شمارد و دیگری
نمی‌کند. این «تکراری» نیست — BUG-011 دقیقاً همین را درست کرد.

**قاعده‌ی ۳ از ۱ بهتر است** و `outstanding.domain.ts` خودش می‌گوید چرا استفاده
نمی‌شود: «فیلتر کردن لیست با قاعده‌ای دیگر باعث می‌شود لیست با عددی که آن را
باز کرده اختلاف داشته باشد».

⚠️ **پس مسئله تکرار نیست — مسئله انتخاب است.** هر چهار قاعده بدون تناقض با
هم زندگی می‌کنند، چون هرکدام به یک پرسش پاسخ می‌دهند. تغییر قاعده‌ی ۱ به ۳
عددی را عوض می‌کند که هر کسب‌وکاری هر صبح می‌بیند.

**تصمیم لازم از شما** — سه گزینه، و پیشنهادم گزینه‌ی الف است چون هزینه‌اش
پایین و فایده‌اش فوری نیست:

| گزینه   | کار                                                      | ریسک                                                                        |
| ------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| **الف** | همین‌طور بماند، فقط **مستند** شود                        | صفر. ولی `/invoices?outstanding=1` و «بدهی مشتریان» عدد متفاوت نشان می‌دهند |
| ب       | KPI داشبورد به قاعده‌ی ۳ (`total − allocated`) منتقل شود | عدد روزانه‌ی داشبورد عوض می‌شود                                             |
| ج       | قاعده‌ی ۲ هم به `settlement_status` منتقل شود            | دو گزارش دیگر عوض می‌شوند                                                   |

⚠️ تا وقتی تصمیم نیست، **هیچ‌کدام انجام نشده**. مهاجرت به `settlement_status`
هم یک ریسک جدا دارد: `HANDOFF` می‌گوید آن ستون روی همه‌ی محیط‌ها اجرا نشده، و
افزودنش به `INVOICE_LIST_COLUMNS` یعنی اگر نباشد کل لیست فاکتور 42703 می‌شود.

**✅ تصمیم مالک (۳۰ سپتامبر): گزینه‌ی الف — مستند بماند.** هیچ تغییری در
هیچ قاعده‌ای انجام نشد.

#### 0.5 — Escalation: نگه‌داشتن با وضعیت صریح (انجام‌شده)

**یافته:** `shouldEscalate` و `escalatedRole` در `approval.domain.ts` نوشته شده‌اند
و `approval-routing.test.ts` هر دو را تست می‌کند — ولی:

- **صفر caller** در کل بک‌اند (تنها ارجاع، خودِ تست است)
- **نه** در `packages/validation` (نه `EscalationPolicy`، نه فیلدی)
- **نه** در دیتابیس (`workflow_steps` ستون escalation ندارد)

پس حتی اگر بخواهیم صدایش بزنیم، چیزی برای پاس‌دادن نداریم.

**⚠️ این دقیقاً الگوی §۷٫۱ است:** انتزاع درست، تست‌شده، بی‌مصرف. درس ۸۴ می‌گوید
هفت بار در یک سشن تکرار شده و بدترین حالت «کدِ درستِ ناپیدا» است.

**تصمیم مالک (۳۰ سپتامبر): نگه‌داشتن با وضعیت صریح.** دلیل: این کد **درست** است
و تمامِ قابلیت #۶۸ است. §۱۴ برای کدی است که اشتباه فهمیده شده، نه برای کدِ درستِ
یک قابلیتی که دو فاز دیگر می‌آید. حذفش یعنی فاز ۵ از صفر بسازد.

**گارد:** `backend/src/__tests__/unwired-capability.test.ts` (۵ تست،
injection-tested)

این گارد یک **دفتر** دارد، نه فقط یک چک. هر ردیف نام می‌برد:

| چه چیزی                                   | چرا                                |
| ----------------------------------------- | ---------------------------------- |
| شماره‌ی قابلیت از نقشه‌ی ۱۵۰گانه          | ردیابی                             |
| فایل و symbolها                           | باید واقعاً وجود داشته باشند       |
| دلیل بی‌سیم‌بودن، در یک جمله‌ی قابل‌اقدام | جلوی تبدیل شدن به فهرست خشکِ توابع |
| `status`                                  | `WIRED` یا `WRITTEN_NOT_WIRED`     |

و مهم‌ترین assertion: **هر ردیفِ `WRITTEN_NOT_WIRED` باید همچنان صفر caller داشته
باشد.** وقتی فاز ۵ escalation را wire کند، این تست قرمز می‌شود و پیامش می‌گوید
«symbol نام‌برده caller دارد، پس wired است — وضعیت را عوض کن و ردیف را حذف کن».
یعنی **برای سبزشدن باید ردیف را حذف کرد**، نه اینکه چک را شل کنی.

⚠️ خودِ گارد injection-test شد: یک caller موقت ساخته شد، تست با **نام فایل**
قرمز شد، و پیامش دقیقاً همان راهنمایی را داد که فاز ۵ لازم دارد.

### فاز ۱ — Financial Core ✅

`62 · 65 · 69 · 70 · 128`

| قابلیت                           | وضعیت قبل                                         | کار انجام‌شده                                                                                                         |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ۶۲ Automatic Bank Categorization | فقط `match-learning` (روی **تطبیق** بود، نه حساب) | `banking/categorization.domain.ts` — جهت بخشی از کلید الگو، حداقل ۳ نمونه، ابهام به‌جای اکثریت                        |
| ۶۵ Tax Return Preparation        | endpoint کامل، **صفر مصرف‌کننده**                 | `packages/api/hooks/tax.ts` — وصل کردن، نه ساخت                                                                       |
| ۶۹ Month-End Package             | ۵ گام جدا، بدون ترتیب                             | `accounting/month-end.{domain,service}.ts` + `POST /api/accounting/month-end` + `inventory-costing/repost.service.ts` |
| ۷۰ Auto Depreciation Posting     | کامل، فقط بدون زمان‌بندی                          | `workers/depreciation-posting.worker.ts` + cron روزانه                                                                |
| ۱۲۸ Live Budget vs Actual        | کامل — actual از `journal_lines`                  | بدون تغییر                                                                                                            |

**⚠️ سه یافته که «موجود بود» را رد کردند:**

1. **#۶۵ کامل نبود** — موتور و route داشت، ولی هیچ کلاینتی صدایش نمی‌زد.
   الگوی §۷٫۱. کار درست **وصل‌کردن** بود، نه ساختن.
2. **#۱۲۸ کامل بود** — `budget_consumption` از `journal_lines` می‌خواند، نه از جدول
   موازی. هیچ کاری لازم نبود.
3. **`planRepost` هم مثل escalation بود** — نوشته‌شده، تست‌شده، بی‌مصرف. برای
   #۶۹ باید سرویس می‌شد. (تصمیم مالک: بساز.)

**گاردهای جدید:** `job-authority-guard` · `money-primitive-guard` ·
`unwired-capability` — همه injection-tested.

**⚠️ چهار guard ساختاری کار جدید را گرفتند** (و همین دلیل ارزششان است):
`no-silent-row-cap` (`.limit(10_000)` که خودم نوشته بودم) ·
`distributed-work` (whitelist بسته‌ی نام cron) · `concurrency-safety-map`
(route جدید) · `unwired-capability` (symbol حالا caller داشت).

**نتیجه:** ۱۹۸ فایل · ۳۰۶۴ تست · tsc تمیز در backend، api و ui.

### فاز ۲ — Commerce Core

`19 · 109 · 114 · 115 · 116 · 117 · 120 · 123 · 124`

| قابلیت                                                | Engine |
| ----------------------------------------------------- | ------ |
| ۱۹ Discount Optimization                              | N1     |
| ۱۰۹ Loyalty · ۱۱۷ Gift Cards · ۱۲۰ Social Automation  | N1     |
| ۱۱۴ Dynamic Pricing · ۱۱۵ Bundle Pricing · ۱۱۶ Coupon | N1     |
| ۱۲۳ BNPL · ۱۲۴ Installment                            | N4     |

**شرط خروج:** N1 و N4 ساخته شده‌اند و روی `computeInvoiceMoney` سوار شده‌اند.
⚠️ قیمت خط همچنان از سرور می‌آید؛ N1 هرگز قیمت را از کلاینت نمی‌گیرد.

### فاز ۳ — Treasury

`38 · 51 · 53 · 55 · 56 · 66 · 125 · 126`

| قابلیت                                         | Engine                                            |
| ---------------------------------------------- | ------------------------------------------------- |
| ۵۱ Payment Reminders · ۵۳ Collections Workflow | N2                                                |
| ۵۵ Auto Bank Reconciliation                    | Banking (تأیید خودکارِ تطبیق‌های با اطمینان بالا) |
| ۵۶ Till Reconciliation                         | Till (کامل — فقط UI)                              |
| ۶۶ Payment Scheduling                          | N2                                                |
| ۳۸، ۱۲۵، ۱۲۶                                   | N3                                                |

⚠️ **۵۵ با G1 در تناقض است.** `reconciliation.domain.ts` صریحاً می‌گوید «همه‌چیز
SUGGEST می‌کند، هیچ‌چیز reconcile نمی‌کند» و دلیلش را می‌آورد: تطبیق خودکار روی
پرداخت اشتباه پول را بین دو مشتری جابه‌جا می‌کند. قابلیت ۵۵ باید **پیشنهاد
با اطمینان بالا را یک‌کلیکی کند**، نه خودکار. این تصمیم محصولی است.

### فاز ۴ — Supply Chain

`10 · 15 · 19 · 36 · 40 · 59 · 60 · 61`

| قابلیت                                            | Engine             |
| ------------------------------------------------- | ------------------ |
| ۵۹ Auto Reorder Purchase · ۶۰ Smart Reorder Point | Reorder + N18      |
| ۱۵، ۱۹ Supplier Intelligence                      | N22 (بخش supplier) |
| ۱۰ Supplier Risk Alert                            | N21 (بخش supplier) |
| ۶۱ Pre-Operation Backup                           | Backup             |

⚠️ **۶۱ ریسک امنیتی دارد.** `HANDOFF` می‌گوید backup فعلی «پشتیبان واقعی، نه
localStorage» ولی restore ندارد. «قبل از عملیات» یعنی trigger روی هر عملیات
مالی — این یک تصمیم سیاستی است، نه پیاده‌سازی.

### فاز ۵ — Automation Platform

`57 · 58 · 63 · 64 · 68 · 81 · 87 · 89 · 112`

| قابلیت                                                       | Engine      |
| ------------------------------------------------------------ | ----------- |
| ۵۸ Daily Close · ۶۳ Recurring Invoice · ۶۴ Recurring Expense | N16         |
| ۶۸ Escalation Rules                                          | N17         |
| ۸۱ Undo/Compensation                                         | N19         |
| ۸۷، ۸۹ Saved/Shareable Views                                 | N20         |
| ۱۱۲ Campaign Manager                                         | N16 + Event |

⚠️ **۶۴ Recurring Expense نیازمند N13 است** (جدول expense وجود ندارد).
⚠️ **۱۱۲ نیازمند N14 است** اگر از عکس استفاده کند.

### فاز ۶ — Intelligence

`1 · 2 · 3 · 4 · 5 · 7 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 30 · 121 · 129 · 130 · 131 · 132 · 133 · 134 · 135`

| قابلیت                        | Engine                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| ۱، ۲، ۴، ۷ گفت‌وگو و گزارش    | `ai-chat` + `reporting-reader` (**بدون افزودن view بدون بازبینی**) |
| ۳، ۱۴ تشخیص ناهنجاری و خطا    | `insights.domain` (بسط‌دهی)                                        |
| ۵ ۱۳-هفته                     | `forecast.domain` (بسط‌دهی ۷/۳۰ → ۱۳ هفته)                         |
| ۱۱، ۱۲، ۱۳، ۱۲۹               | `forecast.domain` + N12                                            |
| ۱۰، ۱۸ ریسک مشتری/تأمین‌کننده | N21                                                                |
| ۱۶، ۳۰، ۴۸ OCR                | N14                                                                |
| ۲۰ ترجمه سند                  | N15                                                                |
| ۱۲۱ Real-Time FX              | `currency` (بسط‌دهی)                                               |
| ۱۳۰، ۱۳۱                      | N10                                                                |
| ۱۳۲                           | N9 (روی `buildProfitReport`)                                       |
| ۱۳۳، ۱۳۴                      | N11                                                                |
| ۱۳۵                           | N12                                                                |

⚠️ **گستره‌ی AI نباید از ۴ view بیشتر شود مگر هر view جداگانه بازبینی شود.**
`reporting-reader.ts` این را «closed set» می‌نامد و دلیلش را می‌آورد: متنی که
مدل می‌خواند قابل‌اعتماد نیست.

### فاز ۷ — Customer Intelligence

`3 · 9 · 13 · 18 · 106 · 107 · 108 · 109 · 111`

| قابلیت                             | Engine                        |
| ---------------------------------- | ----------------------------- |
| ۱۰۷ Customer Timeline · ۱۰۶ AI CRM | CRM + Event                   |
| ۱۰۸ NPS                            | **N13-like: سازوکار بازخورد** |
| ۳، ۹، ۱۳، ۱۸                       | N21                           |
| ۱۰۹ Loyalty                        | N1 (فاز ۲)                    |

⚠️ Customer 360 FRAGMENTED است. اول باید consolidate شود، بعد گسترش.

### فاز ۸ — Data Ownership

`36 · 37 · 38 · 39 · 40 · 41 · 42 · 43 · 44 · 45 · 46 · 47 · 48 · 49 · 50 · 61`

| قابلیت                                  | وضعیت                                                            |
| --------------------------------------- | ---------------------------------------------------------------- |
| ۳۶، ۳۸، ۳۹، ۴۷                          | ✅ `migration` موجود                                             |
| ۳۷، ۴۴                                  | ✅ `backup` موجود                                                |
| ۴۰ Advanced Export Formats              | N9                                                               |
| ۴۱ Accounting Export API                | Developer Platform + N9                                          |
| ۴۲ Audit Export                         | `audit` + N9                                                     |
| ۴۳، ۴۴، ۴۵، ۴۶ Point-in-Time / Snapshot | **gap واقعی** — `sync_change_log` دارد ولی snapshot تاریخی ندارد |
| ۴۹ Bank Statement PDF                   | N14 + `bank-statement-csv`                                       |
| ۵۰ Email Attachment Harvester           | N5                                                               |

### فاز ۹ — Integration Platform

`21 · 22 · 23 · 24 · 25 · 26 · 27 · 28 · 29 · 30 · 31 · 32 · 33 · 34 · 35 · 137 · 147 · 148 · 149`

| قابلیت                                                   | Engine                                      |
| -------------------------------------------------------- | ------------------------------------------- |
| ۲۱، ۲۹، ۳۱، ۱۴۷ Browser Extension / POS / Add-in / Embed | N5                                          |
| ۲۲، ۲۸ Capture از وب و دسکتاپ                            | N5                                          |
| ۲۳، ۳۲، ۳۳، ۳۴، ۳۵                                       | N5 (هر کدام یک Connector)                   |
| ۲۴، ۲۵، ۲۶                                               | N5                                          |
| ۲۷، ۳۰ Email capture                                     | N5 + N14                                    |
| ۱۳۷ Plugin SDK                                           | Developer Platform (موجود — SDK مرورگر هست) |
| ۱۴۸، ۱۴۹ White Label / Reseller                          | N22                                         |

⚠️ هر Connector = یک adapter روی N5. **نه** یک سرویس مستقل با auth خودش.

### فاز ۱۰ — Advanced Platform

`104 · 141 · 142 · 143 · 144 · 145 · 146 · 150`

| قابلیت                                       | Engine                              |
| -------------------------------------------- | ----------------------------------- |
| ۱۰۴ Approval Matrix                          | `permission-matrix.service` (موجود) |
| ۱۴۱، ۱۴۲، ۱۴۳ Custom Objects/Fields/Formulas | N7                                  |
| ۱۴۴ Workflow Builder                         | N8                                  |
| ۱۴۵ Report Builder · ۱۴۶ Dashboard Builder   | N9                                  |
| ۱۵۰ Open-Core Extension                      | `plugin.domain.ts` (موجود)          |

⚠️ N7 خطرناک‌ترین Engine این فهرست است. هسته‌های مالی **strongly typed**
می‌مانند. N7 فقط روی موجودیت‌های غیرمالی فعال می‌شود.

### فاز ۱۱ — Experience

`71 · 72 · 73 · 74 · 75 · 76 · 77 · 78 · 79 · 80 · 82 · 83 · 84 · 86 · 88 · 90 · 91 · 92 · 93 · 94 · 95 · 96 · 97 · 100 · 101 · 102 · 103`

این فاز **عمدتاً frontend** است. یک استثنا: ۱۰۰ Attendance و ۱۰۱ Shift
هسته‌ی پول‌دار (۱۰۳ Internal Notes هم سند است).

### فاز ۱۲ — Hardening

پس از تمام فازها: audit امنیتی، performance، و **audit نهایی مالی**.

---

## ۶. قابلیت‌هایی که با قوانین پروژه در تناقض‌اند

این‌ها را **نمی‌سازم** مگر تصمیم صریح شما:

| #   | قابلیت                   | تناقض                                                                                                         |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| ۵۵  | Auto Bank Reconciliation | `reconciliation.domain.ts`: «هیچ‌چیز خودکار reconcile نمی‌کند»                                                |
| ۱۲۲ | Crypto Payment Recording | `CURRENCY_CODES` = ISO 4217؛ `currency-policy.test.ts` pin می‌کند. درس ۸۱: فهرست بسته = **سیاست**، نه فراموشی |
| ۹۶  | Custom Domain            | `SITE_URL` یک ثابت؛ per-tenant دامنه = معماری زیرساختی جدید                                                   |
| ۱۵۰ | Open-Core Extension      | `detail.md` §۱۹ در برابر مدل فعلی                                                                             |
| ۱۰۸ | NPS                      | نیازمند داده‌ی واقعی مشتری                                                                                    |
| ۱۳۵ | Industry Benchmarking    | نیازمند داده‌ی بیرونی که محصول ندارد                                                                          |
| ۸   | Voice Summary            | نیازمند provider + سیاست                                                                                      |

---

## ۷. Invariantهایی که هر فاز باید حفظ کند

این‌ها **قابل مذاکره نیستند** — از `CLAUDE.md` و `detail.md`:

```
Ledger:          Σdebit == Σcredit                    (دقیق، نه tolerance)
Inventory:       opening + in − out ± adj == closing
Treasury:        opening + in − out + transfers ± adj == balance
Budget:          budget − actual − open_commitments == remaining
Tax:             Σ(net) + Σ(tax) − Σ(withholding) == total
Party:           outstanding == total − allocated      (مشتق، نه ستون)
Costing:         COGS == Σ(consumed layer cost)        (نه قیمت فروش)
Tenancy:         workspace_id تنها فیلتر است
AI:              مدل هرگز عدد نمی‌سازد؛ فقط بیان می‌کند
Sync:            تعارض مالی هرگز LWW نیست
Import:          هرگز مستقیم به جدول مالی نمی‌نویسد
```

---

## ۸. ترتیب پیازبندی هر Engine جدید

هر Engine جدید بدون این پنج مورد **کامل نیست**:

1. `docs/<name>-migration.sql` — additive، idempotent، با بلوک Rollback
2. `services/<name>/<name>.domain.ts` — خالص، بدون DB
3. `services/<name>/<name>.service.ts` — `TenancyContext`، نه `userId`
4. گارد ایستا که **محل فراخوانی واقعی** را بخواند
5. تست `injection-tested` — فیکس را برگردان، تست باید قرمز شود

---

## ۹. وضعیت فعلی repo برای شروع

```
شاخه:        main تمیز
آخرین کامیت: d64a167e
تست بک‌اند:  ۱۹۰ فایل
guard ها:    tenancy / rls / workflow / client-route / vertical-slice /
             sod-rule-coverage / no-service-import-cycles / money-cache
             / offline-invoice-gap / one-ui-two-hosts / public-page-namespaces
             / landing-claims / robots-dashboard-routes / cron پرامپت: ⛔ DDL
             مستقیم ممنوع — انسان اجرا می‌کند
```

**فاز ۰ با `cd backend && npx tsc --noEmit && npx vitest run` شروع می‌شود**
تا خط پایه قابل اثبات باشد.

---

# گزارش نهایی — ۳۰ سپتامبر ۲۰۲۶

## ۱. Engineهای گسترش‌یافته (بدون موتور تازه)

| Engine       | قابلیت | کار                                                                                   |
| ------------ | ------ | ------------------------------------------------------------------------------------- |
| Depreciation | ۷۰     | `workers/depreciation-posting.worker.ts` + cron روزانه. خود `postDue` از قبل کامل بود |
| Tax Return   | ۶۵     | `packages/api/hooks/tax.ts` — موتور و route کامل بود، **صفر مصرف‌کننده** داشت         |
| Budget       | ۱۲۸    | بدون تغییر — `budget_consumption` از `journal_lines` می‌خواند                         |
| Costing      | —      | `repost.service.ts` (planRepost بی‌مصرف بود)                                          |

## ۲. Engineهای تازه (۱۷)

| #   | Engine                                 | فایل                                                             | قابلیت                     | تست |
| --- | -------------------------------------- | ---------------------------------------------------------------- | -------------------------- | --- |
| N1  | Pricing & Promotion                    | `commerce/pricing.domain.ts`                                     | ۱۹ ۱۰۹ ۱۱۴ ۱۱۵ ۱۱۶ ۱۱۷ ۱۲۰ | ۱۹  |
| N2  | Collections                            | `collections/collections.domain.ts`                              | ۵۱ ۵۳ ۶۶                   | ۲۴  |
| N3  | Working Capital & Financing            | `financing/working-capital.domain.ts`                            | ۳۸ ۱۲۵ ۱۲۶                 | ۲۶  |
| N4  | Installment & Late Fees                | `commerce/installment.domain.ts`                                 | ۱۲۳ ۱۲۴                    | ۲۵  |
| N5  | Connector Framework                    | `connectors/connector.domain.ts`                                 | ۲۱–۳۵ ۱۳۷ ۱۴۷              | ۲۱  |
| N7  | Custom Objects & Formulas              | `extensions/extension.domain.ts`                                 | ۱۴۱ ۱۴۲ ۱۴۳                | ۱۴  |
| N9  | Report & Dataset Layer                 | `reporting/dataset.domain.ts` + `portability/snapshot.domain.ts` | ۱۴۵ ۱۴۶ ۴۲–۴۶              | ۴۲  |
| N10 | Cohorts, Funnels, Segments             | `analytics/cohort.domain.ts`                                     | ۱۳۰ ۱۳۱ ۱۰۸                | ۲۰  |
| N11 | Break-Even & Scenarios                 | `analytics/break-even.domain.ts`                                 | ۱۳۳ ۱۳۴                    | ۱۵  |
| N12 | Benchmark                              | `analytics/benchmark.domain.ts`                                  | ۱۳۵                        | ۱۵  |
| N14 | Document Ingestion                     | `ingest/ingest.domain.ts`                                        | ۱۶ ۳۰ ۴۸ ۴۹                | ۲۳  |
| N15 | Document Translation                   | `ingest/translate.domain.ts`                                     | ۲۰                         | ۱۷  |
| N16 | Scheduled Automation                   | `automation/schedule.domain.ts`                                  | ۵۷ ۵۸ ۶۳ ۶۴ ۱۱۲            | ۲۰  |
| N17 | Escalation                             | `workflow/escalation.domain.ts`                                  | ۶۸                         | ۲۴  |
| N19 | Compensation                           | `workflow/escalation.domain.ts`                                  | ۸۱                         | ↑   |
| N20 | (حذف‌شده — SavedView اصلاً در کد نبود) | —                                                                | ۸۷ ۸۹                      | —   |
| N21 | Customer Risk, NPS, Health, Loyalty    | `customers/customer-risk.domain.ts` + `nps.domain.ts`            | ۳ ۹ ۱۳ ۱۸ ۱۰۶ ۱۰۸ ۱۰۹      | ۳۲  |
| N22 | Supplier Intelligence                  | `supplier/supplier-intelligence.domain.ts`                       | ۱۰ ۱۵ ۱۹                   | ۱۸  |
| N8  | Workflow Builder Runtime               | `workflow/builder.domain.ts`                                     | ۱۴۴                        | ۲۰  |
| —   | Attendance, Shifts, Notes              | `customers/attendance.domain.ts`                                 | ۱۰۰ ۱۰۱ ۱۰۳                | ۲۶  |
| —   | Bank Categorization & Auto-Match       | `banking/{categorization,auto-match}.domain.ts`                  | ۶۲ ۵۵                      | ۳۷  |

## ۳. Guardهای تازه

| گارد                       | چه چیزی را نگه می‌دارد                    |
| -------------------------- | ----------------------------------------- |
| `job-authority-guard`      | یک job runtime. هیچ صف یا worker دیگری    |
| `money-primitive-guard`    | گردکردن پول در یک ماژول                   |
| `unwired-capability`       | دفتر صریح قابلیت‌های نوشته‌شده-ولی-بی‌سیم |
| `extension-boundary-guard` | N7 هرگز به جدول مالی نمی‌رسد              |

## ۴. باگ‌هایی که guardهای موجود گرفتند

| guard                    | ایراد من                                                       |
| ------------------------ | -------------------------------------------------------------- |
| `no-silent-row-cap`      | `.limit(10_000)` در repostCosts — سقف PostgREST بی‌صدا         |
| `distributed-work`       | whitelist بسته‌ی نام cron                                      |
| `concurrency-safety-map` | route جدید `/month-end` ثبت نشده بود                           |
| `unwired-capability`     | `monthEndsFiscalYear` wire شده بود، register باید به‌روز می‌شد |

## ۵. باگ‌هایی که تست‌های خودم گرفتند (۱۲ مورد)

| مورد                                                           | جا               |
| -------------------------------------------------------------- | ---------------- |
| `covers`: تخفیف مشتری روی فروش نقدی                            | pricing          |
| `applyPrice`: خطِ بدون quote رایگان                            | pricing          |
| `auto-match`: «آستانه‌ی صفر» در واقع روشن بود                  | auto-match       |
| `minScore < 0` شرط هرگز برقرار نمی‌شد                          | auto-match       |
| `todayIso` خودش مرجع بود، پس overdue دیده نمی‌شد               | customer-risk    |
| NPS: NaN ناپدید می‌شد، `12` detractor می‌شد                    | nps              |
| `totalMinor` در وام بدون بهره = یک قسط                         | working-capital  |
| وزن ریسک تأمین‌کننده با آستانه‌ی باند نمی‌خواند                | supplier         |
| مرز concentration خودش را تعریف نمی‌کرد                        | supplier         |
| `canFinishWithoutApproval` مسیر تأییدِ null را اشتباه می‌پیمود | workflow builder |
| evaluator: `2 + 3 * 4` را ۲۰ می‌داد                            | extension        |
| `safeFileName`: نامِ فقط-نقطه رد می‌شد                         | ingest           |

## ۶. وضعیت نهایی

```
backend: 219 فایل تست · 3469 تست · tsc تمیز
تست جدید: 471
```

## ۷. آنچه انجام نشد و چرا

| قابلیت                          | دلیل                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| بقیه‌ی فاز ۱۱ (۲۴ مورد)         | frontend. خارج از scope این سشن                                      |
| OCR واقعی                       | provider نیاز دارد. pipeline و مرزها ساخته شد، **پیش‌فرض رد می‌کند** |
| PDF statement parsing           | text extraction ندارد                                                |
| #۱۳۵ benchmark با داده‌ی بیرونی | محصول داده‌ی بیرونی ندارد. فقط peer داخلی، با کف حریم                |
| ۸۷ ۸۹ saved views               | `SavedView` فقط در `ui-contract` بود — نه در UI، نه API، نه DB       |
| DDL هیچ migrationی              | §۰ — اجرا با انسان است                                               |
