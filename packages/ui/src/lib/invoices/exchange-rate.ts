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
import {
  COLUMN,
  parseCellNumber,
  type GoldLineSnapshot,
  type InvoiceGridRow,
} from '@hisabche/validation'

import { productCost, productPrice, type ProductPriceSource } from './products'

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

export type TradingSide = 'sale' | 'purchase'

/**
 * Maps all four document kinds (`sale`, `purchase`, `pre_sale`, `pre_purchase`)
 * onto ONE canonical pricing direction (`sale` vs `purchase`). Advances share
 * the exact same pricing rules as trading invoices rather than keeping a second engine.
 */
export function tradingSideOf(kind: string | null | undefined): TradingSide | null {
  if (kind === 'purchase' || kind === 'pre_purchase') return 'purchase'
  if (kind === 'sale' || kind === 'pre_sale') return 'sale'
  return null
}

/** A line whose price the app filled from a product (not typed by a person). */
export interface AutoPricedLine {
  /** The product's price in the BOOKS currency. */
  booksPrice: string
  /** Books-currency selling price (`sale` and `pre_sale`). */
  sellBooksPrice?: string | undefined
  /** Books-currency buying price (`purchase` and `pre_purchase`). */
  buyBooksPrice?: string | undefined
  /** What was written into the line — compared to tell a later hand edit apart. */
  filled: string
  /** Locked metal-rate snapshot attached only on the sale side. */
  saleGoldSnapshot?: GoldLineSnapshot | undefined
}

/**
 * Extracts both sides' books-currency unit prices for a warehouse product so
 * switching between sale, purchase, pre_sale, and pre_purchase reprices from ONE source.
 */
export function productDualBooksPrices(
  product: ProductPriceSource,
  saleQuote?: { price: number; goldSnapshot?: GoldLineSnapshot | undefined } | undefined,
): {
  sellBooksPrice: string
  buyBooksPrice: string
  saleGoldSnapshot?: GoldLineSnapshot | undefined
} {
  const rawSell = saleQuote ? saleQuote.price : productPrice(product)
  const rawBuy = productCost(product)
  return {
    sellBooksPrice: rawSell > 0 ? String(rawSell) : '',
    buyBooksPrice: rawBuy > 0 ? String(rawBuy) : '',
    ...(saleQuote?.goldSnapshot ? { saleGoldSnapshot: saleQuote.goldSnapshot } : {}),
  }
}

/** Resolves the books-currency unit price to use for `transactionType` (`sale`/`pre_sale` vs `purchase`/`pre_purchase`). */
export function booksPriceForSide(
  line: Pick<AutoPricedLine, 'booksPrice' | 'sellBooksPrice' | 'buyBooksPrice'>,
  transactionType?: string | null | undefined,
): string {
  const side = tradingSideOf(transactionType)
  if (side === 'purchase') {
    return line.buyBooksPrice !== undefined ? line.buyBooksPrice : line.booksPrice
  }
  if (side === 'sale') {
    return line.sellBooksPrice !== undefined ? line.sellBooksPrice : line.booksPrice
  }
  return line.booksPrice
}

export interface RepricedLinePlan {
  rowId: string
  unitPrice: string
  booksPrice: string
  filled: string
  goldSnapshot?: GoldLineSnapshot | undefined
}

/**
 * When the invoice's currency, rate, or document type (`sale` / `purchase` /
 * `pre_sale` / `pre_purchase`) changes, every line the APP priced is priced
 * again from the product's books price (owner, 18 Oct 2026: a 30M afghani
 * gearbox picked first, then «دالر» and «1 = 65» chosen — the line stayed
 * 30,000,000 and was simply called dollars: a 60M DOLLAR invoice).
 *
 * A line whose price a person changed is never touched. With no rate yet (or
 * no recorded price on the target side) the line is emptied rather than left
 * holding a number from the wrong currency or wrong trading side.
 */
export function repriceAutoFilled(
  current: ReadonlyMap<string, string>,
  auto: ReadonlyMap<string, AutoPricedLine>,
  invoiceCurrency: string | undefined,
  bookCurrency: string | undefined,
  rate: number | null,
  transactionType?: string | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const [rowId, line] of auto) {
    const now = current.get(rowId)
    if (now === undefined || now.trim() !== line.filled.trim()) continue
    const targetBooksPrice = booksPriceForSide(line, transactionType)
    const next = priceForInvoice(targetBooksPrice, invoiceCurrency, bookCurrency, rate)
    if (next !== line.filled) out.set(rowId, next)
  }
  return out
}

/** Plans atomic unitPrice + goldSnapshot updates for all app-priced invoice rows. */
export function planRepricedLines(
  rows: readonly InvoiceGridRow[],
  autoPriced: Readonly<Record<string, AutoPricedLine>>,
  invoiceCurrency: string | undefined,
  bookCurrency: string | undefined,
  rate: number | null,
  transactionType?: string | null | undefined,
): RepricedLinePlan[] {
  const side = tradingSideOf(transactionType)
  const plans: RepricedLinePlan[] = []
  for (const row of rows) {
    const line = autoPriced[row.id]
    if (!line) continue
    const currentPrice = row.values[COLUMN.unitPrice] ?? ''
    if (currentPrice.trim() !== line.filled.trim()) continue
    const targetBooksPrice = booksPriceForSide(line, transactionType)
    const nextPrice = priceForInvoice(targetBooksPrice, invoiceCurrency, bookCurrency, rate)
    const nextGold = side === 'purchase' ? undefined : line.saleGoldSnapshot
    const priceChanged = nextPrice !== line.filled || currentPrice !== nextPrice
    const goldChanged = row.goldSnapshot !== nextGold
    const booksChanged = line.booksPrice !== targetBooksPrice
    if (priceChanged || goldChanged || booksChanged) {
      plans.push({
        rowId: row.id,
        unitPrice: nextPrice,
        booksPrice: targetBooksPrice,
        filled: nextPrice,
        ...(nextGold ? { goldSnapshot: nextGold } : {}),
      })
    }
  }
  return plans
}
