// ============================================
// Invoice money — the one arithmetic
//
// ⚠️ THIS FILE IS A RULE, NOT A SERVER CAPABILITY.
//
// It lives in `packages/validation` because it has to run in TWO places that
// must agree to the smallest unit: the server, when it derives the header of
// an invoice from its lines (`InvoiceService.create`), and the device, when it
// totals the same lines with no network (`packages/local-engine`, Phase 4).
//
// It used to sit inside `invoice.schema.ts` beside the zod schemas. Nothing
// about it needs zod, and a file named "schema" invites the next person to
// re-derive the arithmetic beside the schema instead of calling it. The
// schema re-exports these two functions, so every existing import is unchanged.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ EVERY LINE IS ROUNDED IN THE CURRENCY'S SMALLEST UNIT, THEN ADDED
//    (owner decision F2-01, 19 Oct 2026)
//
// The invoice must foot to the lines a person reads on the paper. Three lines
// of 0.335 USD at 1.00 are three printed 0.34s and a total of 1.02 — not
// 1.005 rounded once to 1.01. The grid always did that; the server summed the
// exact fractions and rounded the sum, so the approved screen and the stored
// invoice disagreed by a cent.
//
// So the rule now needs the invoice's currency: `FRACTION_DIGITS` turns a code
// into the number of decimals, and every line is rounded there before the
// lines are added as integers. An unknown code THROWS — borrowing two decimals
// for it would silently invent a precision the product has no contract for.
//
// ⚠️ THIS CHANGES NEW INVOICES ONLY. A saved total is never recomputed; the
// change applies from the first invoice created after the deploy (CLAUDE.md
// §12 — no backfill, no guessed history).
// ============================================

import { FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'

/**
 * The one place the parent/detail money rule lives. Every totals path and any
 * UI preview must call this — never re-derive it inline.
 *
 * THE RULE — components ADD to the line:
 *
 *   line total = (quantity × unitPrice  +  Σ component.quantity × component.amount)
 *                × (1 − discount%)
 *
 * "قند ۲٬۰۰۰ + سنگ امیتیس ۱٬۰۰۰" totals 3,000, not 2,000. A necklace with no
 * price of its own is the same rule with a zero base: 0 + زنجیر + سنگ + اجرت.
 *
 * Backward compatible: an item with no components contributes an empty sum, so
 * every pre-existing invoice totals exactly as it always did.
 */
export function computeItemTotal(item: {
  quantity: number
  unitPrice: number
  discount?: number
  details?: readonly { quantity: number; amount: number }[]
}): number {
  const base = item.quantity * item.unitPrice
  const components = (item.details ?? []).reduce((sum, d) => sum + d.quantity * d.amount, 0)
  const gross = base + components

  const discount = item.discount ?? 0
  return gross - (gross * discount) / 100
}

/**
 * ONE LINE'S TOTAL, DERIVED AND ROUNDED IN THE INVOICE'S CURRENCY.
 *
 * ⚠️ THIS IS WHAT GETS STORED, AND IT IS NEVER WHAT THE CLIENT SENT.
 *
 * `invoice_items.total_price` used to be written as
 * `item.totalPrice || item.quantity * item.unitPrice` — the request's own line
 * total, with a fallback. The header was already derived from the lines
 * (`computeInvoiceMoney` below), so a request could carry a header that footed
 * and lines that did not: `total_price` was the one money figure on the
 * document that nothing recomputed, and it is read by the profit report
 * (`lineRevenues`), by a purchase's cost layer and by the printed invoice.
 *
 * So the server derives it, from the same operands `computeInvoiceMoney` uses
 * and through the same function, and rounds it to the currency's minor unit
 * (F2-01, `roundInvoiceMoney`). Σ stored lines is then exactly the stored
 * subtotal — the invoice foots.
 *
 * THE COERCION IS PART OF THE RULE. `quantity` and `amount` are optional on a
 * detail, and `undefined * undefined` is NaN, which would be stored as the line
 * total and from there poison the subtotal. They are coerced once, here.
 */
export function computeItemTotalRounded(
  item: {
    quantity?: number | undefined
    unitPrice?: number | undefined
    discount?: number | undefined
    details?: readonly { quantity?: number | undefined; amount?: number | undefined }[] | undefined
  },
  currency: string,
): number {
  return roundInvoiceMoney(
    computeItemTotal({
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      discount: Number(item.discount) || 0,
      details: (item.details ?? []).map((detail) => ({
        quantity: Number(detail.quantity) || 0,
        amount: Number(detail.amount) || 0,
      })),
    }),
    currency,
  )
}

/** The money on an invoice header. Always exact multiples of the minor unit. */
export interface InvoiceMoney {
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
}

/**
 * How many units of the smallest denomination make one unit of `currency`.
 *
 * ⚠️ `Math.round` and the nudge below are the ONLY rounding this file does.
 * `roundTo` in the grid is the same arithmetic for non-money decimals
 * (quantities, weights); money goes through here so the currency decides the
 * precision rather than a caller-supplied number that could disagree with it.
 */
function minorFactor(currency: string): number {
  if (!Object.prototype.hasOwnProperty.call(FRACTION_DIGITS, currency)) {
    throw new Error(`INVOICE_CURRENCY_NO_MINOR_UNIT: ${currency}`)
  }
  return 10 ** FRACTION_DIGITS[currency as KnownCurrency]
}

/**
 * `2.675 × 100` is `267.49999999999997` in binary floating point. The nudge
 * absorbs that representation error so the amount still rounds up, which is
 * what a person doing the sum on paper would write.
 */
function nudge(value: number): number {
  return Math.round(value + (value >= 0 ? 1e-9 : -1e-9))
}

/** `amount` expressed as an integer count of the currency's smallest unit. */
function toMinorUnits(amount: number, factor: number): number {
  return nudge((Number(amount) || 0) * factor)
}

/**
 * Round one money amount to the currency's smallest unit.
 *
 * Exported because the invoice builder prints per-line and per-column money:
 * it must round with the same rule the server stores with, not with a second
 * copy that happens to agree today.
 */
export function roundInvoiceMoney(amount: number, currency: string): number {
  const factor = minorFactor(currency)
  return toMinorUnits(amount, factor) / factor
}

/**
 * The header rule, given line totals that are ALREADY derived.
 *
 * ⚠️ THIS IS THE OTHER HALF OF F2-01. `computeInvoiceMoney` derives each line
 * from its item; the builder derives each line from its row (`rowTotal`),
 * including the row-level tax column it has always shown. Both then call THIS
 * function, so the rounding and the order of operations exist once:
 *
 *     subtotal  = Σ round(line)              each line rounded first
 *     discount  = clamped to [0, subtotal]
 *     taxable   = subtotal − discount
 *     tax       = taxable × rate / 100       rounded to the minor unit
 *     total     = taxable + tax
 *
 * The old builder rounded the sum a second time after already rounding each
 * line; that second rounding is gone. The lines are now added as integers, so
 * there is nothing left for a second rounding to correct.
 *
 * ⚠️ THE DISCOUNT IS CLAMPED, NOT RECOMPUTED. The server receives the discount
 * as a settled AMOUNT (`discountTotal`), not as the value-and-type pair the
 * grid holds, so it cannot re-derive a percentage. Clamping to the subtotal is
 * what it can honestly enforce: a discount larger than the invoice, or a
 * negative one, is not a discount.
 */
export function sumInvoiceLines(input: {
  /** Each line, in major units of `currency`. Not trusted to be rounded. */
  lineTotals: readonly number[]
  /** The settled discount amount the client asked for. Clamped, never trusted. */
  discountTotal?: number | undefined
  /** Percent. When absent or zero, `taxTotal` below is used instead. */
  taxRate?: number | undefined
  /** Fallback when no rate is given — still clamped to be non-negative. */
  taxTotal?: number | undefined
  /** The invoice's currency: the unit every line is rounded to. */
  currency: string
}): InvoiceMoney {
  const factor = minorFactor(input.currency)

  // ⚠️ ROUND EACH LINE FIRST, THEN ADD THE INTEGERS.
  //
  // Rounding the float sum instead is exactly the one-cent defect (F2-01):
  // three 0.335s are 1.005, whose rounded total is 1.01, while the three
  // printed lines are 0.34 each and add to 1.02. The invoice must foot.
  const subtotalMinor = input.lineTotals.reduce((sum, line) => sum + toMinorUnits(line, factor), 0)

  const requestedDiscountMinor = toMinorUnits(input.discountTotal ?? 0, factor)
  const discountMinor = Math.min(subtotalMinor, Math.max(0, requestedDiscountMinor))
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor)

  // ⚠️ THE CLAIMED TAX IS CLAMPED TO THE TAXABLE BASE.
  //
  // Without the upper bound, an invoice with NO LINES and `"taxTotal": 999`
  // totalled 999 — tax on nothing, invented by the request, booked to the
  // ledger. The bound also states the real invariant: tax is charged on an
  // amount, so it cannot exceed the amount it is charged on. A zero base is
  // therefore zero tax, which is what the empty-invoice case needs.
  const rate = Number(input.taxRate) || 0
  const taxMinor =
    rate > 0
      ? nudge((taxableMinor * Math.min(100, Math.max(0, rate))) / 100)
      : Math.min(taxableMinor, Math.max(0, toMinorUnits(input.taxTotal ?? 0, factor)))

  return {
    subtotal: subtotalMinor / factor,
    discountTotal: discountMinor / factor,
    taxTotal: taxMinor / factor,
    total: Math.max(0, taxableMinor + taxMinor) / factor,
  }
}

