import { describe, expect, it } from 'vitest'
import { evaluateBudgetAtPosting } from '@hisabche/validation'

describe('B.2.6 Budget warning at posting', () => {
  const budgets = [
    {
      budgetId: 'b-1',
      accountId: 'acc-rent',
      dimensionId: 'dim-kabul',
      period: '2026-06',
      limitMinor: 100_000,
      actualMinor: 80_000,
    },
  ]

  it('returns silence when no budget matches', () => {
    const res = evaluateBudgetAtPosting({
      budgets,
      accountId: 'acc-other',
      dimensionId: 'dim-kabul',
      period: '2026-06',
      expenseDeltaMinor: 50_000,
    })
    expect(res.status).toBe('ok')
    expect(res.code).toBeNull()
  })

  it('warns by default when budget is exceeded', () => {
    const res = evaluateBudgetAtPosting({
      budgets,
      accountId: 'acc-rent',
      dimensionId: 'dim-kabul',
      period: '2026-06',
      expenseDeltaMinor: 30_000,
    })
    expect(res.status).toBe('warn')
    expect(res.code).toBe('BUDGET_EXCEEDED')
    expect(res.overageMinor).toBe(10_000)
  })

  it('blocks when policy is block', () => {
    const res = evaluateBudgetAtPosting({
      budgets,
      accountId: 'acc-rent',
      dimensionId: 'dim-kabul',
      period: '2026-06',
      expenseDeltaMinor: 30_000,
      policy: 'block',
    })
    expect(res.status).toBe('block')
    expect(res.code).toBe('BUDGET_EXCEEDED')
  })
})
