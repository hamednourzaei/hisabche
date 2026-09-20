// ============================================
// The mobile bar's active indicator, and the cost of a click.
//
// ⚠️ `start-*` IS LOGICAL, `translate-x-*` IS PHYSICAL.
//
// `start-1/2` resolves to `right: 50%` in Persian, while `-translate-x-1/2`
// always moves LEFT. In RTL the two pull in opposite directions and the bar
// lands half its own width off — over the neighbouring tab. That is what the
// owner reported: «نوار بالای هر آیتم درست بالای همون بخش نیست».
//
// A full-width row that centres its child needs no transform, so there is
// nothing left to disagree about in either direction.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')

const sidebar = code(
  readFileSync(join(__dirname, '..', 'components', 'ui', 'dashboard-sidebar.tsx'), 'utf8'),
)

describe('the active indicator', () => {
  const nav = sidebar.slice(sidebar.indexOf('export const BottomNav'))

  it('⚠️ never mixes a logical inset with a physical transform', () => {
    expect(nav).not.toMatch(/start-1\/2[^\n]*-translate-x-1\/2/)
    expect(nav).not.toMatch(/-translate-x-1\/2[^\n]*start-1\/2/)
  })

  it('centres with the layout instead', () => {
    expect(nav).toContain('absolute inset-x-0 flex justify-center')
    expect(nav).toContain('bg-[image:var(--gradient-brand)]')
  })

  it('is hidden from screen readers — it repeats `aria-current`', () => {
    const indicator = nav.slice(nav.indexOf('absolute inset-x-0 flex justify-center') - 200)
    expect(indicator.slice(0, 300)).toContain('aria-hidden="true"')
    expect(nav).toContain("aria-current={isActive ? 'page' : undefined}")
  })

  it('respects a reduced-motion preference', () => {
    const indicator = nav.slice(nav.indexOf('absolute inset-x-0 flex justify-center'))
    expect(indicator.slice(0, 500)).toContain('motion-reduce:transition-none')
  })
})
