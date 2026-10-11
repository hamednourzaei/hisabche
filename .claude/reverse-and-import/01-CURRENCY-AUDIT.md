# ممیزی معماری ارز — دور دهم (۱۱ اکتبر ۲۰۲۶)

> فقط خواندن. هیچ کد محصول، migration یا ستونی در این دور عوض نشد. تنها فایل تازه یک تست
> «وضعیت فعلی» است (`backend/src/__tests__/currency-audit.characterisation.test.ts`، ۴ از ۴) که
> دو نقص اصلی را به‌صورت واقعیتِ قابل‌اجرا ثبت می‌کند — سبز بودنش یعنی «هنوز رفع نشده».
>
> آنچه **خوانده نشد** و بنابراین `UNKNOWN` است، در انتهای هر بخش گفته شده. دیتابیس زنده دیده نشد؛
> شکل جدول‌ها از `docs/SETUP-COMPLETE.sql` و فایل‌های migration است.

---

## 1. Currency Architecture Matrix

سه پاسخ برای همه‌ی ردیف‌ها یکی است و یک بار گفته می‌شود:

- **ارز پایه‌ی کسب‌وکار ذخیره نمی‌شود.** جدول `workspaces` ستون ارز ندارد (`SETUP-COMPLETE.sql:984`) و
  هیچ migration ای اضافه‌اش نکرده. «پایه» هر جا لازم است حرف `'AFN'` است: `currency.service.ts:159`
  (`input.baseCurrency ?? 'AFN'`)، `invoice.service.ts:911/1185/1263`، `payments.service.ts:218`،
  `payments.repository.ts:67`، `costing.repository.ts:135`، `customer.service.ts:362`. پس «تغییر ارز پیش‌فرض»
  اصلاً عملیاتی نیست که وجود داشته باشد؛ کسب‌وکاری که ارز پایه‌اش AFN نیست جایی برای گفتنش ندارد.
- **ارز نبودن = AFN**، بی‌صدا، در همه‌ی مسیرهای بالا.
- **دقت/گردکردن:** فهرست ارز و تعداد اعشار در `packages/formatting/src/money.ts` (`FRACTION_DIGITS`) و
  `currencyCodeSchema` است، ولی مسیرهای نوشتن سرور (`invoice.service.ts`) به آن ارجاع نمی‌دهند
  (grep: صفر مورد)؛ پرداخت با `round2` و `numeric(18,2)` کار می‌کند، دفتر با `numeric(19,4)`.
  یعنی دقتِ «به‌ازای ارز» فقط در نمایش تعریف شده است.

