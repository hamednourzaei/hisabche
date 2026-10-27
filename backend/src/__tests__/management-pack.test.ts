import { describe, expect, it } from 'vitest'
import { composeManagementPack, type ManagementPackPayload } from '../pdf/management-pack.composer'

describe('Management Pack Composer', () => {
  const validPayload: ManagementPackPayload = {
    title: 'Q3 2026 Management Pack',
    periodEnd: '2026-09-30',
    incomeStatement: {
      revenueMinor: 10000000,
      costOfGoodsSoldMinor: 4000000,
      grossProfitMinor: 6000000,
      operatingExpensesMinor: 2000000,
      netIncomeMinor: 4000000,
    },
    cashFlow: {
      operatingCashFlowMinor: 3500000,
      investingCashFlowMinor: -500000,
      financingCashFlowMinor: -1000000,
      netCashFlowMinor: 2000000,
    },
    workingCapital: {
      currentAssetsMinor: 15000000,
      currentLiabilitiesMinor: 5000000,
      workingCapitalMinor: 10000000,
    },
    aging: {
      totalDueMinor: 2500000,
      currentMinor: 1500000,
      days30Minor: 600000,
      days60Minor: 300000,
      days90PlusMinor: 100000,
    },
  }

  it('composes management pack with integer minor units correctly', () => {
    const result = composeManagementPack(validPayload)
    expect(result.summary.periodEnd).toBe('2026-09-30')
    expect(result.summary.netIncomeMinor).toBe(4000000)
    expect(result.summary.netCashFlowMinor).toBe(2000000)
    expect(result.summary.workingCapitalMinor).toBe(10000000)
    expect(result.summary.totalDueMinor).toBe(2500000)
    expect(result.report.title).toBe('Q3 2026 Management Pack')
  })

  it('rejects floating point amounts on the money path', () => {
    const invalidPayload: ManagementPackPayload = {
      ...validPayload,
      incomeStatement: {
        ...validPayload.incomeStatement,
        netIncomeMinor: 4000.5,
      },
    }
    expect(() => composeManagementPack(invalidPayload)).toThrow('MANAGEMENT_PACK_FLOAT_DETECTED')
  })
})
