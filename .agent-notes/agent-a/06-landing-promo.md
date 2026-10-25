# Pass 6 — landing and promo copy, with its claims rule

## Files read

- `hisabche-promo-reel/SCENARIOS.md` (255 lines, full)
- `SAAS_MOTION_STANDARDS.md` (1-50; tone/gates only)
- `hisabche-promo-reel/src/reels/*.ts` — titles + `vo` extracted for 39 of 71 files
  (`_reel-voices.txt`)
- `packages/ui/.../invoice-detail/invoice-installments-panel.tsx` (1-80)
- `backend/src/services/warehouse/transfer.domain.ts` (1-60)

## Facts proven

- The honest claims table (`SCENARIOS.md:30-46`) is the product's own contract:
  offline **only** in the Windows/mobile app; sync sends the queue after
  reconnection; ledger is automatic from invoice and payment; profit per invoice
  shows «نامعلوم» where the buy price is missing; a foreign-currency invoice is
  not saved without a rate; gold/silver by gram; multi-warehouse + transfer +
  stock count; roles + activity log; Excel import guesses columns and lets the
  user map the ambiguous one; free plan exists; AI is an assistant.
- Same table forbids: «بدون کارت بانکی» unless signup truly needs no card, and
  any "any Excel file" promise.
- The comparison table must stay three-column («اکسل و دفتر» · «نرم‌افزار سنتی» ·
  «حسابچه»), and traditional software is **not** shown as lacking double entry.
- Reel `vo` lines overclaim and must never be copied: «صفر ریال خطا»، «امن‌ترین
  بستر دنیا»، «بکاپ ساعتی»، «۱۰۰٪ امن»، «۳ ثانیه»، «۲ ثانیه». Several reels sell
  **cheque** tracking (102, 54) and a «سپر حسابرسی مالیاتی» (59) — neither is a
  feature (see below).
- Installments are a **schedule** on one invoice: 2/3/4/6/9/12/18/24 parts, a
  first due date, amounts split by the server from what the invoice still owes;
  money is still recorded with «ثبت پرداخت»; states «not set up / failed / no
  plan» are separate sentences (`invoice-installments-panel.tsx:4-12,43`).
- Warehouse transfer has a real lifecycle with an in-transit state:
  requested → approved → picking → shipped → in_transit → received; cancel is
  allowed only before shipping (`transfer.domain.ts:23-55`).

## Facts not proven

- No cheque instrument anywhere: the only trace is a free-text reference
  placeholder «مثلاً چک» (`invoiceBuilder.methodLabelRef`) → cheque tracking is
  NOT a feature.
- No due-date calendar or reminder for installments — a schedule only. Do not
  claim «آلارم اقساط» or «تقویم سررسید».
- The promo's speed numbers (3 s invoice, 2 s AI answer) are not measured
  anywhere in the repo → never quote.

## Deliberately skipped

- Remaining 32 reel files (no title/vo matched the extraction pattern).
- `SAAS_MOTION_STANDARDS.md` beyond the seven quality gates; motion physics is
  irrelevant to a text deliverable.
- `docs/VIDEO-PRODUCTION-WORKFLOW.md` — production process, no product claim.
