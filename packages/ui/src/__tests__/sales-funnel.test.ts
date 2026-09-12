// ============================================
// The funnel is the chart's own data, and its colours are earned.
//
// ---------------------------------------------------------------------------
// ⚠️ THE FIRST VERSION ANSWERED THE WRONG QUESTION
//
// It fetched a CRM pipeline from `/api/crm/funnel` — «what stage are my
// opportunities in» — when the request was to show the CHART's numbers as a
// funnel. It also cost the dashboard a separate request, measured at 1525ms
// in the production log, for data the page already held in memory: every
// point of `salesChartData` carries `value`, `invoiceCount` and
// `customerCount`.
//
// ⚠️ AND THE SHAPE MUST NOT CLAIM A CONVERSION THAT DOES NOT EXIST
//
// Invoices and customers are counts; total sales is money. «38 invoices» is
// not a subset of «24 customers». Only the two counts are drawn as
// proportional bands; revenue is the outcome beneath them.
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
const funnel = code(join(DASH, 'sales-funnel.tsx'))
const view = code(join(DASH, 'dashboard-view.tsx'))

describe('it reuses the chart data', () => {
  it('⚠️ makes no request of its own', () => {
    expect(funnel).not.toMatch(/useQuery|apiClient|useSalesFunnel/)
    expect(view).not.toMatch(/useSalesFunnel/)
  })

  it('is fed the same array the chart is', () => {
    expect(view).toMatch(/<SalesFunnel[\s\S]{0,200}data=\{salesChartData\}/)
    expect(view).toMatch(/<LazySalesChart[\s\S]{0,200}data=\{salesChartData\}/)
  })

  it('⚠️ guards the array at runtime', () => {
    // A type annotation is not a runtime check — this shape has taken down
    // two production screens in this codebase.
    expect(funnel).toMatch(/Array\.isArray\(data\) \? data : \[\]/)
  })
})

describe('the shape only claims what is true', () => {
  it('⚠️ money is not a band', () => {
    // A band whose width came from afghanis, beside bands whose width came
    // from counts, is a picture of nothing.
    // Only the array literal, not the union in the `Band` type above it.
    const arrayRegion = funnel.slice(
      funnel.indexOf('const nextBands: Band[]'),
      funnel.indexOf('return {', funnel.indexOf('const nextBands: Band[]')),
    )
    const bandKeys = arrayRegion.match(/key: '(invoices|customers|revenue|sales)'/g) ?? []
    expect(bandKeys).toEqual(["key: 'invoices'", "key: 'customers'"])
  })

  it('band widths are proportional to the widest count', () => {
    expect(funnel).toMatch(/band\.count \/ widest/)
  })

  it('a shop with one data point is still readable', () => {
    expect(funnel).toMatch(/MIN_WIDTH_PERCENT/)
  })
})

