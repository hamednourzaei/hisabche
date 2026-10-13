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

import { parseCellNumber } from '@hisabche/validation'

/** `from` units of the invoice's currency are worth `to` units of the books currency. */
export function exchangeRateOf(from: string, to: string): number | null {
  const left = parseCellNumber(from)
  const right = parseCellNumber(to)
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