| # | دامنه | ارز ذخیره می‌شود؟ کجا | مبلغ در چه ارزی | نرخ ذخیره می‌شود؟ | چند ارز کنار هم؟ | جمع امن است؟ | تست |
|---|---|---|---|---|---|---|---|
| A | ارز پایه | **نه** | — | — | — | — | ندارد |
| B | تراکنش (`transactions`) | بله، `transactions.currency` | ارز خود تراکنش | نه | بله | **نه** — خواننده‌ها ارز را نمی‌خوانند | تست وضعیت فعلی |
| C | ارز فاکتور | بله، `invoices.currency` | ارز فاکتور | نه | بله | فقط به تفکیک ارز | `analysis` دارد |
| D | نرخ فاکتور | **نه** — هیچ ستونی (`ALTER TABLE invoices … rate`: صفر) | — | — | — | — | تست وضعیت فعلی |
| E | دریافتنی مشتری | از `invoice_outstanding` (ارز هر فاکتور را دارد) | ارز فاکتور | نه | بله | به تفکیک ارز بله؛ جمع کل نه | بخشی |
| F | مانده‌ی اول مشتری | `customers.opening_balance` بی‌ارز؛ تراکنشش `'AFN'` ثابت | AFN فرض‌شده | نه | نه | — | ندارد |
| G | تراکنش مشتری | مثل B | | | | **نه** | تست وضعیت فعلی |
| H | پرداختنی تأمین‌کننده | مثل E (فاکتور خرید در همان `invoices`) | ارز فاکتور | نه | بله | به تفکیک ارز | UNKNOWN |
| I | مانده‌ی اول تأمین‌کننده | خوانده نشد (`supplier.service.ts`) | UNKNOWN | نه | UNKNOWN | UNKNOWN | UNKNOWN |
| J | ارز پرداخت | بله، `payments.currency` (پیش‌فرض `'AFN'`) | ارز پرداخت | نه | بله | به تفکیک ارز | UNKNOWN |
| K | ارز تخصیص | **نه** — `payment_allocations(amount)` بی‌ارز | نامعلوم | نه | **قاطی می‌شود** | **نه** | ندارد |
| L | صندوق (POS) | **نه** — `pos.service.ts` صفر ارجاع به ارز | نامعلوم | نه | نه | نه | ندارد |
| M | حساب بانکی | **نه** — `banking.service.ts` صفر ارجاع به ارز | نامعلوم | نه | نه | نه | ندارد |
| N | قیمت فروش کالا | ستون `products.currency DEFAULT 'AFN'` **هست** (`SETUP-COMPLETE.sql:1378`) ولی `product.service.ts` هرگز آن را نمی‌خواند و نمی‌نویسد | عملاً بی‌ارز | نه | نه | — | ندارد |
| O | قیمت خرید کالا | همان N | | | | | |
| — | فهرست قیمت | بله، `price_lists.currency` (یک ارز به‌ازای فهرست) | ارز فهرست | نه | بله، فهرست ارز دیگر کنار گذاشته می‌شود | — | `price-lists` دارد |
| P | مالیات | ارز ندارد؛ `invoice_tax_lines` به «پول» (افغانی×۱۰۰) توصیف شده (`SETUP-COMPLETE.sql:4518`) | ارز فاکتور، ضمنی | نه | — | — | UNKNOWN |
| Q | تخفیف | ارز ندارد؛ جزء جمع فاکتور | ارز فاکتور، ضمنی | نه | — | — | — |
| R | بدهکار/بستانکار دفتر | **نه** — `journal_lines(debit, credit)` فقط عدد | **همان عدد سند، در هر ارزی که بود** | نه | **بله، بی‌نشان** | **نه** | تست وضعیت فعلی |
| S | مانده‌ی حساب دفتر | نه | مخلوط | نه | — | **نه** | ندارد |
| T | تاریخچه‌ی نرخ | بله، `exchange_rates(workspace_id, currency_code, rate numeric(20,8), rate_date)`؛ یکتا به‌ازای روز | واحد پایه به‌ازای یک واحد ارز | — | — | — | UNKNOWN |
| U | سود/زیان تسعیر | `fx_revaluations` + `fx_revaluation_lines` و سند دفتر `fx_revaluation` | پایه | `booked_rate` ذخیره می‌شود — ولی همیشه **۱** | — | — | UNKNOWN |
| V | گزارش‌ها | بسته به گزارش — بخش ۱۱ | | | | | |
| W | داشبورد | `analytics.service.ts` هم سطل به‌ازای ارز دارد هم جمع کل مخلوط | | | | بخشی | UNKNOWN |
| X | ارزش موجودی | `cost_layers.currency DEFAULT 'AFN'`؛ `costing.service.ts` صفر ارجاع به ارز | نامعلوم | نه | بی‌نشان | UNKNOWN | UNKNOWN |
| Y | بهای تولید | `manufacturing.service.ts` ۱۴ ارجاع به ارز (`productionMoneyContext`) | ارز زمینه | نه | UNKNOWN | UNKNOWN | UNKNOWN |
| Z | مرکز ورود داده | فاکتور: ارز از سطر یا انتخاب، هرگز فرض نمی‌شود؛ مشتری/کالا: بی‌ارز | | نرخ خوانده نمی‌شود | | | `http-migration-invoices` |

---

## 2. Financial Data Flow (آنچه واقعاً اتفاق می‌افتد)

**فاکتور فروش ۱۰۰ دلاری، نرخ ۷۰:**

1. `POST /api/invoices` → `invoice.routes.ts:198` `currency: body.currency ?? 'AFN'`.
2. `InvoiceService.create` → `invoices.currency = 'USD'`، `total = 100`. نرخ و معادل پایه جایی نوشته نمی‌شود.
3. دفتر: `invoice.service.ts` (تابع ثبت سند، حدود خط ۲۶۵۰–۲۶۹۵) `const total = Number(data.total)` و
   `{ receivable: debit total } / { sales: credit total }` → **بدهکار ۱۰۰، بستانکار ۱۰۰**، بدون ارز.
4. دریافتنی: `invoice_outstanding` ردیف `(USD, outstanding 100)` — درست، چون ارز کنار عدد می‌ماند.
5. تسعیر پایان ماه (`month-end.service.ts:152` → `currency.service.ts`): `bookedRate: 1` ⇒ ارزش ثبت‌شده ۱۰۰،
   ارزش امروز ۷٬۰۰۰ ⇒ **«سود تسعیر» ۶٬۹۰۰** به دفتر می‌رود.

نتیجه: سیستم نه «۱۰۰ USD + ۷٬۰۰۰ AFN» را ثبت می‌کند و نه «۱۰۰ AFN»؛ در سند فاکتور «۱۰۰ USD» و در دفتر
«۱۰۰ با نرخ ضمنی ۱» ثبت می‌شود. بعد از تسعیر، حساب دریافتنی به ۷٬۰۰۰ می‌رسد ولی درآمد فروش ۱۰۰ می‌ماند
و ۶٬۹۰۰ به‌غلط سود ارزی است.

**مانده‌ی مشتری — دو مدل موازی:**

- `GET /api/customers/:id/balance` → `CustomerService.getBalance` (`customer.service.ts:530`) →
  `transactions_view.select('type, amount')` → `partyBalance` (`payments.domain.ts:226`). ارز خوانده نمی‌شود.
  همین جمع در `transaction.routes.ts:372` تکرار شده (آنجا `currency` select می‌شود ولی به `partyBalance` نمی‌رسد).
  مصرف‌کننده‌ها: `customer.routes.ts:216`، `customer.service.ts:250` (`getById`)، `customer-portal.service.ts:185`.
