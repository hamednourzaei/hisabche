// ============================================
// The rate an invoice in another currency is booked at.
//
// A person says a rate as a pair — «۱٬۰۰۰٬۰۰۰ تومان = ۱٬۵۷۰ افغانی» — because
// one toman in afghani is a number nobody says. The server wants one number:
// units of the BOOKS currency per one unit of the invoice's currency.
//
// Null is «not a rate»: nothing typed, a zero, a negative, a word. The caller
// refuses to send the invoice then — it never falls back to 1.
// ============================================

import { FRACTION_DIGITS, isMetal, metalFactor, metalFractionDigits } from '@hisabche/formatting'
import { parseCellNumber } from '@hisabche/validation'

/**
 * `from` units of the invoice's currency are worth `to` units of the books currency.
 *
 * ⚠️ A metal side is typed in the unit SHOWN (g / kg / t) and the rate is
 * stored per GRAM, the books' unit: «1 kg gold = 7.5B afghani» is 7.5M per
 * gram. Without the currencies (callers that predate metal units) both sides
 * are taken as stored units.
 */
export function exchangeRateOf(
  from: string,
  to: string,
  invoiceCurrency?: string | undefined,
  bookCurrency?: string | undefined,
): number | null {
  const left = parseCellNumber(from) * metalFactor(invoiceCurrency)
  const right = parseCellNumber(to) * metalFactor(bookCurrency)
  if (!(left > 0) || !(right > 0)) return null
  const rate = right / left
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

/** Does an invoice in `invoiceCurrency` need a rate in a business keeping `bookCurrency` books? */
export function needsExchangeRate(
  invoiceCurrency: string | undefined,
  bookCurrency: string | undefined,
): boolean {
  // Until the books currency has arrived there is nothing to compare with;
  // the server decides, and refuses by name if one was needed.
  return !!invoiceCurrency && !!bookCurrency && invoiceCurrency !== bookCurrency
}

/**
 * A product's price — kept in the BOOKS currency — as it goes on a line of an
 * invoice in `invoiceCurrency`.
 *
 * ⚠️ It used to be copied as-is: an ice cream priced 80 afghani went onto a
 * dollar invoice as 80 DOLLARS (5,600 afghani at 70) on the live site, 14 Oct.
 * With a rate it is converted and rounded to the invoice currency's own digits;
 * without one the price is left EMPTY for the person to type — never copied,
 * never guessed.
 */
export function priceForInvoice(
  price: string,
  invoiceCurrency: string | undefined,
  bookCurrency: string | undefined,
  rate: number | null,
): string {
  // The line is typed in the unit SHOWN: a metal's stored grams are divided by
  // the chosen unit (a 2,500 g price reads «2.5» on a kilogram invoice).
  const shownFactor = metalFactor(invoiceCurrency)
  const digits = isMetal(invoiceCurrency)
    ? metalFractionDigits()
    : ((FRACTION_DIGITS as Record<string, number>)[String(invoiceCurrency).toUpperCase()] ?? 2)
  const round = (value: number) => Math.round(value * 10 ** digits) / 10 ** digits
  if (!needsExchangeRate(invoiceCurrency, bookCurrency)) {
    if (shownFactor === 1) return price
    const stored = parseCellNumber(price)
    return stored > 0 ? String(round(stored / shownFactor)) : price
  }
  const inBooks = parseCellNumber(price)
  if (!(inBooks > 0) || !rate) return ''
  return String(round(inBooks / rate / shownFactor))
}

/**
 * An amount of the invoice's currency in the books currency: amount × rate
 * («1 دالر = 65 افغانی» ⇒ × 65), rounded to the books currency's digits.
 * null without a rate — never × 1.
 */
export function inBooksAtRate(
  amount: number,
  rate: number | null,
  bookCurrency: string | undefined,
  invoiceCurrency?: string | undefined,
): number | null {
  if (!rate || !(rate > 0) || !Number.isFinite(amount)) return null
  // Typed (shown) → stored, at the stored rate, → the books' shown unit.
  const shown = (amount * metalFactor(invoiceCurrency) * rate) / metalFactor(bookCurrency)
  const digits = isMetal(bookCurrency)
    ? metalFractionDigits()
    : ((FRACTION_DIGITS as Record<string, number>)[String(bookCurrency ?? '').toUpperCase()] ?? 2)
  const factor = 10 ** digits
  return Math.round(shown * factor) / factor
}

/** A line whose price the app filled from a product (not typed by a person). */
export interface AutoPricedLine {
  /** The product's price in the BOOKS currency. */
  booksPrice: string
  /** What was written into the line — compared to tell a later hand edit apart. */
  filled: string
}

/**
 * When the invoice's currency or rate changes, every line the APP priced is
 * priced again from the product's books price (owner, 18 Oct 2026: a 30M
 * afghani gearbox picked first, then «دالر» and «1 = 65» chosen — the line
 * stayed 30,000,000 and was simply called dollars: a 60M DOLLAR invoice).
 *
 * A line whose price a person changed is never touched. With no rate yet the
 * line is emptied rather than left holding a number in the wrong currency.
 */
export function repriceAutoFilled(
  current: ReadonlyMap<string, string>,
  auto: ReadonlyMap<string, AutoPricedLine>,
  invoiceCurrency: string | undefined,
  bookCurrency: string | undefined,
  rate: number | null,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const [rowId, line] of auto) {
    const now = current.get(rowId)
    if (now === undefined || now.trim() !== line.filled.trim()) continue
    const next = priceForInvoice(line.booksPrice, invoiceCurrency, bookCurrency, rate)
    if (next !== line.filled) out.set(rowId, next)
  }
  return out
}
