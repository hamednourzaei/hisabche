# Inventory Costing Core — Gap Analysis

- **Tier:** 🔴 Tier 1، مورد ۲ («Cost Layers / FIFO»)
- **تاریخ:** 2026-08-29
- **مستندات خوانده‌شده:**
  - ERPNext — Perpetual Inventory: https://docs.frappe.io/erpnext/user/manual/en/perpetual-inventory
  - Odoo 19 — Valuation cheat sheet: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/inventory_valuation/cheat_sheet.html
  - Odoo 19 — Automatic inventory valuation: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/inventory_valuation/inventory_valuation_config.html
- **فایل‌های بررسی‌شده:** `invoice.service.ts` (`updateProductStock`)، `warehouse.service.ts`،
  `product.service.ts`، `analytics.service.ts`، `docs/accounting-core-migration.sql`

---

## جدول Gap Analysis

| #   | مورد                               | ERPNext / Odoo                                                                   | وضعیت فعلی حسابچه                                                                                      | نتیجه              |
| --- | ---------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ |
| 1   | Cost Layer                         | هر ورود کالا لایه‌ی بهای خودش را نگه می‌دارد؛ FIFO قدیمی‌ترین را اول مصرف می‌کند | **هیچ لایه‌ای وجود ندارد**                                                                             | ❌                 |
| 2   | بهای تمام‌شده‌ی فروش (COGS)        | از لایه‌ی مصرف‌شده                                                               | از `products.buy_price` لحظه‌ای — یعنی قیمت خرید امروز روی فروش دیروز                                  | ❌                 |
| 3   | مصرف چندلایه‌ای / لایه‌ی نیمه‌مصرف | یک فروش می‌تواند چند لایه را (بخشی) مصرف کند                                     | مفهومی وجود ندارد                                                                                      | ❌                 |
| 4   | ردیابی فروش ← لایه ← سند خرید      | هر مصرف قابل trace است                                                           | وجود ندارد                                                                                             | ❌                 |
| 5   | روش ارزش‌گذاری قابل انتخاب         | FIFO / AVCO / Standard                                                           | وجود ندارد؛ ضمنی «آخرین قیمت خرید» است                                                                 | ❌                 |
| 6   | ارزش موجودی انبار                  | `Σ(remaining_qty × unit_cost)`                                                   | `quantity × buy_price` — با واقعیت نمی‌خواند                                                           | ❌                 |
| 7   | سیاست موجودی منفی                  | قابل پیکربندی                                                                    | `Math.max(0, ...)` — کسری بی‌صدا صفر می‌شود و برای همیشه گم                                            | ❌                 |
| 8   | اتمیک بودن حرکت انبار              | حرکت و ارزش‌گذاری در یک تراکنش                                                   | `read → update` جداگانه برای هر کالا با `Promise.all`؛ دو فروش هم‌زمان یکدیگر را بازنویسی می‌کنند      | ❌                 |
| 9   | مرز تنانسی حرکات انبار             | —                                                                                | `warehouse.service.getStockMovements` با `user_id` فیلتر می‌کند؛ انتقال انبار `workspace_id` نمی‌نویسد | ❌ 🔴 Tier 1       |
| 10  | بهای حرکت انبار                    | هر حرکت `valuation_rate` و `stock_value_difference` دارد                         | `stock_movements` هیچ ستون بهایی ندارد                                                                 | ❌                 |
| 11  | برگشت کالا                         | برگشت با بهای اصلی خودش به موجودی برمی‌گردد                                      | وجود ندارد                                                                                             | ❌                 |
| 12  | Landed Cost                        | هزینه‌های جانبی وارد بهای لایه می‌شود                                            | وجود ندارد                                                                                             | ⚠️ خارج از این دور |
| 13  | ثبت با تاریخ گذشته / repost        | ERPNext دوباره محاسبه می‌کند                                                     | وجود ندارد                                                                                             | ⚠️ خارج از این دور |
| 14  | سند حسابداری موجودی                | موجودی بستانکار / COGS بدهکار هنگام خروج                                         | ساختارش با Accounting Core آماده است، ولی مبلغ غلط بود                                                 | ⚠️ تکمیل می‌شود    |
| 15  | نام‌گذاری                          | —                                                                                | `cost_layers` / `cost_consumptions` بومی است؛ `Stock Ledger Entry` یا `stock.valuation.layer` کپی نشده | ✅                 |

**جمع‌بندی:** ✅ ۱ · ⚠️ ۳ · ❌ ۱۱ · 🚩 ۰

---

## تصمیم‌های طراحی (بومی حسابچه)

1. **لایه، منبع حقیقت است.** موجودی = `Σ remaining_qty`، ارزش = `Σ(remaining_qty × unit_cost)`.
   `products.quantity` یک کش نمایشی می‌ماند، نه منبع حقیقت.
2. **مصرف در دیتابیس و با قفل ردیف** انجام می‌شود (`FOR UPDATE`)، چون دو فروش هم‌زمان
   از یک لایه، اگر در Node حساب شود، هر دو موجودی یکسانی می‌بینند.
3. **کسری موجودی گم نمی‌شود.** اگر سیاست اجازه بدهد، کسری به‌عنوان مصرف «تخمینی»
   (`is_estimated`) با آخرین بهای شناخته‌شده ثبت می‌شود تا بعداً قابل اصلاح باشد —
   نه اینکه با `Math.max(0, …)` ناپدید شود.
4. **AVCO** به‌جای بازنویسی لایه‌ها، هنگام مصرف میانگین وزنی لایه‌های باز را می‌گیرد؛
   لایه‌ها دست‌نخورده می‌مانند تا ردیابی از بین نرود.
5. بهای تمام‌شده‌ای که به دفتر کل می‌رود، **همان مبلغ مصرف‌شده از لایه‌هاست**، نه
   قیمت خرید فعلی محصول.