- خلاصه‌ی مشتری/صورت‌حساب (`payments.repository.ts:152/204/232` از `invoice_outstanding`) → `payments.domain.ts`
  جمع می‌زند و فقط `currencies: string[]` را برمی‌گرداند با توضیح «بیش از یکی یعنی جمع‌ها ارز قاطی دارند» —
  یعنی نقص شناخته شده و **علامت‌گذاری** شده، نه رفع.

`transactions` را فقط مانده‌ی اول مشتری (`customer.service.ts:349`) و `transaction.routes.ts` می‌نویسند؛
فاکتور در آن ردیفی نمی‌گذارد. پس «مانده»‌ی مسیر اول و «دریافتنی»‌ی مسیر دوم دو عدد متفاوت‌اند.

**پرداخت:** `recordPayment` (`payments.service.ts`) → `validateAllocations(amount, allocations, invoices)` —
پارامتر ارز ندارد → تابع SQL `payments-ar-ap-migration.sql` فقط `allocated ≤ amount` و
`allocation ≤ outstanding` را می‌سنجد. ارز پرداخت با ارز فاکتور **هیچ‌جا مقایسه نمی‌شود**
(grep روی `docs/*.sql` و `services/payments`: تنها `CURRENCY_MISMATCH` موجود مال کیف پول است).

---

## 3. Currency Invariant List

| شناسه | قاعده | وضعیت امروز |
|---|---|---|
| INVARIANT-CURRENCY-001 | مبلغ‌های ارزهای مختلف بدون تبدیل صریح جمع نمی‌شوند | **نقض** — DEFECT-CUR-01، 03، 05 |
| 002 | سند مالی نرخ زمان ثبت را نگه می‌دارد | **نقض** — DEFECT-CUR-02 |
| 003 | مانده‌ی مشتری ارز-آگاه است | **نقض** — DEFECT-CUR-01 |
| 004 | پرداختنی تأمین‌کننده ارز-آگاه است | احتمالاً نقض (همان مسیرها)؛ مانده‌ی اول `UNKNOWN` |
| 005 | تخصیص پرداخت معنای ارز را حفظ می‌کند | **نقض** — DEFECT-CUR-03 |
| 006 | مانده‌ی صندوق/بانک ارز-آگاه است | **نقض** — DEFECT-CUR-06 |
| 007 | گزارش به ارز پایه با تبدیل صریح | **نقض** — دفتر و گزارش‌های رویش |
| 008 | نرخ امروز مقدار تاریخی را عوض نمی‌کند | **برقرار** برای سندها (نرخ اصلاً خوانده نمی‌شود)؛ تسعیر سند جدا می‌زند |
| 009 | ورود ارزی هرگز نرخ ۱ بی‌صدا نمی‌گیرد | **نقض در موتور** — خودِ `InvoiceService` این کار را می‌کند |
| 010 | تکرار ورود اثر مالی را دوبار نمی‌سازد | **برقرار** برای فاکتور/کالا/مشتری (تست‌های دور ۷ تا ۹) |
| 011 (تازه) | ارز پایه‌ی کسب‌وکار یک مقدار ذخیره‌شده است، نه یک حرف در کد | **نقض** |
| 012 (تازه) | هر سطر دفتر یا به ارز پایه است یا ارز و نرخش را همراه دارد | **نقض** |
| 013 (تازه) | ستون ارزی که وجود دارد توسط سرویس مالکش خوانده و نوشته می‌شود | **نقض** — `products.currency`، `cost_layers.currency` |
| 014 (تازه) | دو راهِ رسیدن به «مانده‌ی یک طرف حساب» یک عدد می‌دهند | **نقض** — `getBalance` در برابر خلاصه‌ی دریافتنی |

---

## 4. Critical Defects

### DEFECT-CUR-01 — CRITICAL MULTI-CURRENCY ACCOUNTING DEFECT: مانده‌ی مشتری ارزها را با هم جمع می‌کند

- **فایل/نماد:** `backend/src/services/customer.service.ts` → `getBalance` (`.select('type, amount')`)؛
  `backend/src/routes/transaction.routes.ts:372`؛ قاعده `partyBalance` در `payments/payments.domain.ts:226`
  (`LedgerMovement` فیلد ارز ندارد).
- **رفتار:** ۱۰۰ USD + ۱۰٬۰۰۰ AFN = **۱۰٬۱۰۰**. اثبات: تست وضعیت فعلی، سبز.
- **مثال:** مشتری با تراکنش ۱۰۰ دلاری و ۱۰٬۰۰۰ افغانی «بدهکار ۱۰٬۱۰۰» نشان داده می‌شود؛ واقعیت ۱۷٬۰۰۰ افغانی است.
- **باید:** مانده به تفکیک ارز، یا با معادل پایه‌ی ثبت‌شده.
- **خطر:** عدد غلط روی صفحه‌ی مشتری و پورتال مشتری؛ پیگیری طلب با مبلغ غلط.
- **اثر بر ورود:** مانده‌ی اول ارزی مشتری قابل ورود نیست.

