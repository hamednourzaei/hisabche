# 10 — CUSTOMER / SUPPLIER FLOW

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×3، PARTIAL ×3، NOT_VERIFIED ×2
مرتبط: [05](05-SALES-INVOICE-FLOW.md) · [08](08-PAYMENT-CASHBOX-FLOW.md) · [14](14-REPORTING-DATA-FLOW.md)

## ماهیت داده

- مشتری: `customers` (`CustomerService`, `backend/src/services/customer.service.ts`). نوشتن: `customer.write`؛ ویرایش مشروط با `expectedUpdatedAt` ⇒ `CUSTOMER_CHANGED` 409 (CLAUDE.md؛ پایپ‌لاین AI).
- تأمین‌کننده: نقش مشتق (`customer_invoice_roles`، `CustomerService#listByRole`)؛ فاکتور خرید `supplier_id` دارد (`invoice.service.ts:1023`). جدول جدا برای supplier در این فاز تأیید نشد: PARTIAL.
- پروفایل اعتباری (سقف اعتبار، مهلت پرداخت، مدارک): `services/customer-profile` (NOT_VERIFIED محتوا).

## FLOW-050 — مانده طرف حساب (customer balance)

`CustomerService.getBalance` (`customer.service.ts:~940-990`):

1. `transactions` (جدول «ledger قدیمی» به قول کامنت `:840`) با نگاشت: `sale`→فروش، `receipt`→دریافت، `payment`→پرداخت، سایر→برگشت.
2. - برگشت‌های فروش از `PaymentsRepository.saleReturnsOfCustomer` ⇒ `saleReturnsOf(...)` (کامیت `aff2e0c9`).
3. `partyBalancesByCurrency(movements, bookCurrency)` ⇒ مانده به تفکیک ارز؛ `balance` = ارز اول.
   ⇒ مانده از **اسناد** می‌آید، نه از سطح حساب `receivable` دفتر کل. هر دو باید برابر شوند ولی دو محاسبهٔ مستقل‌اند (drift risk — [14](14-REPORTING-DATA-FLOW.md)).

صورت‌حساب (`party_ledger` view): فاکتور + پرداخت (+ برگشت پس از اصلاح). بدهی باز: `invoices` با `isOutstanding` (محمول مشترک بین کارت داشبورد و فهرست `?outstanding=1`).

## FLOW-051 — حذف مشتری

`DELETE /customers/:x` ⇒ آفلاین `online_required` در ماتریس (`offline-endpoint-matrix.ts`: `'DELETE /customers/:x': ['customer.delete','online_required']`). تأیید «مشتری بدهی‌دار» در سرویس: NOT_VERIFIED.

## موارد مرتبط با فاکتور

- فاکتور نسیه بدون مشتری رد می‌شود (`INVOICE_CREDIT_NEEDS_PARTY`، `invoice.service.ts:971`).
- مشتری از workspace دیگر ⇒ `verifiedCustomerName` قبل از هر نوشتن رد می‌کند (`:885`، کامنت `:947-964`).
- فهرست کالا/مشتری روی دسکتاپ از موتور محلی می‌آید (`fetchProducts/fetchCustomers` → `localRequest`، درس ۲۳۲).

## آفلاین

`local-engine/src/routes/customers.ts`؛ sync: create/update مشتری روی جادهٔ domain (create) یا versioned (update توصیفی) — [12](12-OFFLINE-SYNC-FLOW.md). `credit_limit` و `opening_balance` در `FINANCIAL_FIELDS` ⇒ domain (`push-routing.ts:55-69`).
