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

  it('each stage is sized as its share of the first stage', () => {
    expect(funnel).toContain('(count / firstCount) * 100')
  })

  it('a stage with no share still renders a visible tile', () => {
    // The bar is clamped to 2% so a zero stage is still a row the reader can
    // see and hover, rather than a tile that looks like it failed to render.
    expect(funnel).toContain('Math.max(2, Math.min(100, stage.percent))')
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

describe('the funnel card layout', () => {
  // The «funnel chart card» presentation (dashboardcn, MIT), adopted on the
  // owner's instruction. The taper this replaced is gone; what must NOT change
  // with it is what the shape is allowed to claim.

  it('⚠️ the money row is not a stage, and gets no bar and no percentage', () => {
    // Afghanis have no width that means anything beside counts — true of a
    // trapezoid and equally true of a bar.
    expect(funnel).not.toContain('share(total)')
    expect(funnel).not.toContain('share(shownTotal)')
    // The outcome row renders the money directly, outside the stage list.
    expect(funnel).toContain("t('dashboard.totalSales', 'فروش کل')")
    expect(funnel).toContain('fmt(shownTotal)')
    // Whatever the stages are built from, money is not one of them.
    const stagesRegion = funnel.slice(
      funnel.indexOf('const stages = bands.map('),
      funnel.indexOf('const focused ='),
    )
    expect(stagesRegion).not.toContain('shownTotal')
  })

  it('⚠️ each tile is sized as its share of the first stage', () => {
    expect(funnel).toContain('(count / firstCount) * 100')
    expect(funnel).toContain('percent: share(band.count)')
  })

  it('⚠️ a percentage is shown only when there is a base to divide by', () => {
    // 0/0 is not 100%. With no first stage the tile shows «—».
    expect(funnel).toContain("firstCount > 0 ? `${Math.round(stage.percent)}%` : '—'")
  })

  it('⚠️ colour is the trend when there is one, never a decorative gradient', () => {
    expect(funnel).toContain('TREND_TONE[stage.trend]')
    expect(funnel).not.toMatch(/bg-gradient-to|from-\[|to-\[/)
  })

  it('a stage with no trend is a neutral brand fade, not green', () => {
    expect(funnel).toContain("stage.trend === 'unknown'")
    expect(funnel).toContain('FADE_TONE[stage.fade]')
  })

  it('⚠️ totals cover EVERY chart point, not only the two comparison windows', () => {
    // A single point (all sales on one day) or an odd-length range used to
    // drop out of the counts, and the funnel read «فاکتورها 0 · مشتریان 0».
    expect(funnel).toContain('count: invoicesAll')
    expect(funnel).toContain('count: customersAll')
    expect(funnel).toContain('sum(points, (p) => p.invoiceCount ?? 0)')
    expect(funnel).not.toContain('count: invoicesNow + invoicesBefore')
  })

  it('the headline says what it is the number of', () => {
    // It follows the hovered tile, so a changing big number without its own
    // changing label would be a number of nothing in particular.
    expect(funnel).toContain('focused ? focused.label :')
    expect(funnel).toContain('focused ? focused.count.toLocaleString')
  })

  it('⚠️ the bar is laid out with logical properties, not left/right', () => {
    // RTL: a bar pinned to `left` grows away from the label in Persian.
    expect(funnel).toContain('inset-y-0 start-0')
    expect(funnel).not.toMatch(/\binset-y-0 left-0\b/)
  })

  it('hovering is reachable from the keyboard too', () => {
    // The tiles are buttons, so the headline follows focus as well as the
    // pointer — otherwise the interaction exists only for a mouse.
    expect(funnel).toContain('onFocus={() => setHovered(stage.key)}')
    expect(funnel).toContain('onBlur={() => setHovered(null)}')
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
