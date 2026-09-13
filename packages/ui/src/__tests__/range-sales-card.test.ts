// ============================================
// The second KPI card follows the chart's date range.
//
// It was pinned to «today» while the chart beside it showed whatever range was
// picked, so the two disagreed as soon as the range changed. It now shows the
// total for the selected range, names that range in its label, and compares
// against the equally long period immediately BEFORE it — a period that is
// actually fetched, never half of the current one and never invented.
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

const UI = join(__dirname, '..')
const view = code(join(UI, 'components', 'ui', 'dashboard', 'dashboard-view.tsx'))
const data = code(join(UI, 'hooks', 'dashboard', 'use-dashboard-data.ts'))

describe('the range card', () => {
  it('⚠️ shows the range total, not today', () => {
    expect(view).toContain('value={fmt(rangeSalesTotal ?? 0)}')
    expect(view).not.toContain('value={fmt(todaySales)}')
  })

  it('names the selected range in its label', () => {
    expect(view).toContain('label={rangeLabel}')
    expect(view).toContain('fmtIntlDate(dateRange?.from ?? null)')
  })

  it('⚠️ compares against a real previous period of the same length', () => {
    expect(data).toContain('from: shiftDay(fromDate, -rangeDays)')
    expect(data).toContain('to: shiftDay(fromDate, -1)')
  })

  it('⚠️ shows no percentage without a comparable figure', () => {
    // A delta with no fetched basis, or «growth» from zero, is not shown.
    expect(view).toContain(
      'if (rangeSalesTotal === null || previousRangeSalesTotal === null) return null',
    )
    expect(view).toContain('if (previousRangeSalesTotal <= 0) return null')
  })

  it('unknown totals are null, never 0', () => {
    expect(data).toContain("typeof salesData?.total === 'number' ? salesData.total : null")
  })

  it('the chart receives the same range figures', () => {
    expect(view).toContain('currentPeriodTotal={rangeSalesTotal ?? 0}')
  })
})

describe('strings exist in every locale', () => {
  for (const locale of ['fa', 'af', 'en']) {
    it(locale, () => {
      const bundle = JSON.parse(
        readFileSync(join(UI, '..', '..', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
      ) as { dashboard: Record<string, string> }
      for (const key of ['todaySales', 'vsYesterday', 'rangeSales', 'vsPrevious', 'daysBefore']) {
        expect(bundle.dashboard[key], `${locale}.dashboard.${key}`).toBeTruthy()
      }
    })
  }
})
