# Session cache — Offline Edition، فاز ۲

**تاریخ:** ۱۹ اکتبر ۲۰۲۶ (نشستِ دومِ همین روز)
**دامنه:** `docs/offline/OFFLINE-EDITION-PROMPT.md` → Phase 2 (استخراج قاعده‌ها)
**وضعیت:** `IMPLEMENTED_NOT_LIVE_VERIFIED` — **هر هفت قاعده منتقل شد** و پرونده‌ی دروازه ۲
(`docs/offline/gates/2.md`) سبز است: سوییتِ بک‌اند بدونِ قرمزیِ تازه، قاعده‌های منتقل‌شده آزمونِ
دو‌ارزی دارند، و شکستنِ هر قاعده هر دو سو را قرمز می‌کند.
⚠️ **این نشست با یک دورِ بازگشت ادامه یافت**: مالک دروازه ۲ را با دو ایراد برگرداند؛ هر دو
اصلاح شد و بخشِ **۷** پایانِ همین فایل، پرونده‌ی آن دور است (نام‌ها عوض شدند و خطِ ذخیره‌شده
سرور-ساخته شد).
**شاخه:** `main`. هیچ چیزی commit یا push نشد. همه‌ی کار در working tree است.

---

## ۱. آنچه انجام شد

### ۱.۱ قاعده‌ی صفر: پولِ ابتدایی

| فایل | کار |
| --- | --- |
| `packages/validation/src/schemas/money.ts` | **جدید.** `round2`، `roundHalfAwayFromZero`، `minor`، `sumRounded` از `backend/src/utils/money.ts` منتقل شدند (کلمه‌به‌کلمه، با همان هشدارها). |
| `backend/src/utils/money.ts` | چهار خط re-export از `@hisabche/validation`؛ دیگر چیزی اعلام نمی‌کند. یازده importer دست‌نخورده. |
| `backend/src/__tests__/money-primitive-guard.test.ts` | گارد **قوی‌تر** شد: هر دو درخت (`backend/src` + `packages/validation/src`) اسکن می‌شوند، «دقیقاً یک اعلان در کلِ ریپو» با نامِ مسیر در پیامِ خطا، و فایلِ بک‌اند باید re-export کند. به‌علاوه `//` هم از کامنت‌ها زده می‌شود (نقصِ خودِ گارد — BUG-131). |

### ۱.۲ قواعد ۴، ۵ و ۷ — پرداخت‌ها (یک فایل، سه قاعده)

| فایل | کار |
| --- | --- |
| `packages/validation/src/schemas/payments.domain.ts` | **جدید.** ۷۲۵ خطِ `payments.domain.ts` بک‌اند کلمه‌به‌کلمه منتقل شد؛ فقط خطِ import به `./money` عوض شد. |
| `backend/src/services/payments/payments.domain.ts` | re-export همه‌ی نام‌ها از `@hisabche/validation`. `round2` هم (چون `supplier.service.ts` آن را از `../payments` می‌گیرد). |
| `packages/validation/src/__tests__/payments-rule.test.ts` | **جدید.** ۲۸ آزمون؛ هر fixture پولی دو ارز (AFN/USD و IQD برای سه رقم اعشار). |

### ۱.۳ قاعده‌ی ۳ — بهای تمام‌شده

| فایل | کار |
| --- | --- |
| `packages/validation/src/schemas/costing.domain.ts` | **جدید.** از `inventory-costing/costing.domain.ts`، با یک خط import. |
| `backend/src/services/inventory-costing/costing.domain.ts` | re-export؛ `stockValue` ↔ `layersValue` alias (BUG-134). |
| `packages/validation/src/__tests__/costing-rule.test.ts` | **جدید.** ۱۹ آزمون (FIFO، AVCO، کسری، `mayIssue`، مرزِ چهار رقم). |

### ۱.۴ قاعده‌ی ۶ — گزارش سود

| فایل | کار |
| --- | --- |
| `packages/validation/src/schemas/profit-report.domain.ts` | **جدید.** فایل هیچ import ندارد، پس هیچ سیمی لازم نبود. |
| `backend/src/services/accounting/profit-report.domain.ts` | re-export. |
| `packages/validation/src/__tests__/profit-report-rule.test.ts` | **جدید.** ۲۳ آزمون؛ مرکزِ فایل «سودی که معلوم نیست» است (`profit: null`). |

