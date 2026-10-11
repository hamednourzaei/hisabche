# یکپارچگی دیتابیس — از «کد درست رفتار می‌کند» به «دیتابیس رد می‌کند» (۱۱ اکتبر ۲۰۲۶)

> ورودی: ارزیابی بیرونیِ اسکیما (۷٫۵ از ۱۰) + خروجی اسکیما‌ی زنده که صاحب پروژه فرستاد.
> این سند ادعاهای آن ارزیابی را **با اسکیما و با کد** سنجیده است؛ حرفی که درست درنیامد، گفته شده.

وضعیت: **فاز ۰ (کشف) آماده است. هیچ migration ای نوشته نشده** — عمداً. قید را نمی‌شود روی ردیف‌هایی گذاشت که
همین حالا نقضش می‌کنند؛ اول باید بدانیم چند تا هستند.

`docs/FINDING-db-integrity.sql` — فقط SELECT، ۱۵ بلوک، روی Postgres واقعی اجرا شده
(`backend/src/__tests__/finding-db-integrity.pg.test.ts`).
**Post-migration verification: هنوز migration ای نیست. خروجی FINDING — PENDING HUMAN.**

---

## ۱. سنجش هشت ادعا

| # | ادعا | حکم | مدرک از اسکیما / کد |
|---|---|---|---|
| ۱ | اسکیما هنوز کاملاً workspace-محور نیست | **درست** | `workspace_id` در `accounts`، `journal_entries`، `journal_lines`، `invoices`، `invoice_items`، `products`، `customers`، `suppliers`، `stock_movements`، `warehouses`، `employees`، `payrolls` **nullable** است. `project_members`، `purchase_order_items`، `invoice_item_details`، `sync_queue`، `sync_logs` اصلاً ستونش را ندارند. |
| ۲ | FKها مرز tenant را نمی‌بندند | **درست، و بدتر از آنچه گفته شد** | نه‌فقط FK ترکیبی نیست؛ خیلی جاها **هیچ FK ای نیست**: `payment_allocations.invoice_id`، `cost_layers.product_id`، `cost_consumptions.layer_id` و `.product_id`، `journal_entries.reversal_of`، `payments.journal_entry_id`، و `workspace_id` در `accounts`/`journal_*`/`payments`/`cost_*`/`stock_movements`/`warehouses`/`suppliers` به `workspaces` وصل نیست. |
| ۳ | ارز هنوز حل نشده | **درست** | `DEFAULT 'AFN'` روی `products.currency`، `cost_layers.currency`، `payments.currency`، `budgets.currency` (با CHECK چهارکدی) و `workspaces.base_currency`. `invoices.currency` nullable است. کد از این دور ارز را صریح می‌فرستد، ولی دیتابیس هنوز برای هر نویسنده‌ی دیگری AFN می‌گذارد. |
| ۴ | مانده‌ی طرف حساب accounting-grade نیست | **نیمه‌درست** | `customers.opening_balance` یک عدد بی‌ارز است — درست. ولی مانده‌ی جاری **ذخیره نمی‌شود**؛ از حرکت‌ها و به تفکیک ارز مشتق می‌شود (`partyBalancesByCurrency`، دور قبل). فقط خودِ مانده‌ی اول ارز ندارد. |
| ۵ | تخصیص پرداخت ارز را نمی‌سنجد | **درست** | `payment_allocations` نه ارز دارد نه قیدی که `payment.currency = invoice.currency`. در کد هم سنجیده نمی‌شود (DEFECT-CUR-03، باز). |
| ۶ | زنجیره‌ی COGS باید enforce شود | **درست؛ بخش کد این دور بسته شد** | `.claude/accounting-integrity/00-SPEC.md`. بخش دیتابیس باز است: هیچ قیدی `remaining_qty <= received_qty` یا «مصرف ≤ دریافت» را نمی‌بندد. |
| ۷ | انباشت تاریخی / دو منبع حقیقت | **درست، با تصحیح** | `ledger_entries`، `sync_queue`، `sync_logs`، `journal_lines_archive`: **صفر خواننده در کد** — مرده‌اند، نه «منبع دوم». منبع حسابداری `journal_entries`+`journal_lines` است. `transactions` هنوز ۴ فایل خواننده دارد و **واقعاً** کنار `payments` زندگی می‌کند (مانده‌ی اول مشتری آن‌جاست). ⚠️ زنجیره‌ی «journal → ledger_entries» که ارزیابی نقطه‌ی قوت دانست وجود ندارد. |
| ۸ | JSONB زیاد | **عمدتاً نادرست برای داده‌ی مالی** | مبلغ‌ها ستون‌اند. JSONBهای مالی دو تا هستند و هر دو عمدی‌اند: `invoices.tax_snapshot` (عکس لحظه‌ی صدور) و `journal_lines.dimensions`. دومی اگر گزارش مرکز هزینه جدی شود باید جدول شود. |

