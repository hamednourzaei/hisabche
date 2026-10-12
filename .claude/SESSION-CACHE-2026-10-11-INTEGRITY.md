# کش سشن — ۱۱ اکتبر ۲۰۲۶ · یکپارچگی حسابداری و دیتابیس

> سه کار در یک سشن: (۱) ارز دفاتر و ورود فایل (دورهای ۹–۱۲، در `reverse-and-import/`)،
> (۲) «نامعلوم، صفر نیست» — سود، بهای تمام‌شده، تراز آزمایشی، (۳) شروع مبحث یکپارچگی دیتابیس.
> هیچ چیز commit نشده. هیچ DDL روی دیتابیس زنده اجرا نشده.

سندهای مرجع:
`.claude/accounting-integrity/00-SPEC.md` · `.claude/db-integrity/00-SPEC.md` ·
`.claude/reverse-and-import/00-SPEC.md` · `01-CURRENCY-AUDIT.md`

---

## ۱. نقشه‌ی آنچه ساخته شد

| لایه | فایل | نقش |
|---|---|---|
| دامنه | `backend/src/services/accounting/profit-report.domain.ts` | `CostStatus`، سود `null` برای بهای ناقص، `knownGrossProfit`، `uncostedRevenue` |
| دامنه | `…/accounting/evidence.domain.ts` | همان وضعیت برای یک فاکتور و هر خط؛ `ProductJourney.profit` می‌تواند `null` باشد |
| دامنه | `…/inventory-costing/unvalued-stock.domain.ts` | موجودیِ روی قفسه بدون لایه؛ «بدون قیمت خرید» = blocked |
| سرویس | `…/inventory-costing/costing.service.ts` | `getUnvaluedStock`، `valueUnvaluedStock`، `coverSoldUnits` |
| سرویس | `…/product.service.ts#valueOpeningStock` | لایه‌ی `opening` هنگام ساخت کالا و `recordOpeningStock` |
| سرویس | `…/invoice.service.ts#costUncostedSale` + `lateCostKey` | بهای دیرهنگامِ یک فروش، سند جدا |
| پورت | `…/accounting/ledger.port.ts#postedOnAccount` | آنچه دفتر برای یک سند روی یک حساب دارد |
| گزارش | `…/accounting/accounting.reports.ts` | `debitBalance`، `creditBalance`، `abnormal`، جمع مانده‌ها |
| مخزن | `…/accounting/accounting.repository.ts#booksStatus` | فاکتورهای ثبت‌نشده، آخرین سند — `null` یعنی خوانده نشد |
| route | `GET /api/inventory/unvalued` · `POST /api/inventory/unvalued/value` · `POST /api/invoices/:id/cost` | — |
| هوک | `packages/api/src/hooks/evidence.ts` | `useCostInvoice`، `useUnvaluedStock`، `useValueUnvaluedStock` |
| UI | `accounting/tabs/TrialBalanceTab.tsx` | دو ستون مانده، خلاصه، ارز، وضعیت دفتر، سوییچ «دارای مانده / همه» |
| UI | `invoice-detail/invoice-evidence-panel.tsx` | «نامشخص / قابل محاسبه نیست» + دکمه‌ی ثبت بها |
| UI | `accounting/components/ProductProfitTable.tsx`, `UnvaluedStockNotice.tsx` | جدول سود و اعلان موجودیِ بی‌بها |
| کشف | `docs/FINDING-db-integrity.sql` | ۱۵ بلوک فقط‌خواندنی |

---

## ۲. باگ‌ها (شماره‌ها در `BUG-REGISTRY.md`)

| # | نشانه | ریشه | گارد |
|---|---|---|---|
| BUG-109 | فاکتور «بها ۰ · سود = فروش · ۱۰۰٪» | موجودی اول لایه‌ی بها نمی‌ساخت؛ نبودِ consumption صفر حساب می‌شد | `cost-unknown-is-not-zero.test.ts` |
| BUG-110 | تراز آزمایشی «−۱۰٬۲۲۰٬۰۰۰» برای صندوق | یک ستون مانده‌ی علامت‌دار | `trial-balance-sides.test.ts` |
| BUG-111 | سربه‌سر، سناریو، مقایسه، DIO روی سودِ ساخته از بهای ناقص | همان صفر، پایین‌دست | همان + اسکن `?? 0` |
| BUG-112 | خلاصه‌ی دوره (insights/AI) فرمول دوم داشت: `invoices.total` با مالیات و همه‌ی ارزها | محاسبه‌ی موازی کنار `buildProfitReport` | — (حالا همان گزارش را صدا می‌زند) |
| BUG-113 | «از تاریخ / از تاریخ» | placeholder همان برچسب بود | — |
| BUG-114 | کلید سند متنی برای ستون `uuid` | `source_id uuid`؛ دیتابیس ساختگی نمی‌بیند | تست شکل UUID |
| BUG-115 | `booksStatus` روی `invoices.deleted_at` فیلتر می‌کرد | ستون وجود ندارد | `no-phantom-deleted-at.test.ts` (خودش گرفت) |

