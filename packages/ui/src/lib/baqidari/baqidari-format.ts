// packages/ui/src/lib/baqidari-format.ts

export const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const fmt = (v: number): string => v.toLocaleString("fa-AF")

export const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString("fa-AF")
  } catch {
    return d
  }
}

export const remaining = (total: number, paidAmount: number): number =>
  Math.max(0, total - paidAmount)