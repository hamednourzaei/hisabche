// ============================================
// packages/ui/src/__tests__/accounting-drilldown.test.ts
//
// H3 — the drill-down must open the SAME window as the figure that opened it.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A TEST AND NOT A CODE REVIEW NOTE
//
// Three reports drill into the same endpoint, and two of them are «as at a
// date» while one covers a period:
//
//   Trial Balance    — from the chosen start (none by default) to `date` → from = fromDate
//   Balance Sheet    — as at `date`, all time up to it   → from = ''
//   Income Statement — from `from` to `to`               → from = from
//
// Passing the Income Statement's drill-down an empty `from` is a one-character
// mistake that produces a drawer listing lines from before the period — one
// that does not add up to the number clicked, with nothing on screen saying so.
// It renders, it is plausible, and only an accountant checking by hand would
// catch it.
//
// So it is checked mechanically, at the call site, rather than trusted.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const TABS = join(__dirname, '..', 'components', 'ui', 'accounting', 'tabs')

const read = (file: string) => readFileSync(join(TABS, file), 'utf8')

/** The `useAccountDrilldown(...)` call as written in a tab. */
function drilldownCall(source: string): string {
  const match = /useAccountDrilldown\(([^)]*)\)/.exec(source)
  if (!match) throw new Error('no useAccountDrilldown call found')
  return match[1]!.trim()
}

describe('each report drills into its own period', () => {
  it.each([['BalanceSheetTab.tsx', "''", 'date']])(
    '%s is an «as at» report: unbounded start, %s → %s',
    (file, from, to) => {
      // A start date on an «as at» report would show FEWER lines than the figure
      // was built from — the balance is cumulative over all time up to `date`.
      const args = drilldownCall(read(file))
      expect(args.startsWith(from)).toBe(true)
      expect(args).toContain(to)
    },
  )

  it('TrialBalanceTab.tsx drills into the window it asked the server for', () => {
    // The start is the reader's choice now (empty = from the first entry). What
    // matters is that the drawer and the figures use the SAME start and end.
    const source = read('TrialBalanceTab.tsx')
    const args = drilldownCall(source)
    expect(args.startsWith('fromDate')).toBe(true)
    expect(args).toContain('date')
    expect(source).toContain('useTrialBalance(date, branchId, fromDate)')
    // …and it still opens unbounded: the report people know.
    expect(source).toContain("const [fromDate, setFromDate] = useState('')")
  })

  it('IncomeStatementTab.tsx is a PERIOD report: both ends bound', () => {
    // The one that must NOT be unbounded. An income statement covers a window,
    // and a drill-down ignoring `from` lists revenue from before it.
    const args = drilldownCall(read('IncomeStatementTab.tsx'))
    expect(args).toMatch(/^from\s*,/)
    expect(args).toContain('to')
    expect(args.startsWith("''")).toBe(false)
  })
})

describe('every report that shows account figures can drill into them', () => {
  it.each(['TrialBalanceTab.tsx', 'BalanceSheetTab.tsx', 'IncomeStatementTab.tsx'])(
    '%s renders the drawer',
    (file) => {
      // Wiring `open` without rendering `drawer` is silent: clicking an account
      // sets state, fires the query, and shows nothing at all.
      const source = read(file)
      expect(source).toContain('drilldown.open')
      expect(source).toContain('drilldown.drawer')
    },
  )
})
