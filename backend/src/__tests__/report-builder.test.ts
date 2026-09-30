// ============================================
// Engine N9 (reporting side) — report and dashboard builders.
// Capabilities #145, #146.
//
// ⚠️ A REPORT PICKS A DATASET AND A MEASURE. IT NEVER DEFINES EITHER.
//
// `TASK-close-the-gap.md` says it: «موتور کوئری جدید نساز» and «سازنده‌ی
// گزارش روی همان ListQuery». The codebase's own history is the removal of
// exactly the thing a free-form builder would reintroduce — `insights` once
// recomputed profit and the two disagreed, and `profit-report.test.ts` exists
// because of it.
//
// So the tests below are about what a builder CANNOT do. Two of them matter
// most:
//
//   * A NON-ADDITIVE MEASURE DOWN A TIMELINE IS REFUSED. Summing OUTSTANDING by
//     month produces a growing number for a shop collecting perfectly well —
//     the single most common way a self-built report lies, and one no error
//     ever reports.
//   * A SAVED REPORT REMEMBERS WHERE ITS NUMBERS CAME FROM. A report that
//     does not will be read next year by someone assuming the margin was
//     computed in the report, and that assumption is how two dashboards start
//     disagreeing.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MIN_ROW_CAP,
  allMeasures,
  datasets,
  saveReport,
  validateDashboard,
  validateReport,
  type ReportDefinition,
} from '../services/reporting/dataset.domain'

const report = (over: Partial<ReportDefinition> = {}): ReportDefinition => ({
  key: 'r-1',
  name: 'Sales by month',
  dataset: 'invoices',
  groupBy: ['month'],
  measures: ['net_revenue', 'count'],
  maxRows: 500,
  ...over,
})

describe('#145 — a builder picks from a closed list', () => {
  it('a straightforward report is valid', () => {
    expect(validateReport(report())).toEqual([])
  })

  it('an unknown dataset is refused', () => {
    expect(validateReport(report({ dataset: 'cheque_accounts' as never }))).toContain(
      'UNKNOWN_DATASET',
    )
  })

  it('an unknown measure is refused', () => {
    expect(validateReport(report({ measures: ['made_up'] }))).toContain('UNKNOWN_MEASURE')
  })

  it('a dimension the dataset cannot group by is refused', () => {
    // ⚠️ `supplier` on invoices would need a join the invoice rows do not have,
    // and a builder that silently added it would produce a column whose meaning
    // depends on which join it picked.
    expect(validateReport(report({ groupBy: ['supplier'] }))).toContain('UNKNOWN_DIMENSION')
  })

  it('no measures is a report with no figures in it', () => {
    expect(validateReport(report({ measures: [] }))).toContain('NO_MEASURES')
  })

  it('a duplicate measure is refused', () => {
    expect(validateReport(report({ measures: ['count', 'count'] }))).toContain('DUPLICATE_MEASURE')
  })

  it('ordering by something that is not in the report is refused', () => {
    expect(
      validateReport(report({ orderBy: { key: 'gross_margin', direction: 'asc' } })),
    ).toContain('ORDER_BY_UNKNOWN')
  })

  it('too many dimensions is a data dump, not a report', () => {
    expect(
      validateReport(report({ groupBy: ['month', 'customer', 'product', 'status'] })),
    ).toContain('TOO_MANY_DIMENSIONS')
  })
})

describe('#145 — a NON-ADDITIVE measure cannot be summed down a timeline', () => {
  it('outstanding by month is refused', () => {
    // ⚠️ THE failure this file exists for. Outstanding FALLS as money arrives, so
    // adding it up month by month produces a growing number for a shop that is
    // collecting perfectly well — and every total looks like a real figure.
    expect(validateReport(report({ measures: ['outstanding'] }))).toContain('NON_ADDITIVE_IN_TIME')
  })

  it('a margin by month is refused for the same reason', () => {
    // ⚠️ A 40% margin on two halves is a weighted average, not 80%. Summing it
    // shows a shop a margin it does not have.
    expect(validateReport(report({ measures: ['gross_margin'] }))).toContain('NON_ADDITIVE_IN_TIME')
  })

  it('the same measure by CUSTOMER is fine, because a customer is not a period', () => {
    // ⚠️ Not by time, so not summing a period. This is the distinction the check
    // is actually making, and it has to hold in both directions or a builder
    // either refuses good reports or permits the lying kind.
    expect(validateReport(report({ groupBy: ['customer'], measures: ['outstanding'] }))).toEqual([])
  })

  it('with no grouping, a balance is simply the balance', () => {
    expect(validateReport(report({ groupBy: null, measures: ['outstanding'] }))).toEqual([])
  })

  it('an additive measure down a timeline is fine', () => {
    expect(validateReport(report({ measures: ['net_revenue', 'count'] }))).toEqual([])
  })
})

