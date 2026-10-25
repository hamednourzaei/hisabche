# Overlap audit — the new reels against the 93 that already exist, and against each other

> Owner, 24 Oct 2026: «همپوشانی نداشته باشن؛ ویدیوهای جدید». Two videos must not say the same thing.
> Method: every existing reel's title was read (`docs/motion-catalogue/CATALOGUE.md`), the keywords of each candidate topic were searched in `src/reels/*.ts`, `src/data/reel-registry.ts`, `docs/prompts/*.md` and the scene files, and `docs/100-VIDEO-PLAN.md` §9 (the plan's own list of topics that already exist) was applied.

## 1. What was found — and replaced

The first draft of the five representative reels (L1.05, L2.01, L1.12, L3.02, L3.03) **overlapped existing reels in every case**:

| First draft                                    | Existing reel(s) that already say it                                                              | Verdict  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| L1.05 «سه سؤال قبل از بستن صندوق» (till count) | 73 «صندوق و شیفت: دخل فقط وقتی بسته می‌شود که شمرده شود!», 17 «دخل امروز کو؟», 37 «بستن صندوق شب» | replaced |
| L2.01 «ثبت فاکتور فروش»                        | 02/69 «یک فاکتور، چند اثر / پنج کار», 62 (print), plan §9 (L1.01)                                 | replaced |
| L1.12 «فروش، بها، سود، نامعلوم»                | 04, 22, 32, 46, 50, 91, 93 (profit), 05/22/32 flagged by plan §9, 64                              | replaced |
| L3.02 «انبار ۲۰، قفسه ۱۰» (stock count)        | 07 «موجودی سیستم با قفسه فرق دارد», 23/33 «موجودی داری؛ اما…», 76 (shelves)                       | replaced |
| L3.03 «فروش زیاد است، پول نیست» (credit)       | 03 «نسیه دادی؛ حالا مانده چقدر است؟», 75 «پرونده مشتری و سقف اعتبار», 49                          | replaced |

## 2. The five that replace them (same five styles, new subjects)

| Reel | Plan ID | Subject                               | Style                        | Closest existing                | Why it is not the same                                                                                                                            |
| ---- | ------- | ------------------------------------- | ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 94   | L1.09   | تاریخ انقضا (صفحه‌ی «انقضا و بچ»)     | سه سؤال، تایپوگرافی روی کاغذ | 79 (dead stock)                 | 79 is about stock that has not moved; it names an expiry alarm once. No reel is about the expiry page, its states, days left or expired value.    |
| 95   | L2.32   | شخصی‌سازی صفحه («شخصی‌سازی این صفحه») | نمایش محصول، یک کار          | none                            | A topic the plan itself freed in §9 (replacement for the nine overlaps). No reel mentions it.                                                     |
| 96   | L2.22   | مغایرت‌گیری بانکی                     | درس مالی، تخته گچی           | 52 (bank balance vs sales)      | 52 asks why the bank holds less than the sales; 96 teaches how the bank and the books differ and are matched. Different question, different page. |
| 97   | L2.25   | ثبت حضور: برگه یا لینک کارمند         | مقایسه، تقسیم صفحه           | 81 (payroll: absence, overtime) | 81 is how pay is settled; 97 is how attendance is recorded. No reel shows the employee's link page.                                               |
| 98   | L3.05   | فروشِ راکد و پیگیری                   | روایت                        | 03, 75 (credit)                 | The subject is a sale that went quiet and the follow-up tab; no reel is about «پیگیری و کمپین» or «فرصت‌های راکد».                                |

## 3. Between the five

The five subjects share no page, no product word and no pain: expiry (warehouse hub) · dashboard personalisation (page look) · bank reconciliation (treasury) · attendance link (people) · stale sales (customers hub). Styles are five different logics (paper-and-marker, light product walkthrough, chalkboard, two-tone split, lamp-lit list). `validateReelRegistry` checks the same at registry level: no repeated art direction, topology or template between neighbours; creative similarity ≤ 35 %.

## 4. Honest limits

- Titles and keyword searches find topic overlap, not every way two videos can sound alike. The check is evidence, not a proof.
- Reel 79 and reel 55 mention an expiry alarm and a reorder point inside other stories; if the owner wants **zero** mention, reel 94 is the only one affected.
- Plan §9 lists nine topics that already exist; none of the five touches them.
- Reel 75 is declared twice in `src/reels` (`reel-75-customer-credit-limit.ts` is registered; `reel-75-profit-or-loss.ts` is an unregistered orphan) — recorded in `docs/RUNTIME-AUDIT.md`.