/**
 * The money on an invoice header, DERIVED FROM ITS LINES.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHY THIS EXISTS — THE CLIENT USED TO DICTATE THE TOTAL.
 *
 * `InvoiceService.create` wrote `subtotal`, `discount_total` and `total`
 * straight from the request body, and `createAccountingEntries` booked the
 * ledger from that same `total`. Nothing recomputed the header from the lines.
 *
 * So `POST /api/invoices` carrying items worth 5,000,000 and `"total": 1`
 * removed the full stock, consumed the full cost layers, and booked revenue of
 * ONE — while the COGS lines were computed from the real consumed cost, making
 * the journal entry a guaranteed loss and the receivable wrong by the
 * difference. `"total": 0` was worse: `createAccountingEntries` returns early
 * on a non-positive total, so the goods left and NOTHING was booked at all.
 *
 * A total is not an input. It is what the lines add up to.
 *
 * ⚠️ `currency` IS REQUIRED. A caller that does not know the invoice's
 * currency does not know how many decimals a line has, and there is no safe
 * default: AFN has none, USD two, IQD three. `InvoiceService.create` therefore
 * settles `bookCurrency` before it asks for the money.
 */
export function computeInvoiceMoney(input: {
  // `| undefined` explicitly: `exactOptionalPropertyTypes` is on across this
  // monorepo, so an optional property and one that may hold `undefined` are
  // different types, and the caller has the latter.
  // ⚠️ `quantity` and `amount` on a DETAIL are optional in `CreateInvoice`, and
  // `undefined * undefined` is NaN — which would silently make the whole
  // invoice total NaN and store it. They are coerced below, once, rather than
  // trusted to be present.
  items: readonly {
    quantity: number
    unitPrice: number
    discount?: number | undefined
    details?: readonly { quantity?: number | undefined; amount?: number | undefined }[] | undefined
  }[]
  /** The settled discount amount the client asked for. Clamped, never trusted. */
  discountTotal?: number | undefined
  /** Percent. When absent or zero, `taxTotal` below is used instead. */
  taxRate?: number | undefined
  /** Fallback when no rate is given — still clamped to be non-negative. */
  taxTotal?: number | undefined
  /** The invoice's currency: the unit every line is rounded to. */
  currency: string
}): InvoiceMoney {
  return sumInvoiceLines({
    // ⚠️ One line, one derivation — `computeItemTotalRounded` is the same call
    // `InvoiceService` stores the line with, so the header and the lines cannot
    // disagree about a cent.
    lineTotals: input.items.map((item) => computeItemTotalRounded(item, input.currency)),
    discountTotal: input.discountTotal,
    taxRate: input.taxRate,
    taxTotal: input.taxTotal,
    currency: input.currency,
  })
}