### ۱.۵ قاعده‌ی ۴ — دفتر

| فایل | کار |
| --- | --- |
| `packages/validation/src/schemas/accounting.domain.ts` | **جدید.** از `services/accounting/accounting.domain.ts`؛ `AccountRole` از `./accounting.schema` و `round2` از `./money`. |
| `packages/validation/src/schemas/invoice-posting.domain.ts` | **جدید.** `invoiceLedgerLines` و `inBooksCurrency`. |
| `backend/src/services/accounting/{accounting,invoice-posting}.domain.ts` | re-export؛ `PeriodLock` ↔ `LedgerPeriodLock` alias (BUG-133). |
| `packages/validation/src/__tests__/ledger-rule.test.ts` | **جدید.** ۲۸ آزمون. |
| `backend/src/__tests__/invoice-exchange-rate.test.ts` | ادعای منبع‌محور به فایلِ جدید اشاره می‌کند (`shared('schemas/invoice-posting.domain.ts')`)؛ ادعا دست‌نخورده. |
| `backend/src/__tests__/currency-audit.characterisation.test.ts` | همان کار با helperِ جدیدِ `shared(...)`. |

### ۱.۶ گارد و barrel

| فایل | کار |
| --- | --- |
| `packages/validation/src/index.ts` | بخش‌های تازه: پولِ ابتدایی، پرداخت‌ها/تخصیص/مانده‌ی طرف‌حساب، بهای تمام‌شده، گزارش سود، دفتر. `PeriodLock` و `stockValue` **alias** شدند؛ `AccountRole` و `round2` یک‌بار صادر می‌شوند. |
| `packages/ui/src/__tests__/one-rule-each.test.ts` | از ۷ ردیف به **۲۹ ردیف** (۵۹ آزمون). `grossProfit` با امضای کامل پین شد. |

### ۱.۷ مستندات

| فایل | کار |
| --- | --- |
| `docs/offline/02-RULE-EXTRACTION.md` | جدول هفت قاعده (همه منتقل)، §4c–§4h (پولِ ابتدایی، پرداخت‌ها، بهای تمام‌شده، سود، دفتر، یافته‌ها)، اعدادِ اندازه‌گیری‌شده، «انجام نشد». |
| `docs/offline/gates/2.md` | **جدید.** پرونده‌ی دروازه ۲: خروجیِ هر فرمان، جدولِ تزریقِ «هر دو طرف»، تایپ/لینت، و آنچه پوشش نمی‌دهد. |
| `.claude/lessons-learned.md` | درس‌های **۱۹۸–۲۰۲**. |
| `.claude/BUG-REGISTRY.md` | **BUG-131…۱۳۵** (کپیِ ششمِ `round2`، دو `grossProfit`، دو `PeriodLock`، دو `stockValue`، `total_price` از کلاینت). |
| `CLAUDE.md` | شمارنده‌ی درس‌ها ۱–۱۹۷ → **۱–۲۰۲**. |

---

## ۲. اعدادی که اندازه‌گیری شد

```
packages/validation  npx tsc --noEmit                 EXIT=0
packages/validation  npx vitest run                   21 فایل / 353 آزمون سبز
packages/validation  payments-rule.test.ts             28 سبز
packages/validation  costing-rule.test.ts              19 سبز
packages/validation  profit-report-rule.test.ts        23 سبز
packages/validation  ledger-rule.test.ts               28 سبز
packages/validation  invoice-math.parity.test.ts       10 سبز
packages/validation  stock-warehouse.test.ts           10 سبز
packages/ui          npx tsc --noEmit                 EXIT=0
packages/ui          one-rule-each.test.ts             59 سبز (۲۹ قاعده)
packages/api         npx tsc --noEmit                 EXIT=0
apps/web             npx tsc --noEmit                 EXIT=0
backend              npx tsc --noEmit                 EXIT=0
backend             ۵ فایلِ هزینه‌یابی                  96 سبز
backend             ۶ فایلِ پرداخت                     85 سبز
backend             ۵ فایلِ سود                        67 سبز
backend             کلِ سوییت                          356 فایل: ۲ قرمز | ۳۵۴ سبز · ۵٬۰۷۴ آزمون: ۱ قرمز | ۵٬۰۶۵ سبز | ۸ skip (۶۲۵ ثانیه)
backend             دوباره‌اجرای ۲ فایلِ قرمز            14 سبز (قرمزیِ شناخته‌شده بدونِ تغییر)
backend             ۴ فایلِ تزریق                      80 سبز (بازگردانی)
eslint (۲۱ فایلِ تغییریافته)                            EXIT=0
prettier (۲۱ فایلِ کد + ۵ مارک‌داون)                      clean
```

