# 05 — SALES INVOICE FLOW (FLOW-001 … FLOW-006)

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×5، PARTIAL ×2 (برگشت، دفتر کل آفلاین)، VERIFIED_RUNTIME ×0
مرتبط: [08-PAYMENT-CASHBOX](08-PAYMENT-CASHBOX-FLOW.md) · [09-ACCOUNTING-LEDGER](09-ACCOUNTING-LEDGER-FLOW.md) · [12-OFFLINE-SYNC](12-OFFLINE-SYNC-FLOW.md) · [20-ANSWERS](20-ANSWERS-TO-THE-FOUR-QUESTIONS.md)

> هیچ‌کدام `VERIFIED_RUNTIME` نیست: در این فاز اجرای زنده انجام نشد. تست‌های موجود (مثلاً `invoice-return*.test.ts`) فقط `VERIFIED_SOURCE` را پشتیبانی می‌کنند. کامیت‌های `7e28bc55`/`8141db6d` مدعی تأیید زندهٔ برگشت‌اند؛ این ادعا اینجا بازتولید نشده.

---

## FLOW-001 — ثبت فاکتور فروش با پرداخت (آنلاین)

Actor: عضو workspace با `invoice.create` · Entry: `SCR` فاکتورساز (`/invoices/new`, `invoice-builder-container.tsx`) → `POST /api/invoices`
Core: **CORE-001** = `InvoiceService.create` (`backend/src/services/invoice.service.ts:789`)

```mermaid
sequenceDiagram
  participant UI as invoice-builder
  participant R as POST /api/invoices
  participant S as InvoiceService.create :789
  participant DB as Postgres (RPC invoice_write_document)
  participant C as costing core
  participant L as ledger.postDocument
  participant P as PaymentsService.recordPayment
  UI->>R: body + Idempotency-Key
  R->>S: ctx(workspace,user), data, branchId
  S->>S: replay? findByClientRequestId :811
  S->>S: withDerivedLineTotals + computeInvoiceMoney :863-870
  S->>S: 4 parallel reads: warehouse, customer, approval decision, plan quota :877-911
  S->>S: exchange rate required if currency≠books :920
  S->>S: INVOICE_CREDIT_NEEDS_PARTY :971
  S->>S: generateInvoiceNumber (nextval) :975
  S->>DB: writeInvoiceDocument header+items+details+movements :1120
  S->>S: sod.recordAction invoice.create :1222; applyTax :1236
  S->>C: applyCosting (COGS from consumed layers) :1273
  S->>L: createAccountingEntries → invoiceLedgerLines :1282
  S->>S: markPosted :1302
  S->>P: recordCreationPayments → recordPayment per tranche :1327
  S-->>UI: getById
```

| لایه             | رفتار                                                                                                                                                             | منبع                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Idempotency      | کلید `client_request_id`؛ بازپخش همان فاکتور را برمی‌گرداند؛ ۲۳۵۰۵ هم‌زمان → برندهٔ دیگر                                                                          | `invoice.service.ts:811-814,1128-1138`                    |
| محاسبهٔ مبلغ     | سرور از خطوط می‌سازد؛ `total` بدنه نادیده گرفته می‌شود                                                                                                            | `:846-870`                                                |
| ارز              | غیرهم‌ارز بدون `exchangeRate` → `INVOICE_EXCHANGE_RATE_REQUIRED`؛ نرخ روی `invoices.exchange_rate` منجمد                                                          | `:920-942`                                                |
| بدهی بدون طرف    | `INVOICE_CREDIT_NEEDS_PARTY`                                                                                                                                      | `:971-973`                                                |
| شماره            | `get_next_invoice_number` (nextval)                                                                                                                               | `:975`, `:3476`                                           |
| تأیید (approval) | تصمیم قبل از جابجایی موجودی؛ فاکتور «در انتظار» موجودی/دفتر نمی‌زند                                                                                               | `:1004,1161-1175,1314-1324`                               |
| سقف پلن          | `assertWithinLimit(workspaceId,'invoices')` (به‌جز import/سیستمی)                                                                                                 | `:895-910`, `plan-limits.service.ts:223`                  |
| تراکنش           | **یک RPC** `invoice_write_document`: هدر + اقلام + جزئیات + `stock_movements`. خارج از تراکنش: tax، costing، ledger، payments، اعلان                              | `:1120-1126`, `docs/invoice-write-document-migration.sql` |
| موجودی           | `planStockMovements` → `stock_movements` (جهت −1 فروش / +1 خرید)؛ منفی‌شدن `flagNegativeStock` conflict می‌سازد، رد نمی‌کند                                       | `:1102-1110,1157-1159`                                    |
| بها              | `applyCosting` مصرف لایه‌ها؛ `uncosted` فقط warn                                                                                                                  | `:1271-1309`                                              |
| دفتر کل          | `ledger.postDocument(sourceType:'invoice')` — خطوط واقعی در جدول زیر                                                                                              | `:3043-3130`                                              |
| پرداخت           | هر tranche = یک `recordPayment` جدا؛ `paid_amount` همیشه ۰ در INSERT و از allocation مشتق می‌شود                                                                  | `:1050,1400-1450`                                         |
| Audit            | `logBusinessEvent(created)` fire-and-forget؛ `sod.recordAction`                                                                                                   | `:1222,1331-1346`                                         |
| Cache            | `invalidateWorkspaceCache` (dashboard/sales/insights/invoices/customers/products)                                                                                 | `:1214,1865-1872`                                         |
| Permission       | route: `requireCapability('invoice.create')`؛ **مطابق CLAUDE.md** گزارش‌شده که POST invoices در route گارد ندارد—در این فاز route دوباره خوانده نشد: NOT_VERIFIED | —                                                         |