### DEFECT-CUR-02 — CRITICAL: دفتر کل فاکتور ارزی را با نرخ ضمنی ۱ ثبت می‌کند

- **فایل/نماد:** `invoice.service.ts` تابع ثبت سند (`const total = Number(data.total) || 0` → `debit: total`)؛
  `journal_lines` بدون ستون ارز/نرخ؛ `currency.service.ts:133` `bookedRate: 1`.
- **رفتار و مثال:** بخش ۲. درآمد ۱۰۰ به‌جای ۷٬۰۰۰؛ پس از تسعیر، ۶٬۹۰۰ «سود ارزی» ساختگی.
- **باید:** معادل پایه با نرخ روز سند ثبت و روی سند منجمد شود.
- **خطر:** تراز آزمایشی «متوازن» است و غلط؛ سود و زیان، مالیات و بستن ماه همه از همین عددها می‌آیند.
- **دامنه:** فاکتور فروش و خرید، بهای تمام‌شده، تسعیر، گزارش‌های دفتر.
- **اثر بر ورود:** هر فاکتور ارزیِ واردشده همین سند غلط را می‌سازد — **همین امروز**، چون دور هشتم ارز فاکتور را فعال کرد.

### DEFECT-CUR-03 — CRITICAL: تخصیص پرداخت ارز را نمی‌سنجد

- **فایل/نماد:** `payments.domain.ts` → `validateAllocations`؛ تابع SQL در `docs/payments-ar-ap-migration.sql`
  (حلقه‌ی تخصیص)؛ `payment_allocations` بدون ارز.
- **مثال ۱ (هم‌ارز):** فاکتور ۱۰۰ USD، پرداخت ۴۰ USD → مانده ۶۰ USD. **درست.**
- **مثال ۲ (ناهم‌ارز):** فاکتور ۱۰۰ USD، پرداخت ۲٬۸۰۰ AFN → `PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING`
  (۲٬۸۰۰ > ۱۰۰). ولی پرداخت **۴۰ AFN** پذیرفته می‌شود و ۴۰ «دلار» از فاکتور کم می‌کند.
- **نبودِ اولیه‌ها:** ارز تخصیص، نرخ تسویه، مبلغ در هر دو ارز، حساب سود/زیان تحقق‌یافته‌ی ارز.
- **اثر بر ورود:** ورود پرداخت ارزی ناامن است.

---

## 5. High-Risk Gaps

| شناسه | شکاف | شاهد |
|---|---|---|
| DEFECT-CUR-04 | ارز پایه ذخیره نمی‌شود؛ `'AFN'` در ≥۱۶ فایل | بخش ۱ |
| DEFECT-CUR-05 | صورت جریان نقد همه‌ی تراکنش‌ها را بی‌ارز جمع می‌کند | `accounting/operational-reports.ts:60` — `select('id, type, amount, description, date')` و `inflow += amount` |
| DEFECT-CUR-06 | صندوق و بانک ارز ندارند | `pos/pos.service.ts` و `banking/banking.service.ts`: صفر ارجاع به ارز |
| DEFECT-CUR-07 | داشبورد کنار سطل‌های ارزی، جمع کل مخلوط می‌دهد | `analytics.service.ts:446` `totalRevenue += total` و `:545/:549` |
| DEFECT-CUR-08 | ستون‌های ارزِ بی‌صاحب | `products.currency`، `cost_layers.currency` |
| DEFECT-CUR-09 | خلاصه‌ی دریافتنی مخلوط‌بودن را فقط علامت می‌زند | `payments.domain.ts:308` |
| DEFECT-CUR-10 | مانده‌ی اول مشتری همیشه AFN | `customer.service.ts:362` (خود کد می‌گوید «تصمیم محصول است») |

---

## 6. Safe Existing Capabilities

- فاکتور، پرداخت و تخصیص **در یک ارز** (هر ارزی): مبلغ‌ها درست و مانده درست (`invoice_outstanding`).
- تحلیل کسب‌وکار به تفکیک ارز: `analysis.service.ts` (۳۸ ارجاع به ارز) و قاعده‌ی «جمع بدون ارز غلط است» در `CLAUDE.md`.
- فهرست قیمت تک‌ارزی که روی ارز دیگر اعمال نمی‌شود (`price-lists-01-migration.sql`).
- تاریخچه‌ی نرخ روزانه و «آخرین نرخ در یا قبل از تاریخ» (`currency.service.ts:83`)، نرخ ≤۰ رد می‌شود.
- کسب‌وکار **تک‌ارزی AFN**: هیچ‌کدام از نقص‌های بالا بروز نمی‌کند.

## 7. Unsupported Capabilities

پرداخت با ارزی غیر از ارز فاکتور · سود/زیان تحقق‌یافته‌ی ارز · دفتر چندارزی · مانده‌ی چندارزیِ یک طرف حساب ·
صندوق/بانک ارزی · قیمت کالا به ارز (جز از راه فهرست قیمت) · ارز پایه‌ی غیر AFN · مانده‌ی اول ارزی.

---

## 8. Data Migration Impact