---

## ۳. اثبات‌های تزریق — «هر دو طرف قرمز شود»

دروازه ۲ می‌خواهد شکستنِ قاعده **هر دو سو** را قرمز کند: آزمونِ قاعده در `packages/validation`
**و** آزمونِ بک‌اند که از پوستهٔ re-export رد می‌شود. اگر آزمونِ بک‌اند سبز بماند، یعنی بک‌اند
یک کپی نگه داشته. هر چهار مورد این را نشان دادند و همه بازگردانی شدند:

| قاعده | یک ویرایش در فایلِ مشترک | سوِ مشترک | سوِ بک‌اند |
| --- | --- | --- | --- |
| ۴/۵/۷ پرداخت | `settlesInCurrency` → `return true` | payments-rule **۲ از ۲۸** | db-integrity-code **۳ از ۶** |
| ۳ هزینه‌یابی | `averageUnitCost` → بهای واحدِ آخرین لایه | costing-rule **۲ از ۱۹** | inventory-costing-rules **۲ از ۲۵** |
| ۶ سود | `isCostDeterminate` → `return true` | profit-report-rule **۵ از ۲۳** | cost-unknown-is-not-zero **۶ از ۱۵** |
| ۴ دفتر | `reverseLines` → طرفین جابه‌جا نشوند | ledger-rule **۱ از ۲۸** | accounting-ledger-rules **۱ از ۳۴** |
| پولِ ابتدایی | فایلِ موقت با `function round2(` دوم | گارد **۱ از ۶** با نامِ فایل | — |
| خودِ گارد | فایلِ موقت با `export function paymentPosting(` دوم | one-rule-each **۱ از ۵۹** با نامِ فایل | — |

پس از بازگردانی: validation **۲۱ فایل / ۳۵۳** · گاردِ ui **۵۹** · ۶ فایلِ قاعده **۱۱۸** ·
۴ فایلِ بک‌اندی که قرمز شده بودند **۸۰**. هیچ فایلِ `temp-*` باقی نماند.

## ۳.۱ تصمیم‌های این نشست (خلاصه)

1. **هر قاعده با فایلِ دامنه‌اش منتقل می‌شود، نه با برشِ آن به فایل‌های تازه.** ستونِ «To» در §1
   سه نامِ تازه داشت (`allocation.ts`, `posting.ts`, `costing.ts`)؛ اما خودِ سندِ برنامه می‌گوید
   «قاعده‌ها را در `*.domain.ts` در `packages/validation` منتقل کن». پس `payments.domain.ts`،
   `costing.domain.ts`، `accounting.domain.ts`، `invoice-posting.domain.ts` و
   `profit-report.domain.ts` منتقل شدند — یک فایل، یک قاعده، صفر اختراعِ نام.
2. **پولِ ابتدایی اول.** قاعده‌ای که `round2` می‌خواهد، تا وقتی `round2` در بک‌اند است منتقل نمی‌شود.
3. **`coverSoldUnits` منتقل نشد** چون DB-backed است؛ حسابِ آن `planConsumption` است که منتقل شد.
4. **هم‌نامی‌ها alias شدند، نام عوض نشد** (`layersValue`, `LedgerPeriodLock`) — نام‌گذاریِ دوباره
   یک تغییرِ ارجاع است، نه استخراج (درس ۲۰۲). ⚠️ **بعد:** مالک در همان روز گفت نام‌ها عوض شوند
   و aliasها حذف شوند — بخشِ ۷.