### خطوط دفتر کل فروش (واقعی) — `packages/validation/src/schemas/invoice-posting.domain.ts:37-91`

| سمت | حساب (role) | مبلغ                                                  |
| --- | ----------- | ----------------------------------------------------- |
| Dr  | receivable  | total (به ارز دفاتر)                                  |
| Cr  | sales       | total − tax (یا total اگر tax=0 / حساب tax نیست)      |
| Cr  | tax         | taxTotal (فقط اگر `tax>0` و حساب tax وجود داشته باشد) |
| Dr  | cogs        | COGS از لایه‌های مصرف‌شده (فقط اگر >0)                |
| Cr  | inventory   | همان COGS                                             |

خرید: Dr inventory / Cr payable. حساب نبودن → `status:'skipped'` و فاکتور **ثبت می‌ماند ولی posted نمی‌شود** (`:3081-3090`).

### پرداخت — `payments.service.ts:596-690` (+ `payments.domain.ts:762 paymentPosting`)

دریافت: Dr (`cash` اگر method=cash، وگرنه `bank`) = cash؛ [Dr کارمزد]؛ Cr receivable = party؛ تفاوت ارز به حساب `fx_gain_loss`. پرداخت: Dr payable / Cr cash|bank. صندوق (till) با `tillSessionId` و فقط برای نقد (`assertTillTakes` قبل از نوشتن: `invoice.service.ts:931-941`).

---

## FLOW-002 — همین عمل در مسیر آفلاین (موتور محلی SQLite)

Entry: `localRequest` → `router.post('/invoices')` — `packages/local-engine/src/routes/invoices.ts:482-905`.

| جنبه                                                                | آفلاین                                                                                                                                      | تفاوت با FLOW-001                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| تراکنش                                                              | `db.transaction(...)` کل هدر/اقلام/موجودی/دفتر/پرداخت/outbox                                                                                | یک تراکنش SQLite برای همه (آنلاین چند مرحله)                 |
| شماره                                                               | `OFF-<device>-<seq>` موقت (`:526-543`)                                                                                                      | شمارهٔ رسمی فقط بعد از sync                                  |
| مبلغ                                                                | `sumInvoiceLines`/`computeItemTotal` مشترک (`:552-593`)                                                                                     | همان قاعده، پیاده‌سازی جدا                                   |
| دفتر کل                                                             | همان `invoiceLedgerLines` مشترک (`:774-826`)                                                                                                | **منبع قانون یکی است**                                       |
| موجودی                                                              | `inventory_movement` + `product_stock` (`:604-700`)                                                                                         | جدول‌های محلی                                                |
| بها                                                                 | `cost_layer` محلی (`:728`)                                                                                                                  | —                                                            |
| پرداخت                                                              | `paidAmount`→ یک `payment` + `payment_allocation` با `status 'completed'/'partial'` (`:828-877`)                                            | آنلاین: `recordPayment` + till؛ آفلاین: بدون till/ارز/کارمزد |
| outbox                                                              | `buildEnqueue({entity:'invoice',operation:'create'})` در همان تراکنش، فقط اگر هدر `x-hisabche-queue: 1` (`:885-895`)                        | آنلاین: ندارد                                                |
| قواعدی که در مسیر آفلاین **پیدا نشد** (شمارش grep در بازهٔ ۴۸۲-۹۰۵) | `INVOICE_CREDIT_NEEDS_PARTY` (0)، approval (0)، `assertWithinLimit` (0)، `tillSessionId` (0)، `requireCapability` (0)، flag موجودی منفی (0) | تفاوت قانون کسب‌وکاری بین دو مسیر                            |