describe('green and red are earned, not default', () => {
  it('⚠️ no earlier half means no colour', () => {
    // A green band by default tells someone their business is growing on the
    // strength of no evidence.
    expect(funnel).toMatch(/const comparable = earlier\.length > 0/)
    expect(funnel).toMatch(/comparable \? compare\(/)
  })

  it('⚠️ an unknown trend renders nothing at all', () => {
    // A grey dash where a trend belongs reads as «no change», which is a
    // measurement. Absent is the honest rendering of an unanswerable question.
    expect(funnel).toMatch(/if \(trend === 'unknown'\) return null/)
    expect(funnel).toMatch(/unknown: 'bg-\[hsl\(var\(--surface-muted\)\)\]'/)
  })

  it('⚠️ growth from zero has a direction but no percentage', () => {
    // «∞%» is not a number anyone can act on.
    expect(funnel).toMatch(/if \(previous === 0\)/)
    expect(funnel).toMatch(/return \{ trend: 'up', changePercent: null \}/)
  })

  it('flat is distinguished from unknown', () => {
    expect(funnel).toMatch(/trend: 'flat', changePercent: 0/)
  })

  it('⚠️ «more is better» is stated per metric, not inferred from the sign', () => {
    // Customer debt and expenses invert. The map must be explicit so a future
    // band for either cannot silently inherit the wrong direction.
    expect(funnel).toMatch(/const TREND_TONE: Record<Trend, string>/)
    expect(funnel).toMatch(/up: 'bg-\[hsl\(var\(--color-success\)/)
    expect(funnel).toMatch(/down: 'bg-\[hsl\(var\(--color-destructive\)/)
  })

  it('⚠️ the two windows are the same length', () => {
    // Splitting down the middle compared 4 days against 3 on a 7-day range
    // and still captioned it «vs the previous days» — a 33% head start handed
    // to the recent half and reported as growth. Both windows are now N long,
    // taken from the end; a leftover oldest point is excluded from the
    // COMPARISON while still counting toward the totals shown.
    // `toContain`, not `toMatch`: these strings are dense with regex
    // metacharacters (`?`, `*`, `(`, `[`) and escaping them by hand is how a
    // guard silently becomes an invalid pattern that never runs.
    expect(funnel).toContain('const recent = split > 0 ? points.slice(-split) : []')
    expect(funnel).toContain('const earlier = split > 0 ? points.slice(-2 * split, -split) : []')
  })

  it('⚠️ the comparison states the window it used', () => {
    // A coloured band with no caption is a claim with no stated basis: the
    // reader cannot tell whether green means «better than yesterday» or
    // «better than last quarter».
    expect(funnel).toContain('windowDays > 0 ?')
    expect(funnel).toContain('dashboard.funnel.comparedTo')
    expect(funnel).toContain('dashboard.funnel.daysBefore')
  })
})

describe('the cone', () => {
  it('⚠️ the taper is the real drop-off, not a fixed angle', () => {
    // A constant slope makes 10 → 9 lean in exactly as hard as 1000 → 90. The
    // bottom edge of each band is the next band's width, so the slope IS the
    // ratio between the two stages.
    expect(funnel).toContain(
      'const taper = width > 0 ? Math.max(0, (width - nextWidth) / width / 2) : 0',
    )
  })

  it('the last band has no successor, and so no taper', () => {
    expect(funnel).toContain(': width')
  })

  it('the shape is drawn with clip-path in a style object, not a Tailwind class', () => {
    // `polygon()` contains commas; in an inline style that is plain CSS and
    // the arbitrary-value rules do not apply.
    expect(funnel).toContain('clipPath: `polygon(')
  })

  it('each band has a labelled pill with its own icon', () => {
    expect(funnel).toContain('const BAND_ICON')
    expect(funnel).toContain('dashboard.funnel.band.')
  })

  it('⚠️ the band colour is the trend, not a decorative gradient', () => {
    // The reference mock used a fixed teal→gold ramp. That would discard the
    // one thing the colour was asked to carry: whether each stage improved.
    expect(funnel).toContain('TREND_TONE[band.trend]')
    expect(funnel).not.toMatch(/bg-gradient-to|from-\[|to-\[/)
  })
})

describe('the states it can be in', () => {
  it('⚠️ an error is not an empty period', () => {
    expect(funnel).toMatch(/dashboard\.funnel\.error/)
    expect(funnel).toMatch(/dashboard\.noSalesInPeriod/)
  })

  it('the empty state speaks about the window, not all history', () => {
    // The same correction the chart's own empty state already carries.
    expect(funnel).not.toMatch(/noSalesYet|startSelling/)
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
      ) as { dashboard: Record<string, any> }

      const f = bundle.dashboard.funnel
      expect(f, `${locale}.dashboard.funnel`).toBeTruthy()
      for (const key of ['aria', 'title', 'error']) {
        expect(f?.[key], `${locale}.funnel.${key}`).toBeTruthy()
      }
      for (const band of ['invoices', 'customers']) {
        expect(f?.band?.[band], `${locale}.funnel.band.${band}`).toBeTruthy()
      }
      expect(bundle.dashboard.viewSwitch, `${locale}.viewSwitch`).toBeTruthy()
      expect(bundle.dashboard.totalSales, `${locale}.totalSales`).toBeTruthy()
    })
  }
})