5. **کپیِ ششمِ `round2` دست‌نخورده ماند** (BUG-131) چون حذفش NaN را صفر می‌کند. ⚠️ **بعد:** مالک
   تصمیم گرفت یک `round2` بمانَد و فراخواننده `null` برگردانَد — بخشِ ۷.

---

## ۴. آنچه انجام نشد

- `packages/local-engine` ساخته نشد؛ هیچ‌چیز هنوز از سمتِ دستگاه import نمی‌کند (فاز ۳).
- تصمیمِ **crate نرخِ ارز** (`storedExchangeRate`: نرخِ فاکتور → نرخِ کارگاه → رد) روی سرور ماند؛
  خودِ تبدیل (`inBooksCurrency`) منتقل شد. تصمیمش خواندنِ دو جدول است و جای آن فاز ۳ است.
- پنج یافته‌ی `02-RULE-EXTRACTION.md` §4h تعمیر **نشدند** (تصمیم مالک لازم است). ⚠️ **بعد:**
  هر پنج‌تا با تصمیمِ مالک رفع شدند؛ BUG-136 (مالیاتِ خطی) تازه گزارش شد و باز است — بخشِ ۷.
- مایگریشنِ اسکیمای دستگاه (`SCHEMA_VERSION` ۲→۳، پول به واحدِ صحیح) فاز ۳ است.

---

## ۵. شروعِ نشستِ بعد

1. `docs/offline/gates/2.md`: پرونده‌ی دروازه — خروجیِ فرمان‌ها، جدولِ تزریقِ «هر دو طرف»،
   و آنچه دروازه پوشش نمی‌دهد. (نامِ فایل طبقِ خودِ سندِ برنامه: `gates/<phase>.md`.)
2. سپس فاز ۳: `packages/local-engine` + اسکیمای دستگاه + مایگریشن `SCHEMA_VERSION` ۲→۳.
3. یادآوریِ مالک: برای F2-01 فقط **بک‌اند** نیاز به deploy دارد (وب/دسکتاپ از قبل هر خط را گرد
   می‌کردند)؛ مایگریشنی برای اجرا نیست؛ فقط فاکتورهای تازه.

---

## ۶. تله‌ها (تازه‌های این نشست)

- **`stripComments` در گارد `//` را نمی‌زد.** هر کامنتی که *واژه‌ی ممنوعه* را در متنِ خودش بیاورد،
  به‌عنوان کپیِ دوم گزارش می‌شود. اگر سرِ فایلی نوشتی «گارد دنبالِ `function round2` است»، قبل از
  آن `//` را هم به `stripComments` اضافه کن.
- **سینتکسِ اعلان در گارد:** `restateAtRates` نوعِ جنریک دارد
  (`export function restateAtRates<I extends …>`)، پس رشته‌ی `'…AtRates('` هیچ‌جا match نمی‌کند.
  برای توابعِ جنریک، اعلان را بدونِ پرانتز بنویس.
- **هم‌نامی‌های بین دو پکیج** فقط وقتی دیده می‌شوند که `tsc` بگوید `Duplicate identifier` —
  اسکنِ متنی با `node -e` اینجا گمراه‌کننده بود. `tsc` را داور بگیر.
- **`lineRevenues` گرد نمی‌کند.** `40 × (90.45/100)` در IEEE-754 برابرِ `36.18000000000001` است؛
  در آزمون، سهم را با `round2` بگردان و جمعشان را در واحدِ کوچک بسنج، نه مقدارِ خام را.
- **`knownGrossProfit` با یک ردیفِ partial صفر است**، چون سودِ همان ردیف `null` است؛ برای دیدنِ
  یک عددِ واقعی به یک ردیفِ کاملِ دوم نیاز داری.
- **`inBooksCurrency(amount, 1)` ضرب نمی‌کند** (شرطِ `rate === 1`)، پس یک مرزِ گردکردن را با
  نرخِ ۱ نمی‌شود سنجید.
- **`validateAllocations` برای پرداختِ صفر دو کد می‌دهد** (`PAYMENT_AMOUNT_INVALID` و
  `PAYMENT_OVER_ALLOCATED`) و روی مقدارِ نامعتبر `continue` می‌کند، پس «فاکتورِ ناشناخته» با
  مقدارِ صفر گزارش نمی‌شود.
