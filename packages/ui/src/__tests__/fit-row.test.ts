// Owner request (8 Nov 2026): no tab bar or switch row needs a sideways
// scroll, in any URL or language — it steps down until it fits.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIT_LEVELS, fitRow } from '../lib/fit-row'

const levelOf = (row: HTMLElement) =>
  FIT_LEVELS.findIndex(
    (level) =>
      (level['--fit-icon'] ?? '') === row.style.getPropertyValue('--fit-icon') &&
      (level['--fit-px'] ?? '') === row.style.getPropertyValue('--fit-px') &&
      (level['--fit-font'] ?? '') === row.style.getPropertyValue('--fit-font'),
  )

describe('fitRow', () => {
  it('a row that fits is left exactly as it was', () => {
    const row = document.createElement('div')
    Object.defineProperty(row, 'clientWidth', { get: () => 400 })
    Object.defineProperty(row, 'scrollWidth', { get: () => 300 })
    expect(fitRow(row)).toBe(0)
    expect(row.style.getPropertyValue('--fit-icon')).toBe('')
  })

  it('steps down — icons first, then padding, then type — until it fits', () => {
    const row = document.createElement('div')
    Object.defineProperty(row, 'clientWidth', { get: () => 300 })
    const widthAt = [420, 380, 340, 300, 260, 230]
    Object.defineProperty(row, 'scrollWidth', { get: () => widthAt[levelOf(row)] ?? 999 })
    expect(fitRow(row)).toBe(3)
    expect(row.style.getPropertyValue('--fit-icon')).toBe('none')
    expect(row.dataset.fit).toBe('3')
  })

  it('both rows use it, and neither may wrap', () => {
    for (const file of ['hub-tabs.tsx', 'segmented-control.tsx']) {
      const source = readFileSync(join(__dirname, '..', 'components', 'ui', file), 'utf8')
      expect(source).toContain('useFitRow(')
      expect(source).toContain('var(--fit-font,')
      expect(source).toContain('whitespace-nowrap')
      expect(source).not.toContain('flex-wrap')
    }
  })
})
