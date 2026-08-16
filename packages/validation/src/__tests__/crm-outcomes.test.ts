// ============================================
// A ❌ without a reason is the one case that makes the whole per-customer
// outcome feature useless — the note is all the task's creator has to act on.
// The schema, not the UI, is what guarantees it.
// ============================================

import { describe, expect, it } from 'vitest'

import { recordCustomerOutcomeSchema } from '../schemas/crm.schema'

const CUSTOMER_ID = '11111111-2222-3333-4444-555555555555'

describe('recordCustomerOutcomeSchema', () => {
  it('accepts a success with no note', () => {
    const parsed = recordCustomerOutcomeSchema.parse({
      customerId: CUSTOMER_ID,
      outcome: 'done',
    })

    expect(parsed.outcome).toBe('done')
    expect(parsed.note).toBeUndefined()
  })

  it('accepts a success that carries a note anyway', () => {
    const parsed = recordCustomerOutcomeSchema.parse({
      customerId: CUSTOMER_ID,
      outcome: 'done',
      note: 'سفارش داد',
    })

    expect(parsed.note).toBe('سفارش داد')
  })

  it('accepts a failure with a reason', () => {
    const parsed = recordCustomerOutcomeSchema.parse({
      customerId: CUSTOMER_ID,
      outcome: 'failed',
      note: 'شماره خاموش بود',
    })

    expect(parsed.note).toBe('شماره خاموش بود')
  })

  it('rejects a failure with no note at all', () => {
    expect(() =>
      recordCustomerOutcomeSchema.parse({ customerId: CUSTOMER_ID, outcome: 'failed' }),
    ).toThrow()
  })

  it('rejects a failure whose note is only whitespace', () => {
    // Trimming happens before the check, so spaces cannot satisfy the rule.
    expect(() =>
      recordCustomerOutcomeSchema.parse({
        customerId: CUSTOMER_ID,
        outcome: 'failed',
        note: '   ',
      }),
    ).toThrow()
  })

  it('trims surrounding whitespace from the note', () => {
    const parsed = recordCustomerOutcomeSchema.parse({
      customerId: CUSTOMER_ID,
      outcome: 'failed',
      note: '  جواب نداد  ',
    })

    expect(parsed.note).toBe('جواب نداد')
  })

  it('rejects a customerId that is not a uuid', () => {
    // The public endpoint is unauthenticated; a loose id here would widen what
    // a token holder can address.
    expect(() =>
      recordCustomerOutcomeSchema.parse({ customerId: 'not-a-uuid', outcome: 'done' }),
    ).toThrow()
  })

  it('rejects an unknown outcome', () => {
    expect(() =>
      recordCustomerOutcomeSchema.parse({ customerId: CUSTOMER_ID, outcome: 'maybe' }),
    ).toThrow()
  })

  it('rejects a note longer than the column allows', () => {
    expect(() =>
      recordCustomerOutcomeSchema.parse({
        customerId: CUSTOMER_ID,
        outcome: 'failed',
        note: 'x'.repeat(1001),
      }),
    ).toThrow()
  })
})
