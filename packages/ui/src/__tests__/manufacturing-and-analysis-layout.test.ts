// ============================================
// /manufacturing and /analysis — two tabs on top and ONE switch under them,
// the way /customers is laid out (owner's request, 5 Oct 2026).
//
// What can go wrong: the row of four (or seven) tabs coming back; a part left
// out of every group (unreachable); a hand-drawn tab bar or switch; a list
// drawn by hand again; «تکمیل» becoming a status flip; «before» losing its tabs
// on /analysis.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  MANUFACTURING_GROUPS,
  WORK_ORDER_STATUSES,
  manufacturingGroupOf,
} from '../components/ui/manufacturing/manufacturing-view'
import { ANALYSIS_GROUPS, analysisGroupOf } from '../components/ui/analysis/analysis-container'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

describe('/manufacturing', () => {
  const view = ui('manufacturing', 'manufacturing-view.tsx')

  it('four parts in two groups — every part reachable', () => {
    expect(MANUFACTURING_GROUPS).toEqual({
      make: ['boms', 'workOrders'],
      records: ['history', 'report'],
    })
    expect(manufacturingGroupOf('workOrders')).toBe('make')
    expect(manufacturingGroupOf('report')).toBe('records')
  })

  it('the shared tab bar on top, ONE shared switch under it — no hand-drawn row', () => {
    expect(view.split('<HubTabs').length - 1).toBe(1)
    expect(view.split('<SegmentedControl').length - 1).toBe(1)
    expect(view).not.toContain('role="tablist"')
    expect(view).toContain('onSelect={(next) => onTabChange(MANUFACTURING_GROUPS[next][0])}')
  })

  it('formulas and work orders are the shared table, each with a status filter', () => {
    expect(view).toContain('tableId="manufacturing-boms"')
    expect(view).toContain('tableId="manufacturing-work-orders"')
    expect(view.split('<TableFilterSelect').length - 1).toBe(2)
    expect(view).not.toContain('<table')
    expect([...WORK_ORDER_STATUSES]).toEqual(['planned', 'in_progress', 'completed', 'cancelled'])
  })

  it('only the active formula is editable, and a finished order has no «تکمیل»', () => {
    expect(view).toContain('bom.isActive && bom.product ? (')
    expect(view).toContain("workOrder.status !== 'completed' &&")
    expect(view).toContain('onClick={() => onCompleteWorkOrder(workOrder)}')
  })
})

describe('/analysis', () => {
  const page = ui('analysis', 'analysis-container.tsx')

  it('seven parts in three groups — every part reachable', () => {
    const parts = Object.values(ANALYSIS_GROUPS).flat()
    expect([...parts].sort()).toEqual(
      [
        'collections',
        'suppliers',
        'breakEven',
        'cohorts',
        'workingCapital',
        'benchmark',
        'reports',
      ].sort(),
    )
    expect(analysisGroupOf('cohorts')).toBe('market')
    expect(analysisGroupOf('reports')).toBe('reports')
    expect(analysisGroupOf('nonsense')).toBe('money')
  })

  it('collections, suppliers and break-even are the shared table', () => {
    for (const id of ['analysis-collections', 'analysis-suppliers', 'analysis-break-even']) {
      expect(page, id).toContain(`tableId="${id}"`)
    }
    // The shared searchable table, three times — no wrapper of the page's own.
    expect(page.split('<SearchableTable').length - 1).toBe(3)
    expect(page).not.toContain('function AnalysisTable')
    // A collection row still opens its invoice.
    expect(page).toContain('onRowClick={(action) => push(`/invoices/${action.invoiceId}`)}')
  })

  it('a break-even that cannot be reached says why — never zero', () => {
    expect(page).toContain('row.breakEvenQuantity !== null ? (')
    expect(page).toContain('analysis.breakEven.reasons.${row.breakEvenReason}')
  })

  it('every label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      for (const group of Object.keys(ANALYSIS_GROUPS)) {
        expect(all.analysis.groups[group], `${lang} analysis.${group}`).toEqual(expect.any(String))
      }
      for (const group of Object.keys(MANUFACTURING_GROUPS)) {
        expect(all.manufacturing.groups[group], `${lang} manufacturing.${group}`).toEqual(
          expect.any(String),
        )
      }
      for (const key of ['groupsLabel', 'partsLabel', 'noMatch']) {
        expect(all.analysis[key], `${lang} analysis.${key}`).toEqual(expect.any(String))
        expect(all.manufacturing[key], `${lang} manufacturing.${key}`).toEqual(expect.any(String))
      }
    }
  })
})