---

## ۳. دیباگ — آنچه وقت گرفت و دفعه‌ی بعد نباید بگیرد

1. **«بها = ۰» را از آخر به اول ردیابی کن.** پنل → `explainInvoiceProfit` → `buildProfitReport` → `cost_consumptions` خالی → چرا؟ → `applyCosting` خط را در `uncosted` گذاشته → `INVENTORY_INSUFFICIENT_STOCK` → لایه نیست → `grep recordReceipt` فقط دو caller. هر حلقه یک grep بود؛ گراف (`explain`) دو حلقه‌ی اول را داد.
2. **`getById` در دیتابیس ساختگی خط‌ها را از embed می‌خواند، گزارش‌ها از جدول.** fixture باید هر دو را داشته باشد (`invoice_items` روی ردیف فاکتور **و** در جدول)، وگرنه «۰ خط» و همه‌چیز بی‌خطا سبز/قرمزِ بی‌ربط می‌شود.
3. **`vi.mock('../db')` با global ای که در `beforeAll` پر می‌شود:** هر import ایستا از فایلی که `db` را بار می‌کند، mock را قبل از پرشدن می‌سازد. دامنه‌های خالص را ایستا import کن، سرویس‌ها را `await import()`.
4. **واحدهای فروخته‌شده را از لایه‌ی قفسه نخور.** نسخه‌ی اولِ «ثبت بهای دیرهنگام» `applyCosting` را دوباره صدا می‌زد؛ با ۵ واحد روی قفسه و ۱۵ فروخته، یا رد می‌شد یا لایه‌ی قفسه را خالی می‌کرد. قاعده: اول `coverSoldUnits`، بعد issue.
5. **مبلغ سند اصلاحی = تفاوت با خودِ دفتر، نه «آنچه این بار حساب کردم».** اگر بین مصرف لایه و ثبت سند خطا بخورد، تلاش دوم «چیزی برای مصرف نیست» می‌بیند و سند هرگز ثبت نمی‌شود. `postedOnAccount` این شکاف را می‌بندد.
6. **گاردهای فهرست‌بسته route تازه را می‌گیرند** — `concurrency-safety-map.ts` و `reversal-ledger.test.ts` هر دو. «proven» در دومی یعنی واقعاً تستی که حذف می‌کند و **مانده** می‌سنجد؛ همان را نوشتم.
7. **متد تازه را زیر مارکرِ یک بخشِ گارددار نگذار.** `booksStatus` با `.limit(1)` زیر «Profit report» افتاد و گارد «گزارش سود هیچ سقفی ندارد» قرمز شد.
8. **`node -e` با backtick باز هم خراب شد** (بار هشتم): رشته‌ی template داخل دستور خالی شد و جایگزینی «موفق» یک PLACEHOLDER در فایل گذاشت. هر متنی با backtick فقط از فایل اسکریپت یا ابزار Edit.

---

## ۴. درس‌ها

- **پرچم را نسنج، عدد را بسنج.** `costMissing: true` کنار `profit: 450000` یعنی باگ با تست سبز.
- **fixture از مسیری که کاربر می‌رود.** «اول خرید، بعد فروش» مسیر تست‌نویس است، نه دکاندار.
- **نوع ستون را از اسکیما بخوان.** دیتابیس ساختگی هر چیزی را در `source_id` می‌پذیرد.
- **قبل از جمع تازه، هسته را بگرد.** دو فرمول برای «سود دوره» داشتیم.
- **«خوانده نشد» یک مقدار است** (`null`)، جدا از صفر — در تراز، در سود، در شمارش.
- **قید دیتابیس بعد از FINDING.** نمی‌شود قاعده‌ای را روی ردیف‌هایی گذاشت که نقضش می‌کنند.
- **ارزیابی بیرونی را با اسکیما و کد بسنج.** «زنجیره‌ی journal → ledger_entries» که نقطه‌ی قوت خوانده شد، جدولی است با صفر خواننده.

---

## ۵. عددهای اندازه‌گیری‌شده

