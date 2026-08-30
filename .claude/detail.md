Hisabche — Accounting & Business Core Master Specification

Super Version 10/10 (Final)

هدف نهایی
Hisabche یک Business Operating System نسل جدید است که ترکیب زیر را محقق می‌کند:

ERP-grade Financial Engine + Precise Inventory Costing + Offline-first Architecture + Adaptive Client + Enterprise Security + Modern UX + Workflow/Rules Engine + AI Copilot + Marketplace

Domain Core منبع حقیقت تجاری و مالی است.
UI فقط وضعیت، فرمان و نتیجه را نمایش می‌دهد و هرگز منطق مالی authoritative را محاسبه یا تصمیم‌گیری نمی‌کند.

۱. معماری لایه‌ها

UI / UX (Adaptive + Visibility Profile + AI Copilot)
↓
Application Commands / Queries / Read Models
↓
Domain Cores (self-contained) + Workflow Engine + Rules Engine
↓
Accounting / Ledger Engine + Costing Engine
↓
Persistence (PostgreSQL) ↔ Offline Local DB + Sync / Outbox
↓
Marketplace / Plugins / Connectors

Coreهای اصلی (هر کدام self-contained)

Core

مسئولیت اصلی

Accounting Core

Journal, GL, Chart of Accounts

General Ledger Core

Posting, Trial Balance, Closing

Inventory Core

Stock Movements, Ledger, Availability

Inventory Costing Core

Cost Layers, FIFO, AVCO, Standard, COGS

Sales Core

Quotation → Invoice → Return

Purchase Core

PR → PO → Bill → Return

Accounts Receivable Core

Customer Ledger, Aging, Credit

Accounts Payable Core

Supplier Ledger, Aging

Payment Core

Allocation, Advances, Reversals

Tax Core

Rules, Rates, Inclusive/Exclusive

Pricing & Discount Core

Price Lists, Rules, Thresholds

Customer Core

Master Data + 360 View

Supplier Core

Master Data + 360 View

Product Core

Master Data + Variants

Warehouse Core

Multi-warehouse, Transfers

Fixed Assets Core

Register, Depreciation, Disposal

Banking Core

Accounts, Reconciliation

Cash Management Core

Cash, Petty Cash, Forecast

Expense Core

Claims, Approval, Reimbursement

Revenue Core

Recognition, Deferred

Currency & FX Core

Multi-currency, Gain/Loss

Reporting Core

Financial + Operational Reports

Budgeting Core

Budgets, Variance

Subscription/Billing Core

Recurring, Invoicing

Authorization Core

Role, Record, Field, SoD, RLS

Audit Core

Immutable Trail

Offline/Sync Core

Outbox, Conflict, Crash-safe

Document/Numbering Core

Sequences, Concurrency-safe

Notification Core

Events, Alerts

Import/Export Core

Validated Import, Export

Workflow Engine Core

Approval Chains, State Transitions

Rules Engine Core

Business Rules without Code Change

Master Data Core

MDM, Merge, Duplicate Detection

AI Copilot Core

Insights, Explanations, Suggestions

Marketplace Core

Plugins, Connectors, Templates

قوانین Core:

state و business logic خود را داشته باشد

جداگانه تست و توسعه شود

فقط از طریق contract مشخص با Coreهای دیگر ارتباط بگیرد

مستقیماً به database یا state Core دیگر وابسته نباشد

۲. Inventory Costing — استاندارد طلایی (مثال A35)

فرض:

خرید اول A35: 10,000,000

فروش اول: 12,000,000

خرید دوم A35: 9,000,000

فروش دوم: 13,000,000

نتیجهٔ صحیح:

معامله

Revenue

COGS

Gross Profit

۱

12,000,000

10,000,000

2,000,000

۲

13,000,000

9,000,000

4,000,000

مجموع

25,000,000

19,000,000

6,000,000

سیستم باید بداند:

کدام Cost Layer مصرف شده

کدام خرید به کدام فروش متصل است

روش Costing (FIFO / AVCO / Standard / Specific Identification) چه بوده

مفاهیم اجباری

Inventory Valuation

Cost Layers

FIFO, Weighted Average, Moving Average, Standard Cost, Specific Identification

Partial Layer Consumption

Multi-Layer Sale

COGS Engine

Landed Cost

Returns & Adjustments

Negative Stock Policy (قابل پیکربندی)

