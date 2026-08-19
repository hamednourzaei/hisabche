import { formatSelectedAmount, documentIntlLocale } from '../money-display'

export const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * The user's currency, in the reader's locale. Both used to be hardcoded here
 * (see money-display.ts for what was wrong with the table this replaced).
 */
export const fmt = (v: number): string => formatSelectedAmount(v)

export const fmtDate = (d: string): string => {
  try {
    // The locale followed the currency, not the reader — an English interface
    // showed Persian dates.
    return new Date(d).toLocaleDateString(documentIntlLocale())
  } catch {
    return d
  }
}

export const remaining = (total: number, paidAmount: number): number =>
  Math.max(0, total - paidAmount)