### آنچه ارزیابی نگفت و اسکیما نشان می‌دهد

| # | یافته | اثر |
|---|---|---|
| N1 | **`journal_entries.source_id` از نوع `uuid` است** ولی `repost.service.ts:232` یک رشته‌ی ترکیبی می‌فرستد. | هر اصلاح بهای backdated روی دیتابیس واقعی با خطای نوع رد می‌شود. تست ساختگی نمی‌بیند. (کلید بهای دیرهنگامِ این دور به همین دلیل UUID مشتق شد.) |
| N2 | توازن سند فقط در تابع `accounting_post_journal_entry` سنجیده می‌شود (`JOURNAL_ENTRY_UNBALANCED`)؛ **تریگر یا قید ندارد**. | هر `INSERT` مستقیم در `journal_lines` دفتر را نامتوازن می‌کند. |
| N3 | `journal_lines.debit/credit` قیدِ «نامنفی» و «فقط یک سمت» ندارد؛ `journal_id` و `account_id` nullable‌اند. | خط بی‌سند و خط بی‌حساب ممکن است. |
| N4 | FK تکراری: `customers`، `invoices`، `products`، `subscriptions`، `transactions` هر کدام دو کلید به `workspaces` دارند؛ `invoices→customers` هم دو تا. | هزینه‌ی هر نوشتن، بی‌فایده. |
| N5 | زمان‌ها یک‌دست نیستند: `timestamp without time zone` در `accounts.deleted_at`، `journal_entries.*`، `products.*`، `payrolls.*`، `workspaces.*`، … کنار `timestamptz`. | سرور Oregon و دیتابیس Sydney یک مقدار را دو لحظه می‌خوانند. |
| N6 | `accounts.role` CHECK نقش «سرمایه‌ی افتتاحیه» ندارد. | موجودی اول و مانده‌ی اول نمی‌توانند سند دفتر بگیرند (O1 در سند حسابداری). |
| N7 | `accounts` یکتاییِ `(workspace_id, code)` را در این خروجی نشان نمی‌دهد. | باید با FINDING/کاتالوگ تأیید شود. |

---

## ۲. ترتیب کار

اولویتِ ارزیابی «ارز → COGS → workspace → …» بود. ترتیب این سند فرق دارد، با دلیل:
**قیدی که ارزان است و جلوی خرابیِ تازه را می‌گیرد اول؛ قیدی که مدل را عوض می‌کند آخر.**

| فاز | کار | پیش‌نیاز | ریسک |
|---|---|---|---|
| **۰** | اجرای `FINDING-db-integrity.sql` و فرستادن خروجی | — | هیچ (فقط SELECT) |
| **۱** | قیدهای ارزانِ دفتر: `debit >= 0`، `credit >= 0`، «فقط یک سمت»، `journal_id`/`account_id` NOT NULL، تریگر توازن **DEFERRABLE** روی سندهای `posted` | C1 و C2 خالی باشند | کم؛ `NOT VALID` + `VALIDATE` جدا |
| **۲** | FKهای گم‌شده (`payment_allocations.invoice_id`، `cost_*`، `reversal_of`، …) + FK `workspace_id → workspaces` روی جدول‌های مالی | B2 خالی باشد | کم |
| **۳** | مرز tenant در خودِ ارجاع: `UNIQUE (workspace_id, id)` روی والدها و FK ترکیبی `(workspace_id, x_id)` | B1 خالی؛ `workspace_id` فرزندها پر | متوسط — قفل هنگام ساخت ایندکس؛ `CONCURRENTLY` |
| **۴** | `workspace_id NOT NULL` روی جدول‌های مالی | A1 صفر، یا backfill از والدِ قطعی (خط ← سند). ردیفی که والد ندارد `Unknown` می‌ماند و گزارش می‌شود (§12) | متوسط |
| **۵** | ارز: حذف `DEFAULT 'AFN'`، `currency NOT NULL` روی `invoices`، تریگر «ارز تخصیص = ارز فاکتور» | D1 خالی؛ D3 تصمیم بخواهد | متوسط — نویسنده‌ای که ارز نمی‌فرستد می‌شکند؛ دو تابع SQL هنوز AFN پیش‌فرض دارند |
| **۶** | زنجیره‌ی بها در دیتابیس: `0 <= remaining_qty <= received_qty`، `amount = quantity × unit_cost` | E3 خالی | کم |
| **۷** | اصلاح N1 (نوع `source_id`)، نقش «سرمایه‌ی افتتاحیه» (N6) و سند موجودی اول | تصمیم صاحب کار | متوسط |
| **۸** | پاک‌سازی: FK تکراری، جدول‌های مرده (بایگانی، نه `DROP` کور)، `timestamptz` | F1–F3 | کم تا متوسط |
| بعدتر | ارز در `journal_lines` (مبلغ ارزی + نرخ)، مانده‌ی اولِ ارزدار، ادغام `transactions` در `payments` | طراحی جدا (DEFECT-CUR-02) | زیاد — تغییر مدل |