⚠️ مسیر آفلاین گارد `requireCapability` برای _ایجاد_ ندارد (فقط cancel گارد `invoice.delete` دارد: `:913`). اینکه لایهٔ دیگری (Router/bridge) نقش `viewer` را از نوشتن باز می‌دارد، **NOT_VERIFIED** است؛ نقش پیش‌فرض ناشناخته `viewer` است (`context.ts:106`).

پس از اتصال: `pushEntry` → `POST /invoices` دامنه (`sync-engine.ts:659-668`) ⇒ **سرور فاکتور را دوباره از `InvoiceService.create` رد می‌کند** (شماره رسمی، approval، سقف، ...). جزئیات در [12](12-OFFLINE-SYNC-FLOW.md).

---

## FLOW-003 — لغو فاکتور (online) — `PATCH status='cancelled'`

`invoice.service.ts:1470-1500` → `paymentsSettlingOnly` → `reverseEffects` (`:1803-1830`).

## FLOW-004 — حذف فاکتور — `InvoiceService.delete` (`:1675-1705`) → همان `reverseEffects` → حذف `invoice_tax_lines`/`invoice_installments`.

| اثر                                 | برمی‌گردد؟                                                                                                                    | مکانیزم                                                                                   | منبع                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| سند دفتر فاکتور                     | بله                                                                                                                           | `ledger.reverseDocument('invoice')` → سند معکوس جدید (`reverseJournalEntry`)              | `:1809`, `accounting.service.ts:632-647` |
| سند «بهای دیرهنگام» (`cost_repost`) | بله                                                                                                                           | `reverseDocument('cost_repost', lateCostKey)`                                             | `:1812`                                  |
| پرداخت‌های مخصوص همین فاکتور        | بله                                                                                                                           | `payments.cancelPayment` → `ledger.reverseDocument('payment')` و ردیف `cancelled` می‌ماند | `:1814-1816`, `payments.service.ts:739`  |
| پرداخت مشترک با فاکتور دیگر         | **نه** — `INVOICE_PAYMENT_SHARED` و هیچ تغییری                                                                                | `paymentsSettlingOnly` قبل از هر نوشتن                                                    | `:1500,1700`                             |
| موجودی                              | بله                                                                                                                           | حرکت معکوس از روی حرکات ثبت‌شده (`reversalOfRecordedMovements`)                           | `:1818-1822`                             |
| لایه‌های بهای **فروش**              | بله — `remaining_qty` برمی‌گردد                                                                                               | `costing.releaseDocument`                                                                 | `:1827`                                  |
| لایهٔ بهای **فاکتور خرید**          | **نه** (ممکن است فروش‌های بعدی از آن خورده باشند)                                                                             | کامنت `:1824-1826`                                                                        | —                                        |
| سریال‌ها و ساعت‌های صورت‌حساب‌شده   | بله                                                                                                                           | `releaseClaims`                                                                           | `:1843-1862`                             |
| سطرهای مالیات/اقساط                 | فقط در **حذف**، در لغو نه                                                                                                     | `:1710-1720`                                                                              | —                                        |
| اعلان ارسال‌شده، رویداد audit       | **نه** (فقط رویداد جدید)                                                                                                      | —                                                                                         | —                                        |
| ترتیب/اتمیک                         | مراحل پشت‌سرهم و **بدون تراکنش واحد**؛ دفتر اول (تنها مرحله‌ای که ممکن است رد شود، مثل دورهٔ بسته) تا رد شدن چیزی را لغو نکند | `:1803-1830`                                                                              | —                                        |

آفلاین (`invoices.ts:908-1135`): لغو = بازگرداندن موجودی/لایه‌ها، **`UPDATE journal_entry SET status='reversed'`** (سند معکوس جدید نمی‌سازد، `:1053-1063`)، لغو allocationها و سند پرداخت (`:1065-1084`)، `invoice.status='cancelled'`، و اگر create هنوز نفرستاده شده، ردیف outbox `cancelled` می‌شود (squash)، وگرنه `delete` در صف (`:1110-1131`). ⇒ **دو الگوی متفاوت دفتر کل** (معکوس‌سازی با سند جدید در برابر تغییر وضعیت). PARTIAL: رفتار pull/سازگاری این دو بررسی نشد.

---

## FLOW-005 — برگشت از فروش (sale return) — `POST /api/invoices/:id/returns`