`SAFE` یعنی وضعیت مالی حاصل درست و قابل حسابرسی است، نه اینکه فایل خوانده می‌شود.

| دامنه | ارز پایه (AFN) | ارز خارجی | نرخ | تصویر تاریخی | ورود امن؟ |
|---|---|---|---|---|---|
| مشتری (بی‌مانده) | SAFE | — | — | — | **SAFE** |
| کالا | SAFE (قیمت بی‌ارز = AFN) | UNSUPPORTED | — | — | SAFE فقط AFN |
| فاکتور | SAFE | **UNSAFE** (سند دفتر با نرخ ۱) | خوانده نمی‌شود | ندارد | SAFE فقط AFN |
| پرداخت | وارد نمی‌شود | UNSAFE | — | — | NOT BUILT |
| تأمین‌کننده | وارد نمی‌شود | UNKNOWN | — | — | NOT BUILT |
| خرید | مثل فاکتور | UNSAFE | — | — | SAFE فقط AFN |
| دفتر | وارد نمی‌شود | UNSAFE (سطر بی‌ارز) | — | — | UNSAFE |
| صندوق | وارد نمی‌شود | UNSUPPORTED | — | — | UNSAFE |
| بانک | وارد نمی‌شود | UNSUPPORTED | — | — | UNSAFE |
| مانده‌ی اول مشتری | SAFE اگر کسب‌وکار AFN باشد | UNSAFE | — | — | SAFE فقط AFN |

⚠️ **پیامد فوری:** دور هشتم ورود فاکتور با ارز غیر AFN را باز کرد. سند فاکتور درست است، ولی سند دفترش
همان نقص CUR-02 را می‌سازد. تا رفع، ورود فاکتور ارزی باید پشت یک هشدار صریح یا بسته باشد — این یک
تصمیم است و در این دور اعمال **نشد**.

---

## 9. Recommended Architecture

سه گزینه با مدل موجود سنجیده شد:

- **A — سطل جدا به‌ازای ارز:** برای **مانده‌ی طرف حساب** با مدل فعلی سازگار است: `invoice_outstanding`،
  `payments` و `transactions` همه ارز دارند و `analysis.service` همین الگو را دارد. تغییر در خواندن است، نه در schema.
- **B — ارز تراکنش + معادل پایه:** برای **دفتر کل** تنها گزینه‌ی سازگار است: `journal_lines` یک جفت
  بدهکار/بستانکار دارد و تراز آزمایشی، سود و زیان و بستن سال همه روی جمع همین ستون‌ها ساخته شده‌اند؛ پس
  این ستون‌ها باید **ارز پایه** باشند و ارز/مبلغ/نرخ اصلی کنارشان بیاید.
- **C — مانده‌ی مشتق از دفتر:** امروز ممکن نیست؛ سطر دفتر به طرف حساب وصل نیست.

پس جهت پیشنهادی **A برای مانده‌ها + B برای دفتر** است — نه به سلیقه، بلکه چون هر کدام همان جایی می‌نشیند که
کد موجود از قبل شکلش را دارد.

## 10. Required Implementation Phases (هیچ‌کدام شروع نشده)

1. **ارز پایه‌ی کسب‌وکار** به‌صورت مقدار ذخیره‌شده با پیش‌فرض صریح AFN؛ جایگزینی حرف‌های `'AFN'`.
2. **مانده‌ی ارز-آگاه** (گزینه‌ی A): `partyBalance` و دو مصرف‌کننده‌اش، خلاصه‌ی دریافتنی، جریان نقد، جمع داشبورد. بدون تغییر schema.
3. **نرخ منجمد روی سند**: نرخ و معادل پایه روی فاکتور و پرداخت؛ نبودِ نرخ برای ارز غیرپایه ⇒ رد، نه ۱.
4. **دفتر به ارز پایه** (گزینه‌ی B) + اصلاح `bookedRate`؛ تصمیم درباره‌ی سندهای ارزیِ از قبل ثبت‌شده
   (§12: حدس ممنوع — اول FINDING روی دیتابیس زنده که چند فاکتور غیر AFN وجود دارد).
5. **تخصیص هم‌ارز اجباری**؛ بعد، اگر خواسته شد، تسویه‌ی بین‌ارزی با سود/زیان تحقق‌یافته.
6. صندوق و بانک ارزی.
7. فقط بعد از ۱ تا ۵: ورود پرداخت، تأمین‌کننده و مانده‌ی اول ارزی.

---

## وضعیت اجرا (۱۱ اکتبر، بعد از ممیزی)

- **بسته شد:** ورود فاکتور به ارزی غیر از ارز دفاتر (`INVOICE_FOREIGN_CURRENCY_CLOSED` در `planInvoices`).
  «خارجی» یعنی «غیر از ارز دفاتر همین کسب‌وکار»، نه «غیر از AFN». ثبت دستیِ فاکتور ارزی **هنوز باز است**.