هر فاز: یک `docs/db-integrity-NN-migration.sql` (additive، idempotent، با Rollback) + `VERIFY-…sql` + `*.pg.test.ts`
که migration را **دو بار** اجرا می‌کند و برای هر قید یک نوشتنِ خلاف را می‌فرستد و ردشدنش را می‌سنجد.

---

## ۳. آنچه **نباید** کرد

- بازنویسی اسکیما از صفر — ارزیابی هم همین را می‌گوید.
- قید `VALID` روی جدول بزرگ در یک گام (قفل می‌گیرد). اول `NOT VALID`، بعد `VALIDATE CONSTRAINT`.
- backfill حدسیِ `workspace_id` از `user_id` برای کسی که عضو دو کسب‌وکار است (§12).
- `DROP TABLE` جدول مرده بدون دیدن `F2` — ممکن است تنها نسخه‌ی یک تاریخچه باشد.
- حذف `user_id` از جدول‌ها: در کد نقش «چه کسی نوشت» دارد و فیلتر نیست (قانون ۱ CLAUDE.md). فقط **nullable‌بودنِ `workspace_id`** مشکل است.

---

## ۴. امتیاز، از دید این بازبینی

| بخش | ارزیابی بیرونی | این بازبینی | چرا فرق دارد |
|---|---:|---:|---|
| هسته‌ی حسابداری | ۸٫۵ | ۷ | توازن و شکل خط در دیتابیس enforce نمی‌شود؛ `ledger_entries` مرده است |
| بها و انبار | ۸٫۵ | ۷ | جدول‌ها درست‌اند؛ FK ندارند و تا این دور موجودی اول لایه نمی‌ساخت |
| چندارزی | ۵ | ۴ | دفتر ارز ندارد؛ تخصیص ارز را نمی‌سنجد |
| یکپارچگی ارجاعی | ۶٫۵ | ۵ | FKهای **غایب**، نه فقط غیرترکیبی |
| Multi-tenancy | ۷ | ۶٫۵ | ستون هست، اجبارش نیست |

این عددها نظرند، نه اندازه‌گیری؛ اندازه‌گیری، خروجی FINDING است.

---

## ۵. خروجی‌های واقعی FINDING (از صاحب پروژه)

| بلوک | وضعیت | نتیجه |
|---|---|---|
| F3 — زمان بدون منطقه | **دریافت شد (۱۱ اکتبر)** | ۶۶ ستون در ۲۹ جدول. مالی‌ها: `journal_entries.created_at/updated_at/deleted_at`، `journal_lines.created_at`، `accounts.deleted_at`، `payrolls.payment_date`، `products.created_at/updated_at/synced_at`، `warehouses.*`، `purchase_orders.order_date/received_at/expected_delivery_date`، `work_orders.start_date/end_date`، `workspace_invites.expires_at`. |
| A1، A2، B1، B2، C1، C2، D1، D2، D3، E1، E2، E3، F1، F2 | **PENDING HUMAN** | ویرایشگر SQL فقط نتیجه‌ی آخرین دستور را نشان می‌دهد؛ هر بلوک جدا اجرا شود. |

### خوانش F3

- `workspace_invites.expires_at` و `payrolls.payment_date` تنها دو ستونی‌اند که **مقایسه با «الان»** رویشان معنا دارد؛ بقیه برچسب زمانِ ثبت‌اند. انقضای دعوت با `timestamp` بی‌منطقه، بسته به منطقه‌ی نشستِ دیتابیس چند ساعت زود یا دیر می‌شود.
- تبدیل `timestamp → timestamptz` جدول را بازنویسی می‌کند و باید بگوید مقدارهای فعلی در چه منطقه‌ای نوشته شده‌اند (`AT TIME ZONE 'UTC'`). این فرض باید با یک FINDING جدا (مقایسه‌ی `created_at` با یک ستون `timestamptz` همان ردیف) سنجیده شود، نه حدس زده شود. در فاز ۸ می‌ماند.