Route: `invoice-return.routes.ts` (`requireCapability('invoice.create')` برای نوشتن، `:19`). Service: `InvoiceReturnService.createReturn` (`backend/src/services/sales/invoice-return.service.ts:43-155`) → **RPC اتمیک `invoice_return_create`** (`docs/invoice-return-01-migration.sql` و `docs/invoice-return-02-purchase-return-accounting-migration.sql`).

| اثر                                             | sale_return                                                                                                                                             | purchase_return                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ردیف `invoice_returns` + `invoice_return_lines` | بله                                                                                                                                                     | بله                                                                                                                   |
| موجودی                                          | 01: `INSERT stock_movements` (`type 'purchase'`, `to_warehouse_id`, `reference_type 'invoice_return'`) فقط برای `restock` و انبار شناخته (`01:243-259`) | 02: `UPDATE product_stock`/`products.quantity` کم می‌شود؛ کمبود → `PURCHASE_RETURN_INSUFFICIENT_STOCK` (`02:171-206`) |
| لایهٔ بها                                       | 01: `cost_consumptions` (۶ ارجاع)                                                                                                                       | 02: `cost_layers.remaining_qty -= qty` (`:225-231`)                                                                   |
| دفتر کل                                         | Dr sales / Cr receivable (کل مبلغ بازگشتی)، و اگر بهای بازگشتی>0: Dr inventory / Cr cogs (`02:306-340`)                                                 | Dr payable / Cr inventory [+ Cr tax] (`02:266-300`)                                                                   |
| پرداخت/بازپرداخت پول                            | **هیچ** — برگشت پرداخت را لغو نمی‌کند                                                                                                                   | هیچ                                                                                                                   |
| سند فاکتور اصلی                                 | دست‌نخورده (لغو نمی‌شود)                                                                                                                                | دست‌نخورده                                                                                                            |

مشاهدات (فقط‌حقایق، بدون باگ‌گزارش جدید):

1. **دو تعریف `CREATE OR REPLACE FUNCTION invoice_return_create`** در `docs/`؛ نسخهٔ 02 (جدیدتر) در خود فایل **هیچ `INSERT INTO stock_movements`** برای بازگرداندن موجودی فروش ندارد و `cost_consumptions` هم ندارد (grep: 0 مورد، در 01: 6). اگر 02 روی دیتابیس زنده اجرا شده باشد، برگشت فروش موجودی را برنمی‌گرداند. کدام نسخه روی زنده است: **NOT_VERIFIED** (اجرای migration کار انسان است). `docs/audit/evidence/return-flow-map.md:100` همچنان بازگردانی موجودی را ادعا می‌کند. → REQUIRES_VERIFICATION با `VERIFY-invoice-return-02.sql`.
2. در شاخهٔ sale، مالیات جدا برگردانده نمی‌شود: فروش اولیه Cr sales(خالص)+Cr tax، ولی برگشت فقط Dr sales(کل) و حساب tax را لمس نمی‌کند (`02:306-318`).
3. بهای بازگشتی از `invoice_items.buy_price` است (`02:156-166`)؛ مسیر آفلاین فاکتور `buyPrice: 0` می‌نویسد (`local invoices.ts:573`) ⇒ `costStatus 'unknown'` برای فاکتورهای آفلاین (طبق سیاست «نامعلوم، صفر نیست»).
4. آفلاین: `invoice_returns` روی صف با نقطهٔ `POST /invoices/:id/returns` ارسال می‌شود (`sync-engine.ts:600-606`).

## FLOW-006 — بازگشت از خرید: همان RPC (ستون purchase_return بالا). جزئیات خرید: [06](06-PURCHASE-FLOW.md).

---

## تست‌های موجود و آنچه پوشش نمی‌دهند

`backend/src/__tests__/invoice-return*.test.ts`, `purchase-return-accounting.test.ts`, `inventory-avco-01.pg.test.ts` (۸۷ سوئیت `*.pg.test.ts` روی این ماشین BLOCKED است—خطای ۱۳۱۴ ویندوز، طبق گزارش پایدارسازی). پوشش نمی‌دهند: ترکیب 01→02 روی دیتابیس واقعی برای برگشت فروش؛ هم‌ارزی دفتر کل آنلاین و آفلاین؛ لغو فاکتور با پرداخت مشترک روی Postgres.
Audit findings مرتبط (فقط ID): `docs/qa/BUG-90-REMEDIATION-TRACKER.md` ردیف 01A، 01C؛ `BUG-DISCOVERY-100-REGISTRY.json`.