هسته هرگز نباید فقط Sale Price − Purchase Price محاسبه کند.

Cost Layer Rules

هر Layer حداقل شامل:

Layer ID, Product, Warehouse, Source Document/Line

Received Qty, Remaining Qty, Unit Cost, Currency, Created At

مصرف FIFO: Oldest → Consume → Next…
هر مصرف قابل trace باشد (Sale → Cost Layers → Purchase Documents).

۳. ۲۰۰+ قابلیت اصلی (خلاصه ساختاریافته)

A. Accounting & GL

Chart of Accounts, Hierarchy, Journal Entry + Lines, Debit/Credit & Balanced Validation, General Ledger, Trial Balance, Opening/Closing, Fiscal Years/Periods, Posting/Document Dates, Numbering, Reversal, Adjustment, Recurring, Accrual/Deferral, Control Accounts, Retained Earnings, Equity, P&L, Balance Sheet, Cash Flow, Dimensions.

B. Inventory & Costing

Items, Stock Movements/Ledger, Receipts/Issues/Transfers/Adjustments/Counts, Reconciliation, Valuation, FIFO Layers, AVCO, Standard, Specific ID, COGS, Layer Creation/Consumption, Partial & Multi-Layer, Negative Stock Rules, Backdated Tx, Revaluation, Write-Off, Damaged/Expired, Reserved, Available-to-Sell, Valuation by Warehouse, Landed Cost.

C. Sales

Customer, Quotation, SO, Invoice + Lines, Returns, Credit Notes, Discounts (line/invoice), Taxes, Shipping, Delivery Notes, Partial Delivery/Invoicing, Price Lists & Rules, Min/Max Price, Salesperson/Commission, Approval, Cancellation, Draft→Posted States, Payment Status, Statements.

D. Purchases

Supplier, PR, PO, Bill + Lines, Returns, Debit Notes, Discounts, Taxes, Receiving, Partial Receiving/Billing, Price Lists, Approval, Statements.

E. AR / AP

Receivable/Payable Ledgers, Payment Allocation (partial/over/under/on-account/advance), Reversal, Outstanding, Aging, Due Date, Credit Limit/Hold, Bad Debt + Recovery, Write-Off, Settlement.

F. Cash & Banking

Cash/Bank Accounts, Deposits/Withdrawals/Transfers, Reconciliation, Statement Import, Matching, Adjustments, Unreconciled, Cash Flow Forecast, Petty Cash, Closing, Fees.

G. Tax

Profiles, Rules, Rates, Inclusive/Exclusive/Compound, Exemptions, Overrides, Rounding, Tax on Discount/Shipping, Purchase/Sales Tax, Payable/Receivable.

H. Currency & Precision

Multi-Currency, Historical Rates, Realized/Unrealized FX Gain/Loss, Revaluation, Snapshots, Decimal-safe / Integer Minor Units arithmetic. Floating-point برای منطق مالی ممنوع.

I. Fixed Assets & Expenses

Register, Acquisition, Capitalization, Depreciation (SL / Declining), Disposal, Transfer, Revaluation, Impairment, Expense Claims/Categories/Recurring/Approval/Reimbursement.

J. Reporting, Security & Controls

تمام گزارش‌های مالی + Inventory + COGS + Margin + Aging + Tax، Audit Trail immutable، Period Lock، Permission-aware Reporting، Record-level + Field-level Authorization، SoD، RLS، Idempotent Commands، Concurrency Control، Audit-ready Reproducibility.

۴. Workflow Engine Core (جدید — الزامی)

Approval و فرآیندهای چندمرحله‌ای بدون hardcode.

قابلیت‌ها

Approval Chains (sequential / parallel)

Conditional Approvals (based on amount, customer, supplier, product, currency…)

Escalation Rules

Delegation

Timeout / Auto-action

Audit of every approval step

مثال‌ها

Invoice Amount > 5,000,000 AFN → Manager Approval
Purchase > New Supplier → Procurement + Finance Approval
Expense > Policy Limit → Exception Approval
Discount > 15% → Sales Manager Approval

Workflow باید با State Machine اسناد مالی یکپارچه باشد.

۵. Rules Engine Core (جدید — الزامی)

قوانین کسب‌وکار بدون تغییر کد.

ساختار Rule