- **فاز ۱ — بک‌اند انجام شد، `IMPLEMENTED_NOT_LIVE_VERIFIED`:** `services/base-currency.ts`
  (`baseCurrencyOf` / `describeBaseCurrency` / `setBaseCurrency`)، ستون `workspaces.base_currency`
  (`docs/base-currency-01-migration.sql` — **اجرا نشده، منتظر انسان**)، `GET|PUT /api/finance/currency/base`،
  هوک‌های `useBaseCurrency` / `useSetBaseCurrency`. ارز دفاتر فقط تا وقتی سند مالی نیست قابل تغییر است
  (`BASE_CURRENCY_LOCKED`). پیش‌فرض‌های نوشتن در فاکتور، پرداخت، تراکنش دستی، مانده‌ی اول مشتری، لایه‌ی بها و
  تسعیر حالا از آن می‌خوانند.
- **از فاز ۱ مانده:** صفحه‌ای برای انتخاب ارز دفاتر (هوک هست، UI نیست)؛ حرف‌های `'AFN'` در مسیرهای **خواندن**
  (`row.currency || 'AFN'` در `accounting.repository.ts`، `analytics.service.ts`، `payments.repository.ts`) —
  این‌ها درباره‌ی ردیف‌های قدیمیِ بی‌ارزند که پیش‌فرض ستونشان AFN بوده و جایگزینیِ کورکورانه‌شان غلط است؛
  پیش‌فرض‌های `'AFN'` در تابع‌های SQL (`COALESCE(… 'currency', 'AFN')`)؛ کلاینت‌ها.
- ⚠️ `baseCurrencyOf` در `InvoiceService.create` **بعد از** پاسخ replay خوانده می‌شود — replay چیزی نمی‌خواند
  (سه تست `invoice-idempotency` با خواندنِ زودتر قرمز شدند).

## تکمیل ممیزی (دور یازدهم، فقط خواندن)

### بخش‌هایی که `UNKNOWN` بودند

| بخش | وضعیت | شاهد |
|---|---|---|
| مانده‌ی تأمین‌کننده | **DEFECT** (همان CUR-01) | `supplier.service.ts` → `get360`: `purchasedValue = Σ total` و `outstanding = Σ outstanding` روی فاکتورهایی که `currency` دارند ولی ارز در جمع نیست؛ `balance: -ledger.balance` از `getPartyLedger` → `partyBalance` |
| مانده‌ی اول تأمین‌کننده | **وجود ندارد** | جدول `suppliers` (`SETUP-COMPLETE.sql:786`) ستون مانده ندارد و `supplier.service.create` تراکنشی نمی‌نویسد. ورودش یعنی ساختنِ یک مفهوم تازه، نه پرکردن یک جدول |
| صندوق | **DEFECT-CUR-12** | `pos.service.ts:189` پرداخت‌های نقد را با `select('… amount …')` می‌خواند و `Math.round(amount*100)` را به کشو اضافه می‌کند — بدون ارز. همه‌ی ستون‌های صندوق `*_minor` بی‌ارزند. پرداخت نقدی ۵۰ دلاری = ۵۰ واحد در کشو |
| بانک | **DEFECT-CUR-13** | حساب بانکی یک حساب دفتر است، بی‌ارز؛ `bank_statements` و `bank_statement_lines` فقط `*_minor`؛ `banking.service.ts:225` پرداخت‌ها را برای مغایرت بدون ارز می‌خواند |
| لایه‌ی بهای خرید | **DEFECT-CUR-11** | `invoice.service.ts:2570` `costing.recordReceipt({ unitCost: lineTotal / quantity … })` ارز فاکتور را نمی‌فرستد ⇒ بهای یک خرید دلاری با برچسب ارز دفاتر ذخیره می‌شود. مصرف (`costing.domain.ts:83/95/143`) لایه‌ها را بدون ارز جمع می‌کند ⇒ بهای تمام‌شده‌ی فروش غلط |
| ارزش موجودی | **DEFECT** (جزئی) | `stock-summary.domain.ts:44` `quantity × sell_price`، `analytics.service.ts:620` — قیمت کالا بی‌ارز است؛ برای کسب‌وکار تک‌ارزی درست، وگرنه نامعلوم |
| موبایل | **CONFIRMED: مدل جدا ندارد** | `apps/mobile` هیچ ارجاعی به ارز ندارد؛ همان `packages/app-shell` را نشان می‌دهد |
| دسکتاپ/آفلاین | **DEFECT-CUR-14** | `packages/app-bridge/src/local-schema.ts:64/95` `currency TEXT NOT NULL DEFAULT 'AFN'`؛ `packages/db-schema/src/drizzle.schema.ts:78/124`؛ `sync-engine.ts:136` `str(r.currency) ?? 'AFN'`. ارز حمل می‌شود ولی نرخ و معادل پایه در مدل محلی نیست؛ فاکتور آفلاینِ بی‌ارز در دستگاه AFN می‌شود، مستقل از ارز دفاتر |
| sync | **CONFIRMED** برای حمل ارز؛ نرخ ندارد | `packages/sync/src` فقط در کدک به مقدارهای پرتکرار اشاره دارد؛ تعارض ارزی جداگانه‌ای تعریف نشده |
| `report.service.ts`، `campaign.service.ts`، `installment.service.ts`، `late-fee.service.ts` | **UNKNOWN** | خط به خط خوانده نشدند (`campaign.service` صفر ارجاع به ارز دارد و از `invoice_outstanding` جمع می‌زند ⇒ مشکوک) |

