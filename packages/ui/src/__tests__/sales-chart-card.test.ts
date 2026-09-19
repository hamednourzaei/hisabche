// ============================================
// The dashboard chart in the «balance chart card» layout (dashboardcn, MIT),
// adopted on the owner's instruction with this product's own tokens.
//
// What the layout adds — a reference line, a marked peak, and a row of
// high/low/average — are all CLAIMS about the data, so each one is guarded
// against the ways it could quietly lie.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const DASH = join(__dirname, '..', 'components', 'ui', 'dashboard')
const internal = code(join(DASH, 'sales-chart-internal.tsx'))
const card = code(join(DASH, 'sales-chart.tsx'))

describe('the reference line and the peak', () => {
  it('draws both', () => {
    expect(internal).toContain('<ReferenceLine')
    expect(internal).toContain('<ReferenceDot')
  })

  it('⚠️ the reference line says it is the average', () => {
    // An unlabelled horizontal line reads as a target or a budget. It is the
    // mean of the drawn window and must name itself.
    expect(internal).toContain('y={average}')
    expect(internal).toContain('${chartConfig.value.label}: ${fmt(Math.round(average))}')
  })

  it('⚠️ no line and no dot when there is nothing to measure', () => {
    // A reference line at zero reads as «your average is zero» — a claim
    // about the business made out of an empty array.
    expect(internal).toContain('if (chartData.length === 0) return { average: null, peak: null }')
    expect(internal).toContain('average !== null &&')
    expect(internal).toContain('peak &&')
  })

  it('⚠️ a flat line of zeros has no peak worth marking', () => {
    expect(internal).toContain('(Number(highest.value) || 0) > 0 ? highest : null')
  })

  it('⚠️ the peak is taken from the AGGREGATED series', () => {
    // Long ranges are downsampled; marking the raw maximum would put the dot
    // where no drawn point sits.
    const peakRegion = internal.slice(
      internal.indexOf('const { average, peak }'),
      internal.indexOf('return ('),
    )
    expect(peakRegion).toContain('chartData')
    expect(peakRegion).not.toMatch(/\bdata\b\s*\./)
  })
})

describe('the supporting stats row', () => {
  it('shows high, low and average of the window', () => {
    expect(card).toContain('high: Math.max(...points)')
    expect(card).toContain('low: Math.min(...points)')
    expect(card).toContain('average: Math.round(total / points.length)')
  })

  it('⚠️ renders nothing rather than zeroes on an empty window', () => {
    expect(card).toContain('if (points.length === 0) return null')
    expect(card).toContain('{stats && (')
  })

  it('⚠️ each label says «in this range»', () => {
    // A bare «بیشترین» beside a headline invites the reader to take it for an
    // all-time record.
    expect(card).toContain('dashboard.chartHigh')
    expect(card).toContain('dashboard.chartLow')
    expect(card).toContain('dashboard.chartAverage')
  })
})

describe('colours come from the product’s tokens', () => {
  it('⚠️ no hex and no Tailwind palette colour anywhere in the chart', () => {
    // The block was adopted for its layout, not its palette.
    for (const src of [internal, card]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(src).not.toMatch(
        /\b(?:bg|text|stroke|fill)-(?:slate|gray|zinc|blue|emerald|indigo|violet|rose)-\d{2,3}\b/,
      )
    }
    expect(internal).toContain('hsl(var(--color-primary))')
  })
})

describe('every string exists in all three locales', () => {
  for (const locale of ['fa', 'af', 'en']) {
    it(`${locale}`, () => {
      const bundle = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'i18n', 'messages', locale, 'common.json'),
          'utf8',
        ),
      ) as { dashboard: Record<string, unknown> }

      for (const key of ['chartHigh', 'chartLow', 'chartAverage']) {
        expect(bundle.dashboard[key], `${locale}.dashboard.${key}`).toBeTruthy()
      }
    })
  }
})
