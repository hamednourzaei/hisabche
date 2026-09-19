// ============================================
// ONE KPI card in the whole product.
//
// The owner's instruction: the «kpi-card» block (dashboardcn, MIT), rebuilt on
// this project's tokens, is the only card any screen draws a figure in.
//
// Before this there were three — `BentoStats`' cells, `capability-kit`'s
// `Stat`, and a `StockStatsCard` nothing imported — plus screens assembling
// the shell by hand out of `stat-surface` strings. They shared a look and
// nothing else, so a delta badge existed on one and not the others.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const UI_ROOT = join(__dirname, '..', 'components', 'ui')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return entry.endsWith('.tsx') ? [full] : []
  })
}

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const files = walk(UI_ROOT).filter((f) => !f.includes('__tests__'))

describe('the card is assembled in exactly one file', () => {
  it('⚠️ no screen builds the KPI shell out of stat-surface strings itself', () => {
    // `STAT_CARD_SURFACE` + `STAT_PADDING` next to `STAT_LABEL` IS the card.
    // Hand-assembling it is how the two visual languages appeared in the first
    // place; `kpi-card.tsx` is the one place allowed to do it.
    const offenders = files.filter((file) => {
      if (file.endsWith('kpi-card.tsx')) return false
      const src = code(readFileSync(file, 'utf8'))
      return src.includes('STAT_CARD_SURFACE') && src.includes('STAT_LABEL')
    })

    expect(offenders.map((f) => f.replace(UI_ROOT, ''))).toEqual([])
  })

  it('the bento row lays cells out but does not re-draw them', () => {
    const bento = code(readFileSync(join(UI_ROOT, 'bento-stats.tsx'), 'utf8'))
    expect(bento).toContain('<KpiCard')
    // Its cells must not paint a border on mobile: the grid already draws one
    // around all four, and a cell border inside it is a border inside a border.
    expect(bento).toContain('surface="desktop"')
    expect(bento).not.toContain('STAT_VALUE')
  })

  it('capability-kit’s Stat is an alias, not a second implementation', () => {
    const kit = code(readFileSync(join(UI_ROOT, 'capability', 'capability-kit.tsx'), 'utf8'))
    expect(kit).toContain('export function Stat(props: KpiCardProps)')
    expect(kit).toContain('<KpiCard {...props} />')
    expect(kit).toContain('export { KpiGrid as StatGrid }')
  })
})

describe('what the card promises about the numbers', () => {
  const kpi = code(readFileSync(join(UI_ROOT, 'kpi-card.tsx'), 'utf8'))

  it('⚠️ never abbreviates — it shrinks the font instead', () => {
    // «۱۲ میلیون» hides the exact figure a bookkeeper is checking.
    expect(kpi).toContain('export function valueFontClass')
    expect(kpi).not.toMatch(/میلیون|\bM\b['"]|toPrecision/)
  })

  it('⚠️ a null delta renders no badge', () => {
    // Zero reads as «measured, no change»; null means there was nothing to
    // compare against, and a green 0% would be a claim out of no evidence.
    expect(kpi).toContain('const hasDelta = delta !== undefined && delta !== null')
    expect(kpi).toContain('{hasDelta && (')
  })

  it('⚠️ «up is good» is stated per metric, never inferred from the sign', () => {
    // Debt and expenses invert.
    expect(kpi).toContain('const isGood = invertDelta ? !isUp : isUp')
  })

  it('digits line up', () => {
    // Without tabular-nums a column of amounts does not align, which is the
    // one thing someone reading a column of money is doing.
    expect(kpi).toContain('tabular-nums')
  })

  it('⚠️ colours are tokens — no hex, no Tailwind palette', () => {
    expect(kpi).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(kpi).not.toMatch(
      /\b(?:bg|text|border)-(?:slate|gray|zinc|blue|emerald|indigo|violet|rose)-\d{2,3}\b/,
    )
    expect(kpi).toContain('hsl(var(--color-success)')
  })
})
