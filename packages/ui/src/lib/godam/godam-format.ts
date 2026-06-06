// packages/ui/src/lib/godam-format.ts

export const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const fmt = (v: number): string => v.toLocaleString("fa-AF")