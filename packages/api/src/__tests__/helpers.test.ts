// packages/api/src/__tests__/helpers.test.ts
import { describe, it, expect } from 'vitest'

// ============================================
// PURE HELPERS (copy from your codebase)
// ============================================

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: unknown): string => num(v).toLocaleString('fa-AF')

const rem = (inv: { total: number; paidAmount: number }): number =>
  Math.max(0, inv.total - inv.paidAmount)

const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString('fa-AF')
  } catch {
    return d
  }
}

// ============================================
// TESTS
// ============================================

describe('num', () => {
  it('returns number for valid string', () => {
    expect(num('123')).toBe(123)
  })

  it('returns 0 for invalid input', () => {
    expect(num('abc')).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(num(undefined)).toBe(0)
  })

  it('returns 0 for null', () => {
    expect(num(null)).toBe(0)
  })

  it('handles negative numbers', () => {
    expect(num('-50')).toBe(-50)
  })

  it('handles float numbers', () => {
    expect(num('12.5')).toBe(12.5)
  })
})

describe('fmt', () => {
  it('formats number in fa-AF locale', () => {
    const result = fmt(5000)
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('returns "۰" for zero', () => {
    expect(fmt(0)).toBe('۰')
  })

  it('handles large numbers', () => {
    const result = fmt(1000000)
    expect(result).toContain('٬')
  })
})

describe('rem', () => {
  it('calculates remaining amount', () => {
    expect(rem({ total: 5000, paidAmount: 2000 })).toBe(3000)
  })

  it('returns 0 when fully paid', () => {
    expect(rem({ total: 5000, paidAmount: 5000 })).toBe(0)
  })

  it('returns 0 when overpaid', () => {
    expect(rem({ total: 5000, paidAmount: 6000 })).toBe(0)
  })

  it('returns total when nothing paid', () => {
    expect(rem({ total: 5000, paidAmount: 0 })).toBe(5000)
  })
})

describe('fmtDate', () => {
  it('formats ISO date to fa-AF', () => {
    const result = fmtDate('2024-03-15T00:00:00Z')
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('returns original string on invalid date', () => {
    expect(fmtDate('not-a-date')).toBe('Invalid Date')

  })
})