| سنجش | نتیجه |
|---|---|
| بک‌اند، اجرای کامل اول | ۴٬۵۵۵ از ۴٬۵۶۰ — ۱ قدیمی (`sales-chart-window`) + ۴ از تغییرهای همین دور |
| بک‌اند، اجرای کامل دوم (بعد از اصلاح) | ۴٬۵۷۳ از ۴٬۵۷۴ — فقط همان `sales-chart-window` قدیمی |
| `packages/ui` | ۱٬۹۷۳ از ۱٬۹۸۲ — همان ۹ قرمز قبلی؛ هیچ‌کدام کلید یا فایل این دور نیست |
| تزریق خطا | برگرداندن دو اصلاح ⇒ ۴ قرمز؛ بازگردانی ⇒ ۱۵ از ۱۵ |
| `tsc` | بک‌اند، validation، api، ui، app-shell، web: ۰ خطا |
| eslint روی فایل‌های تغییرکرده | ۰ خطا |
| FINDING دیتابیس روی Postgres واقعیِ محلی | ۱۵ بلوک، ۱۳ تست سبز |
| مرورگر، دیتابیس زنده | **امتحان نشده** |

---

## ۶. منتظر صاحب پروژه

1. خروجی ۱۴ بلوک دیگر `docs/FINDING-db-integrity.sql` (F3 رسید).
2. خروجی `VERIFY-base-currency-01.sql`، `VERIFY-linter-2026-10-11.sql`، `FINDING-multi-currency.sql`.
3. تصمیم: حساب «سرمایه‌ی افتتاحیه» برای سند موجودی اول و مانده‌ی اول.
4. تصمیم: `getFinancialSummary` حذف شود یا بازنویسی.
5. commit / انتشار: **اول بک‌اند، بعد وب**.

---

## ۷. ادامه — ۱۲ اکتبر: خروجی FINDING و فاز ۱ دیتابیس

صاحب پروژه ۱۳ بلوک از ۱۵ را اجرا کرد (D3 و F1 نرسید). جدول کامل: `.claude/db-integrity/00-SPEC.md` بخش ۶.

| یافته‌ی زنده | ریشه | اقدام |
|---|---|---|
| ۱۵ خط فاکتور بی‌`workspace_id` | `buildItemRows` ستون را نمی‌نوشت | کد اصلاح شد + backfill از فاکتور والد در migration |
| ۱۵ تخصیص به فاکتورِ حذف‌شده | حذف فاکتور قبل از اصلاح «برگشت» | FK `NOT VALID`؛ ردیف‌ها دست‌نخورده، منتظر تصمیم |
| ۱۲ فاکتور فروش بدون بها (۲۱۴٬۲۸۰٬۰۰۰) | BUG-109 | دکمه‌ی «ثبت بها» بعد از انتشار |
| ۳ کالا، ۶۴۳ واحد بی‌بها (۲۲٬۳۸۰٬۰۰۰) | همان | «ارزش‌گذاری با قیمت خرید» بعد از انتشار |
| توازن، شکل خط، ارز تخصیص، لایه‌ها، ارجاع بین کسب‌وکارها | — | همه صفر ⇒ قید گذاشته شد |
| پنج جدول قدیمی (از جمله `transactions`) | — | همه خالی |

ساخته شد: `docs/db-integrity-01-migration.sql` · `docs/VERIFY-db-integrity-01.sql` ·
`backend/src/__tests__/db-integrity-01.pg.test.ts` (۲۰ تست) · `db-integrity-code.test.ts`.

کد: `settlesInCurrency` + رد `PAYMENT_ALLOCATION_CURRENCY_MISMATCH` (DEFECT-CUR-03 بسته شد)؛
`workspace_id` روی هر خط فاکتور؛ حذف کالا لایه‌ی بها را هم تاریخچه می‌داند.

### دیباگ / درس این بخش

- **تریگر توازن باید deferred باشد.** تابع ثبت اول سرصفحه‌ی `posted` و بعد خط‌ها را می‌نویسد؛ تریگر فوری همان ثبت سالم را رد می‌کرد. قبل از نوشتن، `grep from('journal_lines')` نشان داد هیچ سرویسی مستقیم خط نمی‌نویسد — وگرنه نوشتنِ خط‌به‌خط از supabase-js (هر کدام یک تراکنش) می‌شکست.
- **قبل از FK، مسیر حذف والد را بخوان.** `ProductService.delete` کالای بی‌فروش و بی‌حرکت را hard-delete می‌کند؛ با لایه‌ی بهای تازه‌ی موجودی اول، FK آن را به خطای دیتابیس تبدیل می‌کرد.
- **`VALIDATE` را در بلوک با `EXCEPTION WHEN foreign_key_violation` بگذار** تا یک ارجاعِ یتیمِ ناشناخته کل migration را برنگرداند؛ VERIFY می‌گوید کدام‌ها `NOT VALID` مانده‌اند.
- **پیش‌فرض ستون را قبل از برداشتن، در نویسنده‌ها بگرد.** `products.currency DEFAULT 'AFN'` را کد پر نمی‌کند؛ برداشتنش ساخت کالا را می‌شکند.
