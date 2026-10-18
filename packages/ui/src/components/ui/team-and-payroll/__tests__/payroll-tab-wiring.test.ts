// Request #100 — «حقوق به کارمندهام اضافه کردم اما در قسمت حقوق نمایش داده
// نمی‌شود، و جمع حقوق هم نمایش داده نمی‌شود».
//
// Three independent faults, each of which alone makes the tab look empty:
//   1. `usePayrolls()` was `enabled: authReady && !!employeeId` — the
//      workspace-wide call the tab makes was never allowed to run;
//   2. the container read `.payrolls` and `.total` off a response that is a
//      bare ARRAY, so both were `undefined`;
//   3. the card read `employeeName`/`period`/`amount`, none of which the API
//      sends.
//
// An always-disabled query and an empty table are indistinguishable on screen,
// which is why this went unnoticed — so each fault gets its own assertion.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the payroll query actually runs', () => {
  const hook = code(
    readFileSync(join(__dirname, '../../../../../../api/src/hooks/payroll.ts'), 'utf8'),
  )

  it('is not gated on an employee id', () => {
    const list = hook.slice(
      hook.indexOf('export function usePayrolls'),
      hook.indexOf('export function usePayrollSummary'),
    )
    expect(list).toContain('enabled: authReady,')
    expect(list).not.toContain('!!employeeId')
  })
})

describe('the team hub', () => {
  const container = code(read('containers/team-and-payroll-container.tsx'))
  const view = code(read('team-and-payroll-view.tsx'))

  it('has no page title or KPI cards above every section (owner, 18 Oct 2026: «هی تکرار میشه»)', () => {
    expect(container).not.toContain('usePayrollSummary()')
    expect(view).not.toContain('<KpiCard')
    expect(view).not.toContain("t('nav.teamPayroll'")
  })

  it('the hub no longer lists payrolls (owner, 18 Oct 2026) — each person’s are on their page', () => {
    expect(container).not.toContain('usePayrolls()')
    expect(container).not.toContain('payroll-list-table')
  })
})