type BusinessRule = {
id: string
name: string
entity: string // Invoice, Payment, Discount...
conditions: Condition[]
actions: Action[]
priority: number
active: boolean
}

مثال

اگر:
Customer.Segment = "VIP"
AND Invoice.Amount > 10000 USD
AND Currency = "USD"

پس:
Require Discount Approval
OR Apply Loyalty Discount 3%

Rules Engine باید قبل از Command اجرا شود و نتیجه را به Domain برگرداند.

۶. Master Data Management Core (جدید)

ERPهای بزرگ روی MDM سرمایه‌گذاری سنگین می‌کنند.

قابلیت‌ها

Product Master (با Variants, UoM, Attributes)

Customer Master

Supplier Master

Warehouse Master

Chart of Accounts Master

Duplicate Detection (fuzzy + exact)

Merge Records (با audit و انتقال تاریخچه)

Validation Rules

Change History

Golden Record concept

۷. AI Business Copilot Core (جدید — مزیت رقابتی نسل جدید)

کاربر بتواند به زبان طبیعی سؤال کند و سیستم پاسخ دقیق + actionable بدهد.

مثال‌های واقعی

کاربر: «چرا سود من در ۳۰ روز گذشته کم شده؟»

AI پاسخ:

در ۳۰ روز گذشته:

• خرید موبایل A35: +120 عدد
• حاشیه سود متوسط: 18% → 7%

دلایل اصلی:

1. افزایش قیمت تأمین‌کننده ۱۲٪
2. کاهش قیمت فروش ۸٪ (برای رقابت)

پیشنهادات:
• افزایش قیمت فروش ۵٪
• یا تغییر تأمین‌کننده (تأمین‌کننده B حاشیه بهتری دارد)
• بررسی موجودی قدیمی با Cost Layer بالا

قابلیت‌های حداقل:

Profitability Analysis

Cost Layer Impact

Cash Flow Anomaly Detection

Inventory Aging Insights

Customer / Product Ranking

Natural Language Query over Financial Data

Explanation of any Journal / COGS / Gross Profit

AI هرگز نباید منطق مالی authoritative را جایگزین Domain کند؛ فقط تحلیل و پیشنهاد می‌دهد.

۸. Marketplace / Ecosystem Core (جدید)

مزیت بزرگ Odoo App Store است. Hisabche باید از ابتدا طراحی شود تا:

Hisabche Marketplace
├── Tax Plugins (کشورهای مختلف)
├── Payment Providers (local + international)
├── Banking Connectors
├── AI Agents
├── Industry Templates (Retail, Wholesale, Service, Manufacturing)
├── Custom Reports
├── Workflow Templates
├── Integration Apps

هر Plugin باید:

از طریق contract مشخص با Coreها ارتباط بگیرد

sandbox security داشته باشد

versioned و audit-able باشد

۹. قراردادهای UI / Domain

Command

type DomainCommand<TPayload> = {
commandId: string
workspaceId: string
actorId: string
payload: TPayload
idempotencyKey: string
clientMutationId?: string
}

Result

type DomainResult<TResult> = {
success: boolean
data?: TResult
error?: DomainError
events: DomainEvent[]
warnings: DomainWarning[]
}

Error

type DomainError = {
code: string
messageKey: string // فقط key برای i18n
field?: string
details?: Record<string, unknown>
}

Domain هرگز متن hardcoded UI برنمی‌گرداند.

Query

فقط read-only. نمونه‌ها: GetInvoice, ListInvoices, GetCustomerBalance, GetInventory, GetCostLayers, GetProfitSummary, GetTrialBalance, GetGeneralLedger.

Read Model

تمام محاسبات authoritative در Domain/Server انجام می‌شود. UI فقط نمایش می‌دهد.

UiAction

enabled / visible / requiresConfirmation / destructive بر اساس Domain + Authorization + Workflow.

۱۰. State Machine اسناد مالی

DRAFT → SUBMITTED → APPROVED → POSTED → PARTIALLY_PAID → PAID / SETTLED
(و مسیرهای Cancellation / Reversal)

انتقال‌های غیرمجاز فقط در Domain رد می‌شوند.

۱۱. Offline-First (الزام مطلق)

تمام financial mutations: idempotent + ordered + retry-safe + crash-safe

Unsynced financial data هرگز silent delete نمی‌شود

Conflict مالی با Last-Write-Wins حل نمی‌شود

