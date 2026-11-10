// ============================================
// «ثبت ضایعات» and the person's own server state (10 Nov 2026).
//   • a waste record takes decimals (0.25 kg — weighted retail) and a reason;
//   • its movement note starts with the reason, so the stock history reads it;
//   • a draft is the builder's state, bounded; a theme is one of three.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  invoiceDraftSaveSchema,
  stockWasteSchema,
  userPreferencesSchema,
  wasteMovementNote,
} from '../index'

describe('stock waste', () => {
  it('takes a decimal quantity with its reason', () => {
    const parsed = stockWasteSchema.parse({ quantity: 0.25, reason: 'spoiled' })
    expect(parsed.quantity).toBe(0.25)
  })

  it('refuses nothing, a negative and an unknown reason', () => {
    expect(stockWasteSchema.safeParse({ quantity: 0, reason: 'spoiled' }).success).toBe(false)
    expect(stockWasteSchema.safeParse({ quantity: -1, reason: 'lost' }).success).toBe(false)
    expect(stockWasteSchema.safeParse({ quantity: 1, reason: 'stolen' }).success).toBe(false)
  })

  it('writes the reason first in the movement note', () => {
    expect(wasteMovementNote({ reason: 'expired' })).toBe('waste:expired')
    expect(wasteMovementNote({ reason: 'damaged', note: 'افتاد' })).toBe('waste:damaged — افتاد')
  })
})

describe('person state', () => {
  it('a draft names one of the four documents and carries an object', () => {
    expect(
      invoiceDraftSaveSchema.safeParse({ kind: 'pre_sale', payload: { rows: [] } }).success,
    ).toBe(true)
    expect(invoiceDraftSaveSchema.safeParse({ kind: 'refund', payload: {} }).success).toBe(false)
    expect(invoiceDraftSaveSchema.safeParse({ kind: 'sale', payload: [] }).success).toBe(false)
  })

  it('a theme is light, dark or system', () => {
    expect(userPreferencesSchema.safeParse({ theme: 'dark' }).success).toBe(true)
    expect(userPreferencesSchema.safeParse({ theme: 'neon' }).success).toBe(false)
  })
})
