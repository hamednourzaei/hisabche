# 20 — پاسخ به چهار پرسش

commit: `05f749a2` · date: 2026-11-01 · وضعیت کلی: VERIFIED_SOURCE با محدودیت (هیچ‌کدام VERIFIED_RUNTIME نیست)
مرتبط: [01](01-ONBOARDING-FLOW.md) · [02](02-BUSINESS-CATEGORY-MATRIX.md) · [05](05-SALES-INVOICE-FLOW.md) · [12](12-OFFLINE-SYNC-FLOW.md)

---

## پرسش ۱ — از ورود کاربر تا ذخیرهٔ فاکتور با پرداخت چه اتفاقی می‌افتد؟

**زنجیرهٔ اول‌بار** (جزئیات [01](01-ONBOARDING-FLOW.md)): ثبت‌نام (`auth.routes.ts:344`) → ردیف profile → ورود خودکار → گیت `useRedirectGuard` (`dashboard-layout.tsx:171`) → ویزارد پنج‌مرحله‌ای → `PATCH /api/auth/profile` (`business_types`, `store_size`, `onboarding_completed_at`) + ارز دفاتر → داشبورد.
⚠️ **حلقهٔ گم‌شده:** ساخت اولین workspace برای کاربر آنلاین در ریپو پیدا نشد (`NOT_VERIFIED`).

**ثبت فاکتور + پرداخت** (`InvoiceService.create`, `invoice.service.ts:789`), به ترتیب:

1. idempotency (`:811`) → مبلغ از خطوط (`:863-870`) → خواندن‌های موازی (انبار، مشتری، تصمیم تأیید، سقف پلن) (`:877-911`) → نرخ ارز (`:920`) → «بدهی بدون طرف» (`:971`) → شمارهٔ رسمی (`:975`).
2. **یک RPC اتمیک** `invoice_write_document`: هدر + اقلام + جزئیات + `stock_movements` (`:1120`).
3. اثر ثانویه (خارج از آن تراکنش): flag موجودی منفی، اعلان، `sod.recordAction`، tax، **costing** (COGS از لایه‌های مصرف‌شده)، **ledger** (Dr receivable / Cr sales[/tax] / Dr cogs / Cr inventory)، `markPosted`، پرداخت‌ها (`recordPayment` هر tranche: Dr cash|bank / Cr receivable)، لاگ رویداد (`:1182-1346`).
4. مانده مشتری: مشتق از اسناد (فاکتور−پرداخت−برگشت)، نه از ledger (`customer.service.ts:940-990`). موجودی: projection از `stock_movements`. `paid_amount`: projection از `payment_allocations` (همیشه ۰ هنگام درج).
5. Outbox/sync: **ندارد** (مسیر مستقیم آنلاین).
   نمودار: [05 FLOW-001](05-SALES-INVOICE-FLOW.md).

**آنچه اثبات نشده:** اجرای زندهٔ این زنجیره (VERIFIED_RUNTIME نیست).

---

## پرسش ۲ — اگر آفلاین باشد همین عمل از کجا می‌گذرد و قوانین چه فرقی دارند؟

مسیر: `localRequest` + هدر `x-hisabche-queue:1` → `local-engine/src/routes/invoices.ts:482-905` → یک `db.transaction` SQLite شامل فاکتور، اقلام، حرکت موجودی، `cost_layer`، `journal_entry/line` (با **همان** `invoiceLedgerLines`)، `payment`+`payment_allocation`، و **ردیف outbox** → پس از اتصال `runSync` → `routeFor`=domain → `POST /invoices` → `InvoiceService.create` **دوباره** روی سرور (`sync-engine.ts:575-668`) → `resolveQueue(done)` + پاک‌شدن projection موقت (`OFF-…`) → pull دلتا.

تفاوت قوانین (VERIFIED_SOURCE با شمارش grep در بازهٔ ۴۸۲-۹۰۵ فایل محلی):

| قانون                                                                                                                      | آنلاین           | آفلاین                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------- |
| شماره                                                                                                                      | رسمی (`nextval`) | موقت `OFF-<device>-<seq>`                   |
| بدهی بدون طرف                                                                                                              | رد               | بررسی نمی‌شود                               |
| تأیید (approval)                                                                                                           | بله              | نه (هنگام sync اعمال/رد)                    |
| سقف پلن                                                                                                                    | بله              | نه (سرور هنگام sync)                        |
| صندوق (till) / ارز پرداخت / کارمزد                                                                                         | بله              | ندارد                                       |
| flag موجودی منفی                                                                                                           | بله              | ندارد                                       |
| بررسی capability ایجاد                                                                                                     | route            | در handler نیست (NOT_VERIFIED لایهٔ بالاتر) |
| معکوس‌سازی دفتر                                                                                                            | سند جدید         | `status='reversed'`                         |
| رفتار بعد از رد دائمی سرور: `REJECTED:` و انتظار انسان؛ وابسته‌ها `BLOCKED_BY_DEPENDENCY` ([12](12-OFFLINE-SYNC-FLOW.md)). |

