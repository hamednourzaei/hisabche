import { formatSelectedAmount } from '../money-display'

export const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * The user's currency, in the reader's locale. Both used to be hardcoded here
 * (see money-display.ts for what was wrong with the table this replaced).
 */
export const fmt = (v: number): string => formatSelectedAmount(v)