- **ویرایشِ منبعِ بک‌اند وقتی `vitest run` کلِ سوییت در جریان است، نتیجه را نامعتبر می‌کند.**
  در حینِ اجرای کل، فقط مارک‌داون بنویس.

---

## ۷. دروازه ۲ برگشت خورد — دو ایراد و اصلاحشان (۱۹ اکتبر ۲۰۲۶، ادامه‌ی همین نشست)

مالک دروازه ۲ را با دو ایراد برگرداند. هر دو اصلاح شد؛ فاز ۳ فقط پس از این مجاز است.

### ۷.۱ ایراد یک — `round2` یکی می‌ماند، و معنا را تصمیم نمی‌گیرد

| فایل | کار |
| --- | --- |
| `packages/validation/src/schemas/profit-report.domain.ts` | کپیِ **arrow** حذف شد؛ `import { round2 } from './money'`؛ کامنتِ «از گارد پنهان می‌شوم» با تصمیم مالک جایگزین شد؛ `unreadable` روی مصرفِ ناخوانا و `figuresRead` روی ردیف تا سود (و `grossProfit` دوره) `null` شود |
| `backend/src/services/{accounting/evidence,ai/pipeline/pipeline,analytics/break-even,analytics/cohort,crm/crm,financing/working-capital}.domain.ts` | شش کپی با import جایگزین شد؛ کپیِ `pipeline` که `EPSILON` داشت هم‌تراز شد |
| `backend/src/__tests__/money-primitive-guard.test.ts` | الگو **هر دو شکل** را می‌گیرد: `function round2` / `function roundMoney`، و `round2 =` / `roundMoney = (` / `roundMoney = function`؛ aliasِ `costing.domain.ts` (`const roundMoney = round2`) عمداً مستثناست |
| `packages/validation/src/__tests__/profit-report-rule.test.ts` | سه آزمونِ «ناخوانا صفر نیست» (مصرفِ NaN ⇒ سود `null` و `uncostedRevenue`؛ درآمدِ NaN ⇒ `profit: null`؛ هزینه‌ی واقعیِ ۰ ⇒ `known` با سودِ ۱۰۰۰) |

### ۷.۲ ایراد دو — خطِ ذخیره‌شده را سرور می‌سازد، نه کلاینت

| فایل | کار |
| --- | --- |
| `packages/validation/src/schemas/invoice-math.ts` | `computeItemTotalRounded(item, currency)` (کویرسِ اپشنال‌ها + `roundInvoiceMoney`)؛ `computeInvoiceMoney` هم `lineTotals` را از همان تابع می‌گیرد |
| `packages/validation/src/index.ts` | صادراتِ `computeItemTotalRounded` (عمداً نه در فهرستِ پین‌شده‌ی `invoice.schema.ts`) |
| `backend/src/services/invoice.service.ts` | `withDerivedLineTotals(items, currency)`؛ `create` خطوط را **یک‌بار** می‌سازد و به `computeInvoiceMoney` می‌دهد؛ `buildItemRows` همان `item.totalPrice`ِ ساخته‌شده را می‌نویسد؛ `replaceInvoiceItems` ارز می‌گیرد؛ `update` ارزِ فاکتور را می‌دهد |
| `backend/src/__tests__/invoice-line-total-derived.test.ts` | **جدید** — ۹ آزمون (۵ منبعی + ۴ رفتاری؛ دو ارز) |
| `packages/validation/src/__tests__/invoice-math.parity.test.ts` | بلوکِ تازه: خطِ ذخیره = خطِ چاپی، Σ خطوط = سرِ فاکتور، `totalPrice`ِ غلطِ کلاینت نادیده، و موردِ اجزا |

### ۷.۳ نام‌ها — «یک نام برای هر معنا» (تصمیم مالک)

