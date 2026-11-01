# 07 — INVENTORY FLOW

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×5، PARTIAL ×2، NOT_VERIFIED ×1
مرتبط: [05](05-SALES-INVOICE-FLOW.md) · [06](06-PURCHASE-FLOW.md)

## مدل داده (حقیقت)

- منبع حرکت: `stock_movements`. `products.quantity` یک **projection** از آن است (تریگر `stock_movements_project`) — `product.service.ts:709-712`.
- موجودی هر انبار: `product_stock(workspace_id, product_id, warehouse_id, qty)`.
- بها: `cost_layers` + `cost_consumptions` (FIFO/avco، `inventory_settings.costing_method`).

## FLOW-040 — حرکت ناشی از فاکتور

`planStockMovements` (`invoice.service.ts:1102`) داخل RPC `invoice_write_document` (اتمیک با هدر). فروش بیش از موجودی رد نمی‌شود؛ `flagNegativeStock` conflict می‌سازد (`:1157`). فاکتور بدون `warehouseId` ⇒ `soleWarehouseId` (`:1109`).

## FLOW-041 — تعدیل موجودی (stock adjust)

مسیر واقعی (با جست‌وجوی نماد/UI): `PATCH /api/products/:id` با `quantity` ⇒ `ProductService.update` ⇒ `INSERT stock_movements {type:'adjustment', quantity: delta, reference_type:'product_edit', to_warehouse_id}` (`product.service.ts:730-761`). انبار از `stockWarehouse(..., 'edit')` (BUG-080).

- **هیچ سند دفتر کل** زده نمی‌شود: `'stock_adjustment'` فقط در union نوع `LedgerSourceType` است (`accounting/ledger.port.ts:27`) و در `backend/src` هیچ فراخواننده‌ای ندارد (grep). ⇒ تعدیل موجودی ارزش دفتر کل «inventory» را تغییر نمی‌دهد. (مشاهدهٔ سورس.)
- Permission: route محصول `product.write`؛ محلی `stock.adjust`.

## FLOW-042 — انتقال بین انبارها

`POST /api/stock-transfers` (`warehouse.routes.ts:152-180`, `requireCapability('product.write')`, idempotency از `readClientRequestId`) ⇒ `warehouseService.transferStock` ⇒ RPC `warehouse_transfer_stock_keyed|warehouse_transfer_stock` (`warehouse.service.ts:~278-284`). سند دفتر ندارد. آفلاین: `inventory_movement`→`/stock-transfers` (`sync-engine.ts:562`).
مسیر دومِ «انتقال با وضعیت در راه» در `warehouse/transfer.service.ts` (`create/advance/inTransit`) — کامنت‌ها از `stock_in_transit` سخن می‌گویند؛ `create` در شکست درج خطوط، `DELETE` جبرانی روی `stock_transfers` می‌زند (`:127`). مشاهدهٔ معماری: قاعدهٔ «DELETE جبرانی ممنوع» (CLAUDE.md §۱.۴) را نقض می‌کند. اتصال این مسیر دوم به UI و route نهایی بررسی نشد: PARTIAL.

## FLOW-043 — شمارش انبار (cycle count)

`backend/src/services/inventory/cycle-count.service.ts`، route‌ها `stocktake.write` / `stocktake.complete` (DECISIONS-APPLIED). اثر تکمیل بر `stock_movements`/دفتر کل خوانده نشد: NOT_VERIFIED.

## FLOW-044 — دریافت PO: [06](06-PURCHASE-FLOW.md).

## فاکتور و برگشت: [05](05-SALES-INVOICE-FLOW.md).

## قفسه‌ها

`shelves` + `storage_auto_shelve_invoice` (پس از خرید) — اثر روی مقدار انبار ندارد (`invoice.service.ts:1262`); migration `shelf-capacity-01` منتظر اجرا (CLAUDE.md).

## تفاوت آفلاین

محلی: `inventory_movement` + `product_stock` + `cost_layer` (`local invoices.ts:604-740`)؛ `baseQuantityOf` تبدیل واحد مشترک (`:562`). `buyPrice` اقلام آفلاین ۰ نوشته می‌شود (`:573`) ⇒ بها از لایه‌ها.