describe('#145 — every measure names where its number came from', () => {
  it('no measure is a bare aggregate', () => {
    for (const definition of allMeasures()) {
      expect(definition.source, definition.key).toContain(':')
    }
  })

  it('the money measures all come from the engines that own them', () => {
    const byKey = new Map(allMeasures().map((m) => [m.key, m]))

    expect(byKey.get('net_revenue')?.source).toContain('buildProfitReport')
    expect(byKey.get('outstanding')?.source).toContain('payments:')
    expect(byKey.get('stock_value')?.source).toContain('CostingService')
  })

  it('the balances are marked non-additive, because they are', () => {
    const byKey = new Map(allMeasures().map((m) => [m.key, m]))

    expect(byKey.get('outstanding')?.additive).toBe(false)
    expect(byKey.get('gross_margin')?.additive).toBe(false)
    expect(byKey.get('net_revenue')?.additive).toBe(true)
  })

  it('a saved report carries its sources with it', () => {
    // ⚠️ A report that does not remember this will be read next year by someone
    // who assumes the margin was computed in the report — and that assumption
    // is how two dashboards start disagreeing.
    const saved = saveReport(report({ measures: ['net_revenue', 'outstanding'] }), '2026-09-30')

    expect(saved.sources.some((s) => s.includes('buildProfitReport'))).toBe(true)
    expect(saved.sources.some((s) => s.includes('payments:'))).toBe(true)
  })

  it('a saved report carries no source for a measure it does not have', () => {
    const saved = saveReport(report({ measures: ['count'] }), '2026-09-30')

    expect(saved.sources).not.toContain(undefined)
    expect(saved.sources.length).toBeGreaterThan(0)
  })
})

describe('#145 — a cap under fifty makes every report wrong', () => {
  it('a cap of ten is refused', () => {
    // ⚠️ A ten-row report with a cap of ten LOOKS complete and is not, and
    // §7٫4 is exactly about a number that is quietly a page.
    expect(validateReport(report({ maxRows: 10 }))).toContain('ROW_CAP_TOO_LOW')
    expect(MIN_ROW_CAP).toBe(50)
  })

  it('a cap at the floor is fine', () => {
    expect(validateReport(report({ maxRows: MIN_ROW_CAP }))).toEqual([])
  })
})

describe('#146 — a dashboard is a list of saved reports', () => {
  const savedReports = [
    saveReport(report({ key: 'sales', name: 'Sales' }), '2026-09-30'),
    saveReport(report({ key: 'costs', name: 'Costs' }), '2026-09-30'),
  ]

  it('a dashboard of saved reports is valid', () => {
    const dashboard = {
      key: 'd-1',
      name: 'Overview',
      tiles: [
        { reportKey: 'sales', position: 0, span: 2 as const },
        { reportKey: 'costs', position: 1, span: 1 as const },
      ],
    }

    expect(validateDashboard(dashboard, savedReports)).toEqual([])
  })

  it('a tile naming a report nobody saved is refused', () => {
    const dashboard = {
      key: 'd-1',
      name: 'Overview',
      tiles: [{ reportKey: 'ghost', position: 0, span: 1 as const }],
    }

    expect(validateDashboard(dashboard, savedReports)).toContain('UNKNOWN_REPORT')
  })

  it('the same report twice on a dashboard is refused', () => {
    const dashboard = {
      key: 'd-1',
      name: 'Overview',
      tiles: [
        { reportKey: 'sales', position: 0, span: 1 as const },
        { reportKey: 'sales', position: 1, span: 1 as const },
      ],
    }

    expect(validateDashboard(dashboard, savedReports)).toContain('DUPLICATE_REPORT')
  })

  it('two tiles in one position is refused', () => {
    const dashboard = {
      key: 'd-1',
      name: 'Overview',
      tiles: [
        { reportKey: 'sales', position: 0, span: 1 as const },
        { reportKey: 'costs', position: 0, span: 1 as const },
      ],
    }

    expect(validateDashboard(dashboard, savedReports)).toContain('POSITION_CLASH')
  })

  it('an empty dashboard is refused rather than rendered as a blank page', () => {
    expect(validateDashboard({ key: 'd', name: 'Empty', tiles: [] }, savedReports)).toEqual([
      'EMPTY',
    ])
  })

  it('every dataset lists the dimensions it allows, so a UI need not guess', () => {
    const list = datasets()
    expect(list.invoices).toContain('month')
    expect(list.payments).not.toContain('product')
  })
})
