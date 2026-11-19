import { describe, expect, it } from 'vitest'

import {
  budgetVarianceOf,
  DEFAULT_OVERHEAD_POLICY,
  projectCostOf,
  type ProjectCostInput,
} from '../schemas/universal-core/project-costing.domain'
import {
  billableTimeOf,
  milestoneReadiness,
  type TimeEntryForBilling,
} from '../schemas/universal-core/timesheet-billing.domain'

const direct: ProjectCostInput = {
  purchaseMinor: 100_000,
  inventoryMinor: 50_000,
  timeMinor: 20_000,
  ledgerMinor: 5_000,
}

describe('WP-15 project cost', () => {
  it('sums only the real transactions, with overhead off by default', () => {
    expect(projectCostOf(direct)).toEqual({
      directMinor: 175_000,
      overheadMinor: 0,
      totalMinor: 175_000,
    })
  })

  it('applies a configured percentage to direct cost only', () => {
    const cost = projectCostOf(direct, { basis: 'percent_of_direct', value: 10 })
    expect(cost).toEqual({ directMinor: 175_000, overheadMinor: 17_500, totalMinor: 192_500 })
  })

  it('applies a fixed overhead, and refuses a share above 100', () => {
    expect(projectCostOf(direct, { basis: 'fixed', value: 7_000 })?.totalMinor).toBe(182_000)
    expect(projectCostOf(direct, { basis: 'percent_of_direct', value: 101 })).toBeNull()
  })

  it('an unread component makes the whole cost unknown, never a cheap guess', () => {
    expect(projectCostOf({ ...direct, inventoryMinor: Number.NaN })).toBeNull()
    expect(budgetVarianceOf(200_000, null)).toBeNull()
  })

  it('reports a real over-budget variance', () => {
    expect(budgetVarianceOf(150_000, projectCostOf(direct))).toEqual({
      varianceMinor: -25_000,
      overBudget: true,
    })
  })
})

const entries: TimeEntryForBilling[] = [
  { id: 'a', hours: 10, approved: true, billable: true, rateMinor: 2_000 },
  { id: 'b', hours: 5, approved: false, billable: true, rateMinor: 2_000 },
  { id: 'c', hours: 3, approved: true, billable: false, rateMinor: 2_000 },
]

describe('WP-15 timesheet billing', () => {
  it('bills only approved AND billable hours', () => {
    const time = billableTimeOf(entries)!
    expect(time.approvedHours).toBe(13)
    expect(time.billableHours).toBe(10)
    expect(time.amountMinor).toBe(20_000)
    expect(time.entryIds).toEqual(['a'])
  })

  it('unapproved hours never unlock a milestone', () => {
    const time = billableTimeOf(entries)!
    // 18 hours were logged in total, but only 13 are approved: a 16-hour
    // milestone must stay locked even though the raw entries add up to 18.
    expect(milestoneReadiness(time, 16)?.ready).toBe(false)
    expect(milestoneReadiness(time, 13)?.ready).toBe(true)
  })

  it('an unknown rate or hours makes billing unknown, not zero', () => {
    expect(billableTimeOf([{ ...entries[0]!, rateMinor: Number.NaN }])).toBeNull()
    expect(billableTimeOf([{ ...entries[0]!, hours: -1 }])).toBeNull()
  })
})
