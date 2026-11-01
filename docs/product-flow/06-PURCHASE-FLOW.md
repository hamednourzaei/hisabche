# 06 — PURCHASE FLOW

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×4، PARTIAL ×2
مرتبط: [05](05-SALES-INVOICE-FLOW.md) · [07](07-INVENTORY-FLOW.md) · [09](09-ACCOUNTING-LEDGER-FLOW.md)

دو راه برای خرید وجود دارد (حقیقت سورس؛ تصمیم محصول «خرید = فاکتور خرید» در CLAUDE.md ثبت شده، ولی هر دو مسیر در کد زنده‌اند):

## FLOW-030 — فاکتور خرید (`type='purchase'`) — همان `InvoiceService.create`

- جهت موجودی `+1` (`invoice.service.ts:1011`)؛ لایهٔ بها از خطوط (`applyCosting`, `:1273`)؛ پس از commit: `shelves.autoShelveInvoice` + `refreshBuyPrices` (`:1262-1266`).
- دفتر: Dr inventory / Cr payable به مبلغ total (`invoice-posting.domain.ts:51-58`).
- پرداخت به تأمین‌کننده: `recordCreationPayments` با `direction:'out'` (`:1431-1437`) ⇒ Dr payable / Cr cash|bank.
- برگشت خرید: `invoice_return_create` شاخهٔ `purchase_return` (Dr payable / Cr inventory [/ Cr tax]، کم‌کردن `product_stock` و `cost_layers.remaining_qty`؛ کمبود ⇒ `PURCHASE_RETURN_INSUFFICIENT_STOCK`) — [05 FLOW-005](05-SALES-INVOICE-FLOW.md).
- لغو فاکتور خرید: `reverseEffects` لایهٔ بهای خرید را **برنمی‌گرداند** (کامنت `:1824-1826`).

## FLOW-031 — سفارش خرید (PO) و دریافت کالا

`backend/src/services/purchasing.service.ts`: ایجاد `createPurchaseOrder` (RPC `purchase_order_write` `:255`; شناسهٔ مشتق از Idempotency-Key `:107-125`; رزرو بودجه با حساب inventory `:105`). route‌ها: `purchase.write` / `purchase.receive` (طبق DECISIONS-APPLIED).
دریافت (`receiveGoods :351`):

1. claim گذار وضعیت پیش از حرکت موجودی (#142 کامنت `:370-380`).
2. `costing.recordReceipt` برای هر قلم (`sourceType 'purchase_order'`).
3. `INSERT stock_movements` نوع `purchase` با `reference_type 'purchase_order'` (`:455-486`).
4. **هیچ `ledger.postDocument` در این فایل نیست** (grep: 0) ⇒ دریافت PO سند دفتر (Dr inventory / Cr payable) نمی‌زند. تنها برخورد با دفتر، خواندن حساب inventory برای رزرو بودجه است.
5. حرکت‌های ورودی فیلد `to_warehouse_id` ندارند (`:466-474`) ⇒ طبق قاعدهٔ پروژه (BUG-080) به «بدون انبار» می‌روند. (مشاهدهٔ سورس؛ اثر زنده NOT_VERIFIED.)

آفلاین: `local-engine/src/routes/purchasing.ts` موجود است؛ بخش انتقال به ابر برای خرید `NOT_IMPLEMENTED` (DECISIONS-APPLIED). محتوای route محلی خوانده نشد: NOT_VERIFIED.

## دو واقعیت نیازمند تصمیم (REQUIRES_PRODUCT_DECISION)

1. آیا دریافت PO باید بدهی تأمین‌کننده/موجودی را در دفتر کل ثبت کند، یا فقط فاکتور خرید؟ اکنون دو راه با اثر مالی متفاوت‌اند.
2. انبار حرکت‌های دریافت PO.