### فهرست هاردکدها (حرف `'AFN'`، بدون تست)

| ناحیه | فایل | خط | دسته |
|---|---|---|---|
| بک‌اند | ۱۵ | ۳۴ | بعد از فاز ۱: مسیرهای نوشتن رفع شد؛ باقی = خواندنِ ردیف قدیمی و ثابت ماژول |
| `packages/ui` | ۲۷ | ۳۹ | **نقص محصول** — پایین |
| `packages/validation` | ۶ | ۸ | **نقص محصول** — `invoice.schema.ts:514`، `transaction.schema.ts:17`، `human-resources.schema.ts:100/208`، `project.schema.ts:27` همه `.default('AFN')`؛ `common.schema.ts:90` فهرست ارز (مشروع) |
| `packages/store` | ۴ | ۷ | **نقص محصول** — `currency.slice.ts:102/115/147`، `invoice-draft.slice.ts:127`، `onboarding.slice.ts:57`، `preferences.slice.ts:24` |
| `packages/app-shell` | ۲ | ۲ | نقص — `sync-engine.ts:136`، `ui.store.ts:42` |
| `packages/ui-contract` | ۱ | ۳ | `BILLING_CURRENCY` (ارز اشتراکِ خودِ حسابچه — مشروع، ربطی به دفاتر مشتری ندارد)؛ فهرست ارز (مشروع) |
| `packages/app-bridge`، `db-schema` | ۲ | ۴ | پیش‌فرض ستون محلی — نقص |
| SQL | — | ۵ | `inventory_receive_layer` و `record_payment`: `COALESCE(… 'currency', 'AFN')`؛ پیش‌فرض ستون‌ها |
| `apps/web`، `apps/desktop`، `apps/mobile`، `apps/admin` | ۰ | ۰ | — |

⚠️ **مهم‌ترین یافته‌ی این فهرست:** `createInvoiceSchema` خودش `currency.default('AFN')` دارد. هر جا بدنه با این
schema پارس شود، فاکتورِ بی‌ارز **قبل از رسیدن به سرویس** AFN شده است و پیش‌فرضِ ارز دفاتر که در فاز ۱ در
`InvoiceService.create` گذاشته شد هرگز اجرا نمی‌شود. یعنی فاز ۱ در این مسیر هنوز اثر ندارد.

صفحه‌هایی که **می‌نویسند** `'AFN'` (بدترین دسته): `customers/AddCustomerModal.tsx:124`،
`customers/containers/customer-container.tsx:180`، `customers/PaymentModal.tsx:129`،
`quick-invoice/quick-invoice-page.tsx:1056/1081` و `:863` (برچسب تخفیف ثابت)،
`quick-invoice/containers/quick-invoice-container.tsx:330`، `hr-view.tsx:279`،
`team-and-payroll-view.tsx:151/195`. صفحه‌هایی که **نمایش می‌دهند** با fallback: `ActivityGroupCard.tsx:34/38`،
`customer-stats.tsx:34`، `customer-view.tsx:513`، `invoice-detail-container.tsx:215`، `invoices-mappers.ts:31`،
`employee-detail-view.tsx:616/688/707`، `employee-list-table.tsx:161`، `payroll-list-table.tsx:98`،
`warehouse-view.tsx:524` + `lib/warehouse/rate-from-pair.ts:10` (`BASE_CODE = 'AFN'`). اتحادیه‌ی چهارتایی
`'AFN' | 'USD' | 'PKR' | 'IRR'` در `budgets-view.tsx:1231/1321`، `lib/utils.ts:27`، `invoices-types.ts:62`،
`api/hooks/budgets.ts:58/124`، `pricing.ts:53`، `project.schema.ts:27` — فهرست خصوصیِ ارز، خلاف قاعده‌ی
«فهرست ارز یکی است».

### سیاست موقت (تا رفع CUR-01/02/03)

بسته به **ارز دفاتر**، نه به `'AFN'`: (۱) ورود فاکتور غیرهم‌ارز — **بسته شد**؛ (۲) ثبت دستی فاکتور غیرهم‌ارز —
باز است و باید در `InvoiceService.create` رد شود؛ (۳) پرداخت با ارزی غیر از ارز فاکتور — باید در
`recordPayment` رد شود؛ (۴) تراکنش دستی غیرهم‌ارز. سندهای موجود دست نمی‌خورند. ⚠️ پیش از بستنِ ۲ تا ۴ یک
FINDING روی دیتابیس زنده لازم است: چند فاکتور/پرداخت غیر AFN از قبل هست — کسب‌وکاری که امروز دلاری کار
می‌کند با این بستن متوقف می‌شود.

### ماتریس تست لازم

