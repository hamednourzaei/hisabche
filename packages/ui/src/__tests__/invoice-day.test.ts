// ============================================
// A document date is a calendar day, sent as that day at UTC midnight.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dayToDocumentDate, documentDateToDay, todayDocumentDate } from '../lib/invoice-day'

describe('invoice day', () => {
  it('a picked day travels as that day at UTC midnight, and comes back as the same day', () => {
    expect(dayToDocumentDate('2026-11-15')).toBe('2026-11-15T00:00:00.000Z')
    expect(documentDateToDay('2026-11-15T00:00:00.000Z')).toBe('2026-11-15')
    expect(documentDateToDay(dayToDocumentDate('2026-03-21'))).toBe('2026-03-21')
  })

  it("today is this device's calendar day", () => {
    expect(todayDocumentDate()).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/)
  })

  it('both builders and the draft use it — no local-midnight instant is sent any more', () => {
    for (const parts of [
      ['components', 'ui', 'invoice-builder', 'customer-panel.tsx'],
      ['components', 'ui', 'invoice-builder', 'mobile', 'invoice-builder-mobile.tsx'],
    ]) {
      const source = readFileSync(join(__dirname, '..', ...parts), 'utf8')
      expect(source).toContain('dayToDocumentDate(value)')
      expect(source).not.toContain('T00:00:00`)')
    }
    const draft = readFileSync(
      join(__dirname, '..', '..', '..', 'store', 'src', 'slices', 'invoice-draft.slice.ts'),
      'utf8',
    )
    expect(draft).not.toContain('date: new Date().toISOString()')
  })
})
