// ============================================
// packages/ui/src/lib/warehouse/warehouse-share.ts
//
// One warehouse's share of the stock value ON SCREEN.
//
// The list's «سهم» column and the «ارزش موجودی به تفکیک انبار» chart must give
// the same answer, so both read the denominator from here. It is the sum of the
// rows this list shows — never the workspace total: that total also counts
// stock sitting in no warehouse, and a list is not proof that every product has
// been placed.
//
// A row without a summary is UNKNOWN: it stays out of the denominator and gets
// a null share, which the screens draw as «—» — never as a zero bar.
// ============================================

export interface ValueShare {
  /** The sum of the known values; 0 when nothing is known. */
  total: number
  /** `value / total × 100`, or null when the value is unknown or nothing is known. */
  percent: (value: number | null) => number | null
}

export function valueShares(values: readonly (number | null)[]): ValueShare {
  const total = values.reduce<number>((sum, value) => (value === null ? sum : sum + value), 0)
  return {
    total,
    percent: (value) => {
      if (value === null || total <= 0) return null
      return (value / total) * 100
    },
  }
}
