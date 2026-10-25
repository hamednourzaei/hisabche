# Runtime audit — every reel must run more than 30 seconds

> Owner requirement, 24 Oct 2026: every reel (the 94 that exist and every future one) has a total runtime **strictly greater than 30.0 s**.
> Source of truth for a reel's duration: **the end of its last scene** (`reel.scenes[last].end`). `reel.duration` is checked against it; a disagreement is reported as `inconsistent`.
> Code: `scripts/runtime-law.mjs` (the law) · `scripts/runtime-audit.mjs` (the audit) · tests in `scripts/__tests__/runtime-law.test.mjs` and `src/__tests__/runtime-law.test.ts`.

## How it is enforced — without breaking the existing workflow

| Where                       | What happens                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isProductionReady(reel)`   | `true` only for a reel that exceeds the minimum outright.                                                                                                               |
| Tests                       | Every reel NOT on `RUNTIME_REMEDIATION` must exceed the minimum. A new reel on that list fails. The list may only shrink: a reel on it that now passes must be removed. |
| Exporter (`export-mp4.mjs`) | A reel **on the list** exports with a printed warning. A reel **not on the list** that is too short is refused (`blockedBy: 'RUNTIME'`) before any frame is drawn.      |

Why not a hard block for everyone: 28 existing reels were at or under the minimum on the day the law was written, many with recorded voice-over or word alignments. Blocking them would stop unrelated work and verification. The list names them exactly; closing it (making the warning a block) is a single edit once they are lengthened.

## The audit (all registered reels)

Run `node scripts/runtime-audit.mjs --write` to regenerate this table. Verdicts: `ok` · `remediation` (≤ 30 s, recorded) · `violation` (≤ 30 s, not recorded) · `inconsistent`.

<!-- AUDIT:BEGIN -->

| Reel | Plan  | Seconds | Verdict     | Scenes | Title                                                                          |
| ---- | ----- | ------: | ----------- | -----: | ------------------------------------------------------------------------------ |
| 01   | —     |    58.0 | ok          |      7 | ابری یا سنتی؟                                                                  |
| 02   | —     |    45.0 | ok          |      6 | یک فروش؛ چند اثر قابل‌پیگیری                                                   |
| 03   | —     |    50.0 | ok          |      5 | نسیه دادی؛ حالا مانده چقدر است؟                                                |
| 04   | —     |    50.0 | ok          |      5 | فروش بالا بود؛ سود چطور؟                                                       |
| 05   | —     |    45.0 | ok          |      5 | اینترنت قطع شد؛ چه چیزی هنوز کار می‌کند؟                                       |
| 06   | —     |    50.0 | ok          |      5 | چند ارز در یک کسب‌وکار                                                         |
| 07   | —     |    50.0 | ok          |      5 | موجودی سیستم با قفسه فرق دارد                                                  |
| 08   | —     |    45.0 | ok          |      5 | چه کسی چه تغییری داد؟                                                          |
| 09   | —     |    45.0 | ok          |      5 | از اکسل شروع کن، نه از صفر                                                     |
| 10   | —     |    59.0 | ok          |      7 | یک روز کاری با حسابچه                                                          |
| 11   | —     |    59.0 | ok          |      5 | چک و قسط فراموش‌شده                                                            |
| 12   | —     |    59.0 | ok          |      5 | دو مغازه، یک صاحب                                                              |
| 13   | —     |    59.0 | ok          |      5 | از مواد خام تا کالای آماده                                                     |
| 14   | —     |    59.0 | ok          |      5 | صف طولانی و مشتری شاکی                                                         |
| 15   | —     |    59.0 | ok          |      5 | ترازنامه بدون مدرک حسابداری                                                    |
| 16   | —     |    59.0 | ok          |      5 | تخفیف دادی، ضرر کردی!                                                          |
| 17   | —     |    59.0 | ok          |      5 | دخل امروز کو؟                                                                  |
| 18   | —     |    59.0 | ok          |      5 | از هوش مصنوعی بپرس                                                             |
| 19   | —     |    59.0 | ok          |      5 | بار بین انبارها گم شد                                                          |
| 20   | —     |    59.0 | ok          |      5 | لپ‌تاپ سوخت، حساب‌ها چی شد؟                                                    |
| 21   | —     |    59.0 | ok          |      5 | هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟                                  |
| 22   | —     |    59.0 | ok          |      5 | فروش داشتی؛ اما واقعاً چقدر سود کردی؟                                          |
| 23   | —     |    59.0 | ok          |      5 | موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟                                   |
| 24   | —     |    59.0 | ok          |      5 | اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟                        |
| 25   | —     |    59.0 | ok          |      5 | تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟                               |
| 26   | —     |    59.0 | ok          |      5 | کی فاکتور رو پاک کرد؟ ردیابی اسناد و امنیت مالی                                |
| 27   | —     |    59.0 | ok          |      5 | چک و قسط سررسید؛ وصول به موقع بدون فراموشی                                     |
| 28   | —     |    59.0 | ok          |      5 | دو مغازه، یک صاحب؛ مدیریت چند شعبه بدون مغایرت                                 |
| 29   | —     |    59.0 | ok          |      5 | از مواد اولیه تا محصول نهایی؛ حسابداری تولید                                   |
| 30   | —     |    59.0 | ok          |      5 | لپ‌تاپ سوخت؛ حساب‌ها چی شد؟ بازیابی فوری                                       |
| 31   | —     |    59.0 | ok          |      5 | هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟                                  |
| 32   | —     |    59.0 | ok          |      5 | فروش داشتی؛ اما واقعاً چقدر سود کردی؟                                          |
| 33   | —     |    59.0 | ok          |      5 | موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟                                   |
| 34   | —     |    59.0 | ok          |      5 | اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟                        |
| 35   | —     |    59.0 | ok          |      5 | تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟                               |
| 36   | —     |    59.0 | ok          |      5 | سر برج چک داری؛ اما دقیقاً چقدر نقدینگی در دست داری؟                           |
| 37   | —     |    59.0 | ok          |      5 | یک روز کاری کامل: از باز کردن کرکره تا بستن صندوق شب                           |
| 38   | —     |    59.0 | ok          |      5 | در تورم امروز، آیا واقعاً سود می‌کنی یا داری مالت را ارزان می‌فروشی؟           |
| 39   | —     |    59.0 | ok          |      5 | چند شعبه و انبار داری؛ اما آیا واقعاً از همه جا خبر داری؟                      |
| 40   | —     |    59.0 | ok          |      5 | اگر وسط شلوغی بازار اینترنت قطع شود، صندوق تو متوقف می‌شود؟                    |
| 41   | —     |    59.0 | ok          |      5 | اگر هنوز دفتر دستی داری؛ این فاجعه حتمی در کمین توست!                          |
| 42   | —     |    59.0 | ok          |      5 | سر ظهر بار دادی بدون پیش‌پرداخت؛ اگر چک پاس نشود چه بر سرت می‌آید؟             |
| 43   | —     |    59.0 | ok          |      5 | تولیدی داری؛ اما قطعات گران‌تر از قیمت فروش فاکتور درآمده است!                 |
| 44   | —     |    59.0 | ok          |      5 | مشتری پای صندوق ایستاده و کالا در انبار شعبه دو مفقود است!                     |
| 45   | —     |    59.0 | ok          |      5 | شش ماه زحمت کشیدی؛ فاکتورهای دستی گم شد و کارفرما تسویه نمی‌کند!               |
| 46   | —     |    59.0 | ok          |      5 | دخلت پر از تراول است؛ اما آیا واقعاً سود کردی یا سرمایه‌ات آب رفت؟             |
| 47   | —     |    59.0 | ok          |      1 | حسابداری دقیق کسب‌وکار با حسابچه (نوار قطاری عمودی و کلاژ کاغذی)               |
| 48   | —     |    59.0 | ok          |      5 | مشتری می‌گه کارت کشیدم؛ ولی دستگاه مغازه فیش نداده!                            |
| 49   | —     |    59.0 | ok          |      5 | بار ۵۰۰ میلیونی رو نسیه دادی؛ ولی پای تسویه، نصف سرمایه‌ت پودر شد!             |
| 50   | —     |    30.0 | remediation |      6 | پولت کجا می‌ره؟ فروش داشتی… ولی سودت کجاست؟                                    |
| 51   | —     |    30.0 | remediation |      6 | وانت باربری دم در منتظره؛ اما کارتن‌ها تو انبار نیست!                          |
| 52   | —     |    30.0 | remediation |      6 | ۳۰۰ میلیون فروختی؛ اما چرا موجودی بانکت فقط ۲ میلیونه؟                         |
| 53   | —     |    26.0 | remediation |      5 | سناریوی کلمه‌به‌کلمه: فروشت زیاده؛ اما آخر ماه پولت کجاست؟                     |
| 54   | —     |    26.0 | remediation |      5 | سناریوی کلمه‌به‌کلمه: ساعت ۱۲ ظهر چکت برگشت می‌خوره!                           |
| 55   | —     |    26.0 | remediation |      5 | سناریوی کلمه‌به‌کلمه: انبارت پره، ولی جیبت خالیه!                              |
| 56   | —     |    26.0 | remediation |      5 | دو شعبه داری؛ ولی کدوم یکی داره ضرر می‌سازه؟                                   |
| 57   | —     |    26.0 | remediation |      5 | فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟                                 |
| 58   | —     |    26.0 | remediation |      5 | قطع اینترنت و ۴۰ مشتری در صف؛ دخل متوقف شد؟                                    |
| 59   | —     |    26.0 | remediation |      5 | برگ تشخیص مالیات ۱۸۰ میلیونی رسید؛ چرا دفاتر رد شد؟                            |
| 60   | —     |    26.0 | remediation |      5 | دالر بالا رفت؛ ۴٬۰۰۰ افغانی کجا رفت؟                                           |
| 61   | —     |    27.0 | remediation |      5 | اون کارتن کجاست؟                                                               |
| 62   | —     |    28.0 | remediation |      5 | زایش فاکتور از دل پرینتر حرارتی                                                |
| 63   | —     |    27.0 | remediation |      5 | گرم و مظنه و اجرت؛ قیمت این گردنبند چنده؟                                      |
| 64   | —     |    27.0 | remediation |      5 | کوری بهای تمام‌شده کارگاه                                                      |
| 65   | —     |    26.0 | remediation |      5 | سه صندلی پر؛ اما شب فقط یک عدد می‌بینی                                         |
| 66   | —     |    40.0 | ok          |      5 | یک شخصیت از حسابچه می‌گوید: فروش روزانه، نسیه و کار بدون اینترنت               |
| 67   | —     |    48.0 | ok          |      6 | همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؟                                 |
| 68   | —     |    18.0 | remediation |      4 | دزد دخلت کیه وقتی نه دزدی شده و نه فروشت کمه؟                                  |
| 69   | —     |    33.5 | ok          |      6 | یک فاکتور، پنج کار — کاراکتر حسابچه                                            |
| 70   | —     |    15.0 | remediation |      4 | ulyssexbt: Genesis Block                                                       |
| 71   | —     |    42.0 | ok          |      6 | سناریوی ترکیبی: چرخه کامل کسب‌وکار از فروش تا تسویه — ۴۲ ثانیه                 |
| 72   | —     |    26.0 | remediation |      4 | انتقال بین انبارها: بار رفت، ولی هنوز نرسیده!                                  |
| 73   | —     |    26.0 | remediation |      4 | صندوق و شیفت: دخل فقط وقتی بسته می‌شود که شمرده شود!                           |
| 74   | —     |    27.0 | remediation |      4 | تولید و فرمول ساخت (BOM): قیمت تمام‌شده هر دانه چنده؟                          |
| 75   | —     |    26.0 | remediation |      4 | پرونده مشتری و سقف اعتبار: به کی چقدر نسیه بدهیم؟                              |
| 76   | —     |    26.0 | remediation |      4 | قفسه‌بندی و کدینگ انبار: راهرو و طبقه را از کد بخوان!                          |
| 77   | —     |    26.0 | remediation |      4 | فهرست قیمت و تخفیف گروهی: برای همکار چند، برای مشتری گذری چند؟                 |
| 78   | —     |    27.0 | remediation |      4 | نرخ ارز و تسعیر: دالر صبح ۷۰، عصر ۷۲؛ سود و زیان تسعیر کجاست؟                  |
| 79   | —     |    26.0 | remediation |      4 | کالای خاک‌خورده و سرمایه راکد (Dead Stock): ۶ ماهه تکون نخورده!                |
| 80   | —     |    26.0 | remediation |      4 | کار بدون اینترنت در اوج شلوغی (Offline Engine): برق رفت، ولی فاکتور متوقف نشد! |
| 81   | —     |    27.0 | remediation |      4 | حقوق و دستمزد تیم: مساعده، غیبت، اضافه کاری؛ آخر ماه کی چقدر طلبکاره؟          |
| 82   | —     |    49.0 | ok          |      7 | گفتگوی مشتری و مالک — پاسخ حسابچه در لحظه                                      |
| 83   | —     |    65.0 | ok          |     10 | یک عدد واقعی — چرخه کامل فروش، انبار، دفتر و سود                               |
| 84   | —     |    47.0 | ok          |     10 | دفترت هنوز دستیه؟ — حسابچه، دفتر مالی ابری                                     |
| 85   | —     |    45.0 | ok          |      6 | عددها معنی پیدا می‌کنن — حسابچه، تبلیغ سینمایی سه‌بُعدی                        |
| 86   | —     |    45.0 | ok          |      6 | شبکه‌ی حسابچه — دیورامای نئونی ایزومتریک                                       |
| 87   | —     |    45.0 | ok          |      6 | شبِ کاغذها — رسیدهای بی‌صاحب به حلقه‌ی دفتر می‌پیوندند                         |
| 88   | —     |    45.0 | ok          |      7 | ساعت صفر — مغازه‌ای که از گریبان دنده یک بازمی‌گردد                            |
| 89   | —     |    45.0 | ok          |      6 | موج روشن — نشت‌های زیر آب قفل و حوض‌ها روشن می‌شوند                            |
| 90   | —     |    46.0 | ok          |      6 | سیل کاغذها — صد برگه، یک داشبورد روشن                                          |
| 91   | —     |    32.0 | ok          |      6 | شوک عدد — فروش ۲۵ میلیون، سود فقط ۶ میلیون                                     |
| 92   | —     |    45.0 | ok          |      6 | میز نیمه‌شب — ساعت ۱۱ شب، حساب روشن در جیب                                     |
| 93   | —     |    45.0 | ok          |      6 | عدد داخل مه — سود واقعی پشت صد فاکتور                                          |
| 94   | L1.09 |    33.0 | ok          |      9 | سه سؤال درباره‌ی تاریخ انقضا                                                   |
| 95   | L2.32 |    34.0 | ok          |      6 | شخصی‌سازی این صفحه، فقط برای خودت                                              |
| 96   | L2.22 |    35.0 | ok          |      7 | مانده‌ی بانک با مانده‌ی دفاتر نمی‌خواند                                        |
| 97   | L2.25 |    34.0 | ok          |      6 | برگه‌ی امضا یا لینک کارمند؟                                                    |
| 98   | L3.05 |    35.0 | ok          |      6 | کدام فروش راکد ماند؟                                                           |

<!-- AUDIT:END -->

## Findings that are not a duration

- **Two files declare reel 75.** `src/reels/reel-75-customer-credit-limit.ts` is the one `src/reels/index.ts` registers. `src/reels/reel-75-profit-or-loss.ts` also exports `reel75` with `id: '75'` and is imported nowhere. It is an orphan: not deleted (it may be unfinished work), not audited. Owner decision: renumber it as a new reel, or remove it.
- **Plan IDs.** Only reels 94–98 carry a plan ID (read from their prompt files: L1.09, L2.32, L2.22, L2.25, L3.05). The other 93 predate `docs/100-VIDEO-PLAN.md`; their plan ID is `—`. Plan §9 lists nine topics where the 100-video plan overlaps existing reels.
- **Reel 70 («ulyssexbt: Genesis Block»)** is a 15-second brand-identity piece for a name that is not Hisabche. It cannot be lengthened by adding product content. Owner decision: keep it as a non-Hisabche showcase outside the law, or retire it.

## Remediation plan (evidence-based, one reel at a time)

The rule: lengthen with a **purposeful beat** — a real product proof, a recap, a consequence — never by slowing animations or holding frames. A reel is removed from `RUNTIME_REMEDIATION` in the same change that makes it pass.

| Group                                         | Reels                                                                | Evidence                                                                                                 | Plan                                                                                                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — exactly 30.0 s**                        | 50, 51, 52                                                           | 30.0 s is not "more than 30"                                                                             | The smallest honest fix is one added proof beat (≥ 3 s) before the CTA; these three have no word alignment to disturb.                                                                          |
| **B — word-aligned voice-over, 26 s**         | 53, 54, 55, 56, 57, 58, 59                                           | each has `src/reels/alignments/reel-NN-alignment.json`; lengthening the middle shifts every aligned word | Add a **closing** beat after the aligned scenes (so no alignment moves): a real-product proof or recap, ≥ 4.1 s. Re-run `check-av-sync.mjs`.                                                    |
| **C — recorded voice file**                   | 61 (27 s), 67 is already > 30                                        | `audio/reel-61-vo.wav` is a real recording                                                               | A new beat needs a new spoken line, so the owner records it; or add a silent, picture-only proof beat.                                                                                          |
| **D — motion reels, no voice-over alignment** | 60, 62, 63, 64, 65, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81 (26–28 s) | no alignment JSON, no audio file                                                                         | Add a ≥ 4–4.1 s beat: the reel's own product page as a `product-capture` (needs the recording) or a recap scene built from the reel's existing operators. Per-reel decision in the table below. |
| **E — far below**                             | 68 (18 s)                                                            | motion showreel                                                                                          | Needs a second act (≈ +12.1 s) — a consequence scene and a proof scene; the concept (the hidden leak) supports it.                                                                              |
| **F — not a Hisabche reel**                   | 70 (15 s)                                                            | brand showcase for another name                                                                          | Owner decision (above).                                                                                                                                                                         |

### Per-reel notes (D)

| Reel | Topic                 | Missing | Natural added beat (product-true)               |
| ---- | --------------------- | ------: | ----------------------------------------------- |
| 60   | exchange-rate gap     |   4.1 s | rate frozen on the invoice (`/invoices/new`)    |
| 62   | thermal receipt       |   2.1 s | the printed invoice (`/invoices/new`)           |
| 63   | goldsmith gram profit |   3.1 s | gram currency on an invoice                     |
| 64   | COGS blind spot       |   3.1 s | profit report with «نامعلوم»                    |
| 65   | profit illusion       |   4.1 s | profit report                                   |
| 72   | warehouse transfer    |   4.1 s | stock transfer page                             |
| 73   | till and shift        |   4.1 s | `/till` count — shares the capture with reel 94 |
| 74   | manufacturing BOM     |   3.1 s | `/manufacturing`                                |
| 75   | customer credit limit |   4.1 s | customer profile                                |
| 76   | shelf map             |   4.1 s | `/warehouse?view=shelfMap`                      |
| 77   | price lists           |   4.1 s | `/invoices?tab=pricing`                         |
| 78   | FX rate               |   3.1 s | exchange-rate page                              |
| 79   | dead stock            |   4.1 s | `/warehouse?view=deadStock`                     |
| 80   | offline POS           |   4.1 s | offline queue (Windows/mobile only)             |
| 81   | team payroll          |   3.1 s | `/team-and-payroll`                             |

Most of these share one need: **real recordings of product pages**. Those are listed once in `docs/CAPTURE-MANIFEST.md`.

## Status

`RUNTIME_REMEDIATION` holds 28 reels today. Reel 94 (L1.09) is not on it: it is lengthened in this change (see `docs/prompts/reel-94-prompt.md`).