در conflict غیرقابل حل خودکار:
PRESERVE BOTH → REVIEW → AUTHORIZED RESOLUTION → AUDIT

۱۲. Authorization لایه‌ای

Authentication → Workspace Membership → Role/Permission → Record-level → Field-level → UI Visibility

UI Visibility ≠ Authorization

۱۳. Precision & Invariants مالی

پول فقط با Integer Minor Units یا Decimal معتبر

Total Debit = Total Credit (برای posted journals)

Inventory Value = Σ (remaining qty × layer unit cost) مطابق روش costing

Outstanding = Invoice Total − Allocated Payments

Gross Profit = Revenue − COGS

Quantity ≥ 0 مگر Negative Stock Policy صراحتاً اجازه دهد

این invariantها باید unit-test و integration-test شوند.

۱۴. Event-Driven Integration

SalesInvoicePosted → Revenue + AR + Inventory Reduction + COGS + Journal
PurchaseInvoicePosted → Inventory + Cost Layer + AP + Journal

Events باید deterministic، auditable، idempotent و reversible باشند.

۱۵. Audit

هر mutation مالی حداقل: mutationId, actorId, workspaceId, timestamp, source, entityType, entityId, before, after, reason, idempotencyKey, correlationId

Audit trail غیرقابل تغییر توسط کاربر عادی.

۱۶. Adaptive UI & Performance

Client complexity نباید با تعداد کل قابلیت‌ها scale شود.
فقط Visible Features + Context + Authorization + Device + Network.

چهار سطح Visibility: Module / Page / Widget / Field
Hide ≠ Delete ≠ Disable Data ≠ Revoke Security

Performance الزامات: Lazy Loading, Code Splitting, Virtualization, Server Aggregation, Batched Sync, Bounded Cache, Worker-based heavy processing, Performance Budgets.

۱۷. Testing Matrix (اجباری)

Unit: Formula, Validation, State Transition, Costing, Tax, Currency, Discount, Allocation, Rules, Workflow

Integration: Ledger Posting, Inventory Posting, Payment Allocation, AR/AP, Workflow Triggers

Security: Tenant Isolation, RLS, Record/Field Auth, SoD

Offline: Retry, Duplicate, Ordering, Conflict, Reconnect, Crash Recovery

UI: Visibility, Action Availability, Loading/Error/Empty/Offline/Conflict states

AI: Explanation correctness, no hallucination of financial numbers

۱۸. Definition of Done برای هر Core

یک Core فقط وقتی Done است که:

Business Rules مستند

Gap Analysis تکمیل

Domain Logic authoritative

Commands / Queries / Read Models / Actions مشخص

Authorization + Audit + Idempotency

Offline + Conflict behavior مشخص

Tests سبز (شامل financial invariants)

i18n کامل

Performance قابل اندازه‌گیری

Reversal/Correction audit-ready

۱۹. Golden Rules (غیرقابل نقض)

Never put authoritative financial logic in the UI.

Never silently delete posted financial data.

Never use UI visibility as security.

Never resolve financial conflicts with blind Last-Write-Wins.

Never allow duplicate financial mutations.

Never lose unsynced financial data.

Never use floating-point for authoritative money.

Never tightly couple Core boundaries.

Never sacrifice financial correctness for UI performance.

Never sacrifice authorization for UX convenience.

Every important financial mutation must be auditable and reproducible.

Client complexity must not scale with total product complexity.

Offline is a first-class mode, not an error state.

Server/Domain Engine is the single source of truth.

AI Copilot explains and suggests — never overrides Domain Core.

Workflow and Rules must be configurable without code change.

Hisabche competes through integration depth, correctness, offline-first, usability, native architecture and AI — not by feature-count copying.

اصل نهایی

Purchase → Inventory → Cost Layer → Sale → COGS → Gross Profit → General Ledger → Reports
Sale → AR → Payment → Allocation → Outstanding → Customer Statement
Purchase → AP → Payment → Allocation → Supplier Statement

Build Hisabche as independent domain cores with deterministic financial behavior, precise cost-layer costing, offline-safe mutations, strict multi-layer authorization, configurable workflow & rules, AI-powered insights, and UI contracts that expose only what the current user and business context actually need.

این سند نسخهٔ نهایی Super Master Spec است و می‌تواند مستقیماً به‌عنوان مرجع معماری پروژه استفاده شود.
