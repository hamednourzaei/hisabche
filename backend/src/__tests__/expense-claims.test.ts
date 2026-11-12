import { describe, expect, it } from 'vitest'
import {
  calculateExpenseReportTotal,
  canApproveExpenseReport,
  canRejectExpenseReport,
} from '@hisabche/validation'

describe('B.2.18 Expense claims domain', () => {
  it('sums minor units and guards submit -> approve / reject transitions', () => {
    const total = calculateExpenseReportTotal({
      lines: [
        { id: '1', category: 'travel', amountMinor: 1500, currency: 'AFN' },
        { id: '2', category: 'meals', amountMinor: 2500, currency: 'AFN' },
      ],
    })
    expect(total).toBe(4000)
    expect(canApproveExpenseReport('submitted')).toBe(true)
    expect(canApproveExpenseReport('reimbursed')).toBe(false)
    expect(canRejectExpenseReport('submitted')).toBe(true)
    expect(canRejectExpenseReport('approved')).toBe(false)
  })
})
