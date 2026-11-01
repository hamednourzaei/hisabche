# 08 — PAYMENT & CASHBOX (TILL) FLOW

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×5، PARTIAL ×2
مرتبط: [05](05-SALES-INVOICE-FLOW.md) · [09](09-ACCOUNTING-LEDGER-FLOW.md)

## FLOW-010 — ثبت پرداخت (دریافت/پرداخت)

Core: **CORE-002** = `PaymentsService.recordPayment` (`backend/src/services/payments/payments.service.ts:158`) · schema: `recordPaymentSchema` (`packages/validation/src/schemas/payments.domain.ts` انتهای فایل).

- ورودی: `direction in|out`, `partyType customer|supplier`, `partyId|allocations` (بدون طرف ⇒ allocation لازم: `PAYMENT_WITHOUT_PARTY_NEEDS_ALLOCATION`), ارز/نرخ/کارمزد/`tillSessionId`.
- تخصیص: بدون allocation صریح ⇒ قدیمی‌ترین بدهی اول (`:206`). پرداخت فقط فاکتورِ هم‌ارز را تسویه می‌کند (`settlesInCurrency`، ‌`PAYMENT_ALLOCATION_CURRENCY_MISMATCH`).
- till: اگر `tillSessionId` و method=cash ⇒ `tillMovement` قبل از نوشتن بررسی می‌شود (`:290-330`)؛ صندوق بسته/ارز نامناسب ⇒ رد.
- دفتر کل (`bookPayment :596-690`): دریافت Dr cash|bank · [Dr bank_fees] · Cr receivable · [±fx_gain_loss]؛ پرداخت Dr payable · [Dr fee] · Cr cash|bank. `moneyAccountRole(method)`: فقط `cash`→cash، بقیه→bank (`payments.domain.ts`).
- نبودِ حساب: پرداخت **ثبت** می‌شود، دفتر نه (warn) (`:615-625`).
- Idempotency: `payments_record_keyed` RPC (طبق fake در گزارش DECISIONS-APPLIED)؛ در این فاز خود RPC خوانده نشد: PARTIAL.

## FLOW-011 — لغو پرداخت

`cancelPayment` (`:691-745`): `scopes.assertMay(payment.cancel)` → `sod.assertAllowed` → `ledger.reverseDocument('payment')` (قبل از علامت‌گذاری لغو؛ دورهٔ بسته ⇒ fail-closed) → `repo.cancelPayment` (ردیف `cancelled` می‌ماند) → `sod.recordAction` → `invalidate`. allocationها: فاکتورها دوباره باز (از طریق projection `paid_amount`).

## FLOW-012 — صندوق (till): باز، حرکت نقدی، بستن

- باز: `PosService.openSession` (`pos.service.ts:112`)؛ سفارش: `recordOrder :536`؛ حرکت نقد: `recordMovement :666`؛ انتقال به بانک: `recordBankTransfer :734`؛ سرمایهٔ اولیه: `recordOpeningCapital :837` (Dr cash|bank / Cr سرمایه، `till-view.ts openingCapitalLines`)؛ بستن: `closeSession :932`.
- بستن: `UPDATE ... WHERE status IN ('open','closing','suspended')` (دو دستگاه هم‌زمان؛ یکی می‌بازد) → `summarise` → `postSession`.
- ارز خارجی: `POS_FOREIGN_CURRENCY_NOT_IN_LEDGER` ⇒ بسته می‌شود **بدون سند دفتر** (`ledgerResult.status 'not_posted'`).
- خطوط سند بستن (`packages/validation/src/schemas/till-view.ts:185-232`): Dr cash = شمارش‌شده؛ Cr sales = درآمد؛ Dr bank = کارت+حواله؛ Dr receivable = نسیه؛ حرکات نقد → Dr/Cr purchase؛ **تفاوت شمارش (variance) → خط روی حساب `sales`** (Dr اگر کسری، Cr اگر اضافی).

⚠️ مشاهده (سند/کد): کامنت `postSession` (`pos.service.ts` پیش از تابع) می‌گوید تفاوت به «حساب جدا» می‌رود و «netting into sales درآمد را عوض می‌کند»، ولی `sessionPostingLines` تفاوت را به `accounts.sales` می‌نویسد (`till-view.ts:~228-236`). docs-vs-code اختلاف؛ در 99 ثبت شد.

آفلاین: `local-engine/src/routes/till.ts` (void نیازمند `payment.cancel`)؛ push: `pos_session close` → `/pos/sessions/:id/close` و `pos_cash_movement` → `/pos/sessions/:id/cash` (`sync-engine.ts:608-624`).

## ارز / مانده

مانده به تفکیک ارز (`partyBalancesByCurrency`)؛ `balance` تک‌عددی فقط ارز دفاتر. تسعیر: نقد به نرخ روز پرداخت، بدهی به نرخ فاکتور (`paymentPosting`).

NOT_VERIFIED: واریز بانکی/تطبیق بانک (`bank` تب)، `wallet`، و `transactions` قدیمی (جدول «OLD ledger» طبق کامنت `customer.service.ts:840`).
