// ============================================
// Accounting report tabs default to the LOCAL calendar day.
//
// `new Date(y, m, 1).toISOString().slice(0, 10)` is local midnight rendered in
// UTC: in Kabul (+4:30) the 1st becomes the previous month's last day, and
// "today" before 04:30 becomes yesterday. The tabs must use toIsoDay(), which
// reads getFullYear/getMonth/getDate.
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

const TABS = ['IncomeStatementTab.tsx', 'BalanceSheetTab.tsx', 'TrialBalanceTab.tsx']

describe('accounting tabs use the local calendar day', () => {
  for (const file of TABS) {
    it(`${file} never derives a day from toISOString()`, () => {
      const src = code(join(__dirname, '..', 'components', 'ui', 'accounting', 'tabs', file))
      expect(src).not.toContain('toISOString')
      expect(src).toContain('toIsoDay(')
    })
  }
})