تک‌ارزی (ارز دفاتر AFN و غیر AFN) · دو ارز در یک مشتری · تخصیص هم‌ارز و ناهم‌ارز · فاکتور ارزی با نرخ و بدون نرخ ·
تسعیر با نرخ منجمد · فاکتور آفلاین بی‌ارز و sync · تکرار درخواست · سند قدیمیِ قبل از نرخ · خرید ارزی و لایه‌ی بها ·
صندوق با پرداخت نقدی ارزی. هر کدام عدد ارز-به-ارز و عدد پایه را **جدا** می‌سنجد.

### معیار پذیرش «بدون هاردکد»

`grep "['\"]AFN['\"]"` بیرون از تست فقط در این‌جاها بماند: فهرست ارز (`common.schema.ts`، `money.ts`،
`ui-contract/currencies.ts`)، `DEFAULT_BASE_CURRENCY` در `base-currency.ts`، `BILLING_CURRENCY`، و نگاشت واژه‌ها در
`places.domain.ts`. یک گارد (`no-hardcoded-currency.test.ts`) با همین فهرست بسته.

### کوچک‌ترین فاز امنِ بعدی

**ادامه‌ی فاز ۱ — «ارز دفاتر به صفحه‌ها برسد»:** برداشتن `.default('AFN')` از schemaها (سرویس تصمیم می‌گیرد)،
یک هوک `useBookCurrency()` روی `useBaseCurrency`، و جایگزینی هاردکدهای نوشتن و نمایش در ۲۷ فایل `packages/ui` +
۴ فایل `packages/store` + گارد. بدون تغییر schema دیتابیس.

### پیشرفت «ارز دفاتر به صفحه‌ها برسد» (۱۱ اکتبر، بعد از تکمیل ممیزی)

انجام شد: `.default('AFN')` از `invoice`/`transaction`/`human-resources`/`project` schema برداشته شد و سرور
(`InvoiceService`، `human-resources.service`، `project.service`) از `baseCurrencyOf` پر می‌کند؛ هوک
`useBookCurrency` (بدون fallback)؛ صفحه‌هایی که `'AFN'` **می‌نوشتند** (افزودن مشتری، ثبت پرداخت مشتری، کارمند
تازه در `hr-view`، فاکتور سریع) دیگر ارز نمی‌فرستند یا ارز دفاتر را نشان می‌دهند؛ `lastCurrency` دستگاه خالی شروع می‌شود.

**هنوز هاردکد دارند** (۲۶ خط در `packages/ui`+`store`+`app-shell`، بخشی کامنت): `team-and-payroll-view.tsx:151/195`
(حالت اولیه‌ی فرم)، `employee-detail-*`، `employee-list-table`، `payroll-list-table`، `invoices-mappers.ts:31`،
`budgets-view.tsx` و اتحادیه‌های چهارتایی، `warehouse-view.tsx:524` + `rate-from-pair.ts` (مدل نرخِ «افغانی به‌ازای واحد»
انبار — یک مدل جداست، نه یک حرف)، `currency.slice.ts`، `invoice-draft.slice.ts:127`، `onboarding.slice.ts:57`،
`ui.store.ts:42`، `sync-engine.ts:136`، پیش‌فرض ستون‌های محلی. گارد `no-hardcoded-currency` هنوز نوشته نشده.

⚠️ درس: `prettier --write <پوشه>` ده فایل بی‌ربط را قالب‌بندی کرد؛ فقط فایل‌های ویرایش‌شده را نام ببر.

## آنچه خوانده نشد (`UNKNOWN`)

`supplier.service.ts` و مانده‌ی اول تأمین‌کننده · مدل‌های مالی موبایل و دسکتاپ · مسیر sync/change-log برای ارز ·
جزئیات `pos.service.ts` و `banking.service.ts` فراتر از «ارجاعی به ارز ندارند» · `costing.service.ts` و ارزش موجودی ·
`report.service.ts`، `campaign.service.ts`، `installment.service.ts`، `late-fee.service.ts` (خط به خط) ·
تست‌های موجودی که رفتار ارزی را اثبات می‌کنند (جستجو نشد) · فرم‌های UI (فقط دیده شد که هیچ فرمی نرخ ارز نمی‌فرستد:
grep `exchangeRate` در `packages/ui` و `packages/api` جز صفحه‌ی نرخ‌ها و «مبنای نمایش» داشبورد چیزی ندارد).

---

CURRENCY ARCHITECTURE VERDICT

**C. MULTI-CURRENCY UNSAFE** — ارز روی سندها ذخیره می‌شود و در یک ارز درست کار می‌کند، ولی دفتر کل،
مانده‌ی طرف حساب و تخصیص پرداخت ارز را نمی‌شناسند و ارز پایه وجود ندارد.

- ورود فاکتور ارزی امروز امن است؟ **نه** (سند فاکتور درست، سند دفتر غلط).
- ورود پرداخت ارزی؟ **نه**.
- ورود مانده‌ی اول مشتری؟ **فقط AFN**.
- ورود مانده‌ی اول تأمین‌کننده؟ **UNKNOWN** — خوانده نشد؛ تا اثبات، نه.
- ورود سند دفتر چندارزی؟ **نه**.
- پیش از فعال‌شدن: فازهای ۱ تا ۵ بالا.
