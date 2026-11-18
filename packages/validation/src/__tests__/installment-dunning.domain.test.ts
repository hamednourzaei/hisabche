import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DUNNING_POLICY,
  decideDunning,
  type DunningPolicy,
} from '../schemas/universal-core/installment-dunning.domain'
import type { InstallmentSchedule } from '../schemas/installment.domain'

const schedule: InstallmentSchedule[] = [
  {
    id: 's1',
    invoiceId: 'inv',
    seq: 1,
    dueDate: '2026-01-01',
    amountMinor: 1000,
    paidMinor: 1000,
  },
  {
    id: 's2',
    invoiceId: 'inv',
    seq: 2,
    dueDate: '2026-01-15',
    amountMinor: 1000,
    paidMinor: 0,
  },
]

const on = (over: Partial<DunningPolicy> = {}): DunningPolicy => ({
  ...DEFAULT_DUNNING_POLICY,
  enabled: true,
  ...over,
})

describe('WP-13 installment dunning', () => {
  it('shows OVERDUE on the device even when reminders are off — the fact is not hidden', () => {
    const rows = decideDunning(schedule, '2026-03-01')
    expect(rows.map((r) => [r.seq, r.status])).toEqual([
      [1, 'paid'],
      [2, 'overdue'],
    ])
    expect(rows[1]!.reminderDue).toBe(false)
  })

  it('a paid line is never late however old it is', () => {
    const row = decideDunning(schedule, '2027-01-01')[0]!
    expect(row).toMatchObject({ status: 'paid', daysLate: 0, overdueMinor: 0 })
  })

  it('does not send a reminder before the interval has passed', () => {
    const rows = decideDunning(schedule, '2026-01-20', on({ reminderIntervalDays: 7 }))
    expect(rows[1]!.status).toBe('overdue')
    expect(rows[1]!.daysLate).toBe(5)
    expect(rows[1]!.reminderDue).toBe(false)
  })

  it('sends a reminder once the interval has passed, and remembers how many were sent', () => {
    const rows = decideDunning(schedule, '2026-01-23', on({ reminderIntervalDays: 7 }))
    expect(rows[1]!.reminderDue).toBe(true)
    const again = decideDunning(schedule, '2026-01-23', on({ reminderIntervalDays: 7 }), {
      s2: 1,
    })
    expect(again[1]!.reminderCount).toBe(1)
    expect(again[1]!.reminderDue).toBe(false)
  })

  it('never exceeds the maximum number of reminders', () => {
    const rows = decideDunning(schedule, '2026-06-01', on({ maxReminders: 0 }))
    expect(rows[1]!.reminderDue).toBe(false)
  })

  it('an invalid policy sends no reminders but keeps the honest overdue status', () => {
    const rows = decideDunning(schedule, '2026-03-01', on({ reminderIntervalDays: 0 }))
    expect(rows[1]!.status).toBe('overdue')
    expect(rows[1]!.reminderDue).toBe(false)
  })

  it('respects the grace day before a line becomes overdue', () => {
    const rows = decideDunning(schedule, '2026-01-17', on({ graceDays: 5 }))
    expect(rows[1]!.status).toBe('due')
  })
})
