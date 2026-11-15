// ============================================
// The day a document is posted on is the business's day, not the UTC day.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { documentDayOf } from '../utils/local-day'

describe('documentDayOf', () => {
  it('keeps a calendar day as written', () => {
    expect(documentDayOf('2026-11-15', 'Asia/Kabul')).toBe('2026-11-15')
    expect(documentDayOf('2026-11-15T00:00:00.000Z', 'Asia/Kabul')).toBe('2026-11-15')
  })

  it('reads an instant in the business zone — local midnight in Kabul is still that day', () => {
    // What the old invoice builder sent for «15 November» in Kabul.
    expect(documentDayOf('2026-11-14T19:30:00.000Z', 'Asia/Kabul')).toBe('2026-11-15')
    // 01:00 in Kabul on the 15th.
    expect(documentDayOf('2026-11-14T20:30:00.000Z', 'Asia/Kabul')).toBe('2026-11-15')
    // 01:00 in Tehran on the 15th.
    expect(documentDayOf('2026-11-14T21:30:00.000Z', 'Asia/Tehran')).toBe('2026-11-15')
  })

  it('no date is today in the business zone', () => {
    expect(documentDayOf(null, 'Asia/Kabul')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('the invoice service posts by documentDayOf, never by the UTC slice', () => {
    const source = readFileSync(join(__dirname, '..', 'services', 'invoice.service.ts'), 'utf8')
    expect(source).not.toMatch(/date\??\.slice\(0, 10\) : businessDayOf/)
    expect(source).not.toContain('new Date().toISOString()).slice(0, 10)')
    expect(source.split('documentDayOf(').length - 1).toBeGreaterThanOrEqual(5)
  })
})
