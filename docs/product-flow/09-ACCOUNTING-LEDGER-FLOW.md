# 09 — ACCOUNTING & LEDGER FLOW

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×6، PARTIAL ×2، NOT_VERIFIED ×1
مرتبط: [05](05-SALES-INVOICE-FLOW.md) · [08](08-PAYMENT-CASHBOX-FLOW.md) · [14](14-REPORTING-DATA-FLOW.md)

## CORE-003

`AccountingService` (`backend/src/services/accounting/accounting.service.ts`) با درگاه `ledger` (`ledger.port.ts`):

- `postDocument(ctx,{sourceType,sourceId,date,lines})` — idempotent بر اساس (workspace, sourceType, sourceId) ⇒ `already_posted`.
- `reverseDocument(ctx, sourceType, sourceId, {reason})` (`:632-647`): فقط اگر `status==='posted'`؛ سپس `reverseJournalEntry` یک سند جدید `posted` می‌سازد (`:514-540`)، در دورهٔ بسته fail-closed.
- `ensureAccountsForRoles(ctx, roles)` — نقش‌های: cash, bank, receivable, payable, sales, cogs, inventory, tax, purchase, fx_gain_loss, bank_fees, salary_expense, …
- توازن سند فقط در تابع Postgres `accounting_post_journal_entry` سنجیده می‌شود (CLAUDE.md؛ قید 02 db-integrity: تریگر deferred).

## منابع سند (`LedgerSourceType`) که در این فاز خط‌هایشان از کد خوانده شد

| source                     | خطوط                                                                                                                                 | منبع                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| invoice (sale)             | Dr receivable / Cr sales[/Cr tax] / Dr cogs / Cr inventory                                                                           | `invoice-posting.domain.ts:37-91`                                                                 |
| invoice (purchase)         | Dr inventory / Cr payable                                                                                                            | همان                                                                                              |
| payment                    | Dr cash                                                                                                                              | bank / Cr receivable (in)؛ Dr payable / Cr cash                                                   | bank (out)؛ ± کارمزد، ± fx | `payments.service.ts:596-690` |
| invoice return (sale)      | Dr sales / Cr receivable؛ + Dr inventory / Cr cogs                                                                                   | `invoice-return-02…sql:306-340`                                                                   |
| invoice return (purchase)  | Dr payable / Cr inventory [/ Cr tax]                                                                                                 | `…sql:266-300`                                                                                    |
| pos_session                | Dr cash(counted) / Cr sales / Dr bank / Dr receivable / ± purchase / ± variance(sales)                                               | `till-view.ts:185-232`                                                                            |
| payroll                    | Dr salary_expense (gross) / Cr tax / Cr payable(کسورات) / Cr cash                                                                    | bank(net)                                                                                         | `payroll-rules.ts:78-100`  |
| opening capital / transfer | Dr asset / Cr capital؛ Dr bank / Cr cash                                                                                             | `till-view.ts`                                                                                    |
| cost_repost                | سند «بهای دیرهنگام» مشتق‌شده با `lateCostKey`                                                                                        | `invoice.service.ts:1812`                                                                         |
| year-end close             | Dr revenue / Cr expense / → retained earnings (سند عادی)                                                                             | `year-end.domain.ts` (route `/year-end/plan` & `/year-end/close`: `accounting.routes.ts:679-702`) |
| موجودی اول کالا            | `ProductService.bookOpeningStock` (`product.service.ts:569`) با `ledger.postDocument` — خطوط آن در این فاز خوانده نشد (NOT_VERIFIED) | `product.service.ts:569`                                                                          |
| `stock_adjustment`         | **هیچ** سندی نمی‌زند (فقط در نوع؛ تعدیل از `update` فقط `stock_movements` می‌نویسد)                                                  | `ledger.port.ts:27`, `product.service.ts:730-761`                                                 |

فراخوانندگان واقعی `ledger.postDocument` (grep، بدون تست): `invoice.service`, `payments.service`, `pos.service`, `human-resources.service`, `product.service`, `assets.service`, `currency.service`. فراخوانندگان `ledger.reverseDocument`: فقط `invoice.service` و `payments.service`.

## قفل دوره

`PUT /period-lock` با `ledger.lock_period` (owner) (`accounting.routes.ts:337`). بستن ماه: `month-end.service.ts` (ناخوانده: NOT_VERIFIED).

## تفاوت آنلاین/آفلاین

آنلاین: Postgres، جدول‌های `journal_entries/journal_lines`. آفلاین: `journal_entry/journal_line` در SQLite با همان `invoiceLedgerLines` (قاعدهٔ مشترک `@hisabche/validation`)، ولی معکوس‌سازی با تغییر `status='reversed'` (`local invoices.ts:1053-1063`) و نه سند جدید.

## مشاهدات معماری (فقط حقایق)

1. دریافت کالای سفارش خرید (PO receive) سند دفتر کل نمی‌زند ([06](06-PURCHASE-FLOW.md)).
2. تعدیل/انتقال موجودی سند ندارند ([07](07-INVENTORY-FLOW.md)).
3. بستن صندوق ارز خارجی: بدون سند.
4. جدول‌های مرده طبق CLAUDE.md: `ledger_entries`, `sync_queue`(سرور), `sync_logs`, `journal_lines_archive`.