---

## پرسش ۳ — انتخاب دستهٔ کسب‌وکار دقیقاً چه چیزی را تغییر می‌دهد؟

`CATEGORY_PERSONALIZATION: LIMITED` ([02](02-BUSINESS-CATEGORY-MATRIX.md)).

- **نوشته می‌شود:** آنلاین `profiles.business_types` (آرایه)، آفلاین `workspace.business_types` (comma-string)؛ فقط owner می‌تواند تغییر دهد (`auth.routes.ts:765`).
- **خوانده می‌شود:** فقط `useBusinessProfile` ← `resolveBusinessProfile` ← ۴ مصرف‌کننده: ترتیب بخش‌های داشبورد، واحد پیش‌فرض کالای جدید + ۳ واژه (dish/drink/piece)، ستون اضافهٔ فاکتورساز (فقط طلا: `weightGrams`)، تب‌های variants/fitments/serials در جزئیات انبار.
- **۲۳ از ۶۶ کلید** تجربهٔ متفاوت دارند؛ ۴۳ کلید generic‌اند.
- **تغییر نمی‌کند:** منوها، ماژول‌ها، مجوزها، سرفصل حساب‌ها، مالیات، ارز، انبار/صندوق پیش‌فرض، seed، و `store_size` (فقط ذخیره می‌شود).
- ⚠️ اختلاف ذخیره‌سازی آنلاین/آفلاین؛ حمل دسته در مهاجرت به ابر NOT_VERIFIED. اجرای زنده: NOT_VERIFIED.

---

## پرسش ۴ — لغو یا برگشت فاکتور چه اثری را برمی‌گرداند و چه چیزی را نه؟

### الف) لغو یا حذف (آنلاین، `reverseEffects`, `invoice.service.ts:1803-1830`)

**برمی‌گردد:** سند دفتر فاکتور (سند معکوس جدید)؛ سند `cost_repost`؛ پرداخت‌های مخصوص همین فاکتور (و سند معکوس آن‌ها)؛ حرکت موجودی (حرکت معکوس)؛ لایه‌های بهای فروش (`remaining_qty`)؛ سریال‌های فروخته‌شده؛ ساعت‌های صورت‌حساب‌شده؛ (در حذف) سطرهای مالیات و اقساط.
**برنمی‌گردد:** پرداخت مشترک با فاکتور دیگر (کل عملیات با `INVOICE_PAYMENT_SHARED` رد می‌شود)؛ لایهٔ بهای _فاکتور خرید_؛ اعلان/رویدادهای ارسال‌شده؛ ثبت `sod`.
**اتمیک نیست**: مراحل پشت‌سرهم، دفتر اول (می‌تواند رد شود، مثلاً دورهٔ بسته)، سپس بقیه.

### ب) برگشت (return) — RPC `invoice_return_create`

فاکتور اصلی دست‌نخورده می‌ماند و یک سند برگشت جدا ثبت می‌شود؛ دفتر: Dr sales / Cr receivable (+ Dr inventory / Cr cogs از `buy_price` خط)؛ موجودی: طبق نسخهٔ 01 حرکت ورودی `restock`، طبق نسخهٔ 02 فقط برای _برگشت خرید_ کاهش `product_stock`/`cost_layers`.
**برنمی‌گردد:** پرداخت/وجه نقد مشتری (بازپرداخت جداست)، حساب مالیات در برگشت فروش، و — اگر نسخهٔ 02 زنده باشد — موجودی فیزیکی برگشت فروش. **کدام نسخه زنده است: NOT_VERIFIED** (اجرای migration کار انسان؛ ببینید [05 FLOW-005](05-SALES-INVOICE-FLOW.md) مشاهدات ۱ و ۲).

### ج) آفلاین

لغو محلی همان اثرها را روی SQLite انجام می‌دهد، دفتر با `status='reversed'`، و اگر create هنوز نفرستاده شده ردیف outbox لغو (squash) می‌شود؛ وگرنه `delete` به سرور می‌رود (`local invoices.ts:908-1135`).
