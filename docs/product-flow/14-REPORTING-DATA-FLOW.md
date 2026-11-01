# 14 — REPORTING & DASHBOARD DATA FLOW

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×4، PARTIAL ×2، NOT_VERIFIED ×2
مرتبط: [09](09-ACCOUNTING-LEDGER-FLOW.md) · [10](10-CUSTOMER-SUPPLIER-FLOW.md) · [05](05-SALES-INVOICE-FLOW.md)

## ۱. داشبورد (`/dashboard`)

`useDashboardData` → `GET /api/analytics/dashboard` (`backend/src/routes/analytics.routes.ts:128-170`; cache `scope:'member'`, ttl 30s) → `analyticsService.getDashboardKpis(ctx, tz)` (`backend/src/services/analytics.service.ts:132-262`; cache کلید `dashboard:v3:<ws>:<tz>` 60s).

مسیر اصلی: RPC تجمیعی `analytics_dashboard_kpis` (`fetchDashboardAggregate`)؛ فقط اگر نصب نباشد، fallback روی خطوط جدول `invoices` (سقف ۱۰۰۰ ردیف PostgREST—کامنت `:136-138`).

فرمول‌های fallback (واقعی):

| KPI               | فرمول                                                         | منبع       |
| ----------------- | ------------------------------------------------------------- | ---------- |
| `totalSales`      | Σ `invoices.total` برای نوع ≠ purchase و ارز = ارز دفاتر      | `:212`     |
| `totalPurchases`  | Σ `total` برای type=purchase، ارز دفاتر                       | `:213-216` |
| `customerDebt`    | Σ (`total` − `paid_amount`) برای فروش‌هایی که `isOutstanding` | `:221-226` |
| `supplierPayable` | همان برای خرید                                                | `:229-233` |
| `todaySales`      | Σ `total` فروش‌هایی که `date ≥ startOfLocalDayISO(tz)`        | `:245-250` |
| `warehouseValue`  | Σ `products.quantity × buy_price` برای `is_active`            | `:170-173` |
| `lowStockAlerts`  | تعداد `quantity ≤ min_stock_level`                            | `:166-169` |

نمایش: بخش‌ها طبق `profile.dashboard` (دسته) یا چیدمان شخصی (`dashboard-container.tsx:84`)؛ ارقام غیرمجاز با `maskDashboardKpis` صفر و در `hidden` نام‌برده می‌شوند (`analytics.routes.ts:158-163`).

⚠️ مشاهدهٔ معماری (حقیقت): KPIها از **جدول `invoices`** (`total`, `paid_amount`) محاسبه می‌شوند، نه از دفتر کل. برگشت‌ها (`invoice_returns`) از `totalSales` کم نمی‌شوند (grep: `invoice_return` در `getDashboardKpis` وجود ندارد). `paid_amount` یک projection از `payment_allocations` است. ⇒ ریسک drift بین داشبورد و تراز؛ مرتبط: کامیت `0b694c23` که این هم‌خوانی را برای «open invoices / customers list» اصلاح کرده، نه برای KPI داشبورد (بررسی نشده).

## ۲. سود و زیان

`AccountingService.getProfitReport` → `buildProfitReport` (`packages/validation/src/schemas/profit-report.domain.ts:216`) — قاعدهٔ مشترک سرور و آفلاین.

- Revenue: `lineRevenues(invoice, lines)` برای فاکتورهای هم‌ارز با گزارش.
- Cost: از ردیف‌های **`cost_consumptions`** (کلید `invoiceId:productId`)، نه از دفتر کل.
- `costStatus ∈ none|known|estimated|partial|unknown`؛ برای `partial/unknown` سود و حاشیه `null` است («نامعلوم، صفر نیست»، گارد `unknown-is-not-zero.test.ts`).
- ⇒ سود محاسبه‌شده می‌تواند با `Σ(sales)−Σ(cogs)` دفتر کل اختلاف داشته باشد؛ منبع حقیقت دوم (cost_consumptions در برابر journal COGS). VERIFIED_SOURCE (ساختار)؛ مقدار اختلاف زنده NOT_VERIFIED.

## ۳. تراز آزمایشی / صورت‌های مالی

`AccountingService.getTrialBalance` (`accounting.service.ts:671`) از `journal_entries/journal_lines` (ledger) با کش و فیلتر شعبه. `debitBalance/creditBalance` را سرور می‌دهد (UI علامت را حدس نمی‌زند). VERIFIED_SOURCE.

## ۴. موجودی و ارزش موجودی

- مقدار: `products.quantity` projection از `stock_movements` (تریگر `stock_movements_project`) — `product.service.ts:709-712`. موجودی هر انبار: `product_stock`, `warehouse-summary.domain.ts`.
- ارزش: هم fallback و هم RPC (`docs/dashboard-fx-01-migration.sql:129-139`، `warehouse_value = SUM(q * bp)`) برابر `quantity × buy_price` فعلی کالاست — **نه** ارزش لایه‌های بها. در همان SQL هیچ ارجاعی به `invoice_returns` نیست (grep: 0)، پس KPI فروش داشبورد هر دو مسیر برگشت‌ها را کم نمی‌کند (VERIFIED_SOURCE).

## ۵. مانده مشتری/تأمین‌کننده

`CustomerService.getBalance` (`customer.service.ts:~940-990`): `partyBalancesByCurrency` روی «تراکنش‌ها + برگشت‌ها»؛ برگشت فروش با `saleReturnsOf(...)` اضافه می‌شود (کامیت `aff2e0c9`). از دفتر کل `receivable` نمی‌آید. جزئیات: [10](10-CUSTOMER-SUPPLIER-FLOW.md).

## ۶. جدول drift-risk (مقدار مستقل از منبع حقیقت)

| عدد                               | محاسبه از                         | جایگزین            |
| --------------------------------- | --------------------------------- | ------------------ |
| totalSales/customerDebt (داشبورد) | `invoices`                        | دفتر کل receivable |
| سود محصول/فاکتور                  | `cost_consumptions` + خطوط فاکتور | journal sales−cogs |
| ارزش انبار (fallback)             | `quantity × buy_price`            | لایه‌های بها       |
| مانده مشتری                       | اسناد (فاکتور/پرداخت/برگشت)       | دفتر کل            |
| موجودی کالا                       | `stock_movements` projection      | `product_stock`    |

NOT_VERIFIED: گزارش‌های سفارشی (`custom-reports.routes.ts`, `reporting/report.service.ts`, `dataset.domain.ts`)، تحلیل (`analysis.service`)، و گزارش‌های برنامه‌ریزی‌شده خوانده نشدند.