| نامِ قدیم | نامِ دائمی | مصرف‌کننده‌هایی که عوض شدند |
| --- | --- | --- |
| `insights.domain.ts#grossProfit` | `periodGrossProfit` | `insights/index.ts`، `insights.service.ts` (۵ call site)، `insights-rules.test.ts`. نامِ متریکِ `'grossProfit'` در payload عوض **نشد**. `periodGrossMargin` استفاده نشد: تابع پول برمی‌گرداند و `grossMargin` کنارش درصد است |
| `PeriodLock` (دامنه، شعبه‌آگاه) | `LedgerPeriodLock` | اعلان در `accounting.domain.ts`، barrel، پوستهٔ `backend/.../accounting.domain.ts`، `accounting.repository.ts`، `period-lock-branch.test.ts`، `ledger-rule.test.ts`. `PeriodLock` همان بدنه‌ی API می‌ماند |
| `costing.domain.ts#stockValue` | `layersValue` | aliasِ barrel حذف شد؛ `costing.service.ts`، `inventory-costing/index.ts`، `inventory-costing-rules.test.ts`، `costing-rule.test.ts` |
| `product.schema.ts#stockValue` | `stockValueAtSellPrice` | barrel، containerِ warehouse-detail، `product-page-tiles-and-money.test.ts`. ⚠️ نامِ پیشنهادیِ `stockValueAtBuyPrice` استفاده نشد چون بدنه `sellPrice` را ضرب می‌کند (تصحیحِ BUG-134) |
| `warehouse-map.domain.ts#stockValue` | `stockValueAtBuyPrice` | سه call site در همان فایل + `warehouse-map-domain.test.ts` |

`packages/ui/src/__tests__/one-rule-each.test.ts`: ۲۹ ردیف → **۳۵ ردیف / ۷۱ آزمون** (هر نامِ تازه
یک ردیف؛ `periodGrossProfit` کنارِ `grossProfit` که با **امضای کامل** پین است).

### ۷.۴ اثبات‌های این دور

| چه چیزی شکسته شد | ویرایش | نتیجه |
| --- | --- | --- |
| شکلِ پنهانِ `round2` | فایلِ موقت با `function round2(` دوم در `backend/src/services/` | `money-primitive-guard` **۱ از ۶** قرمز با نامِ فایل؛ حذف ⇒ **۶ سبز** |
| اعتماد به `totalPrice` | بازگرداندنِ `withDerivedLineTotals` و `buildItemRows` به `item.totalPrice \|\| …` | `invoice-line-total-derived` **۶ از ۹** قرمز؛ بازگردانی ⇒ **۹ سبز** |
| نامِ جدید | فایلِ موقت با `export function layersValue(` دوم | `one-rule-each` **۱ از ۷۱** قرمز با نامِ فایل؛ حذف ⇒ **۷۱ سبز** |

### ۷.۵ یافته‌ی تازه — BUG-136 (تعمیر نشد)

`COLUMN.tax` (درصدِ مالیاتِ هر خط) در `rowTotal` ضرب می‌شود، پس خطِ چاپیِ صفحه و `summarize` آن را
دارند؛ `rowToInvoiceItem` ستون‌های built-in را رد می‌کند، پس سرور هیچ اثری از آن نمی‌بیند. پیش از
اصلاحِ ۷.۲ درصد از `totalPrice`ِ کلاینت به خطِ ذخیره‌شده می‌رسید ولی به سرِ فاکتور نه (فاکتور جمع
نمی‌خورد)؛ حالا نه به خط و نه به سر (فاکتور جمع می‌خورد، با خطِ صفحهٔ بالاتر). در هر دو حالت
مالیاتِ خطی **ثبت نمی‌شود**. تصمیمِ محصولی لازم است (detailِ خط، `taxTotal`ِ فاکتور، یا ممنوع شدن).

### ۷.۶ آنچه در این دور انجام نشد

- BUG-136 تعمیر نشد (تصمیمِ محصولی، نه نام‌گذاری).
- `ProductProfitRow.revenue`/`.cost` هنوز `number` هستند (تغییرشان به `number | null` به
  `break-even.domain.ts`، `evidence.domain.ts`، API و صفحه‌ها سرریز می‌کند)؛ پس یک ردیفِ محصول با
  درآمدِ ناخوانا آن درآمد را ۰ نشان می‌دهد در حالی که سودش خالی است. سودِ **دوره** `null` است و
  همان عددی است که آدم روی آن تصمیم می‌گیرد.

