// ============================================
// backend/src/__tests__/offline-pos-conflict.test.ts
//
// M2 — the scenario the spec names, exactly.
//
//   Device A offline: believes stock is 5, sells 4.
//   Device B offline: believes stock is 5, sells 4.
//   Both sales are real. On sync, on-hand is −3.
//
// The four forbidden outcomes (M2.4) are silent reject, silent overwrite,
// silent delete and silent stock correction. Every one is the same mistake:
// making the arithmetic tidy by destroying a record of something that happened.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  NEGATIVE_STOCK_RESOLUTIONS,
  breachDivergences,
  breachKey,
  detectBreaches,
  type StockOutcome,
} from '../services/pos/negative-stock.domain'

/** Device A sold 4 of 5, then device B sold 4 of the same 5. */
const CONCURRENT_OFFLINE: StockOutcome[] = [
  { productId: 'p1', onHandAfter: 1, quantitySold: 4, deviceBelievedOnHand: 5 },
  { productId: 'p1', onHandAfter: -3, quantitySold: 4, deviceBelievedOnHand: 5 },
]

describe('the exact scenario: two offline tills, one stock of five', () => {
  it('the FIRST sale raises nothing — it was entirely valid', () => {
    expect(detectBreaches([CONCURRENT_OFFLINE[0]!])).toEqual([])
  })

  it('the SECOND sale raises a conflict, and names the shortfall', () => {
    const breaches = detectBreaches([CONCURRENT_OFFLINE[1]!])
    expect(breaches).toHaveLength(1)
    expect(breaches[0]).toMatchObject({
      productId: 'p1',
      onHandAfter: -3,
      // Three units were sold that the shop did not have.
      shortfall: 3,
      quantitySold: 4,
      deviceBelievedOnHand: 5,
    })
  })

  it('records that NEITHER till did anything wrong', () => {
    // The honest distinction. Both devices sold 4 believing there were 5 —
    // they acted correctly on what they knew. That is different from a till
    // selling stock its own count said was not there.
    const [breach] = detectBreaches([CONCURRENT_OFFLINE[1]!])
    expect(breach!.soldBeyondOwnBelief).toBe(false)
  })

  it('tells a genuine oversell apart from a concurrent one', () => {
    // A till that knew it had 2 and sold 5 is a different problem, and the
    // conflict says so rather than lumping the two together.
    const [breach] = detectBreaches([
      { productId: 'p1', onHandAfter: -3, quantitySold: 5, deviceBelievedOnHand: 2 },
    ])
    expect(breach!.soldBeyondOwnBelief).toBe(true)
  })
})

describe('what does NOT raise a conflict', () => {
  it('selling the last unit down to exactly zero', () => {
    // A normal, correct sale. Raising a conflict here would bury the real
    // ones under a warning every time a shop sold out.
    expect(detectBreaches([{ productId: 'p1', onHandAfter: 0, quantitySold: 5 }])).toEqual([])
  })

  it('any sale that leaves stock positive', () => {
    expect(detectBreaches([{ productId: 'p1', onHandAfter: 12, quantitySold: 3 }])).toEqual([])
  })

  it('a device that did not report what it believed', () => {
    // Offline clients may not send it. The conflict is still raised; only the
    // «did they know» judgement is withheld rather than guessed.
    const [breach] = detectBreaches([{ productId: 'p1', onHandAfter: -2, quantitySold: 4 }])
    expect(breach!.deviceBelievedOnHand).toBeNull()
    expect(breach!.soldBeyondOwnBelief).toBe(false)
  })
})

describe('one mutation, several oversold products', () => {
  it('raises one conflict per product', () => {
    const breaches = detectBreaches([
      { productId: 'p1', onHandAfter: -1, quantitySold: 2 },
      { productId: 'p2', onHandAfter: 5, quantitySold: 1 },
      { productId: 'p3', onHandAfter: -4, quantitySold: 9 },
    ])
    expect(breaches.map((b) => b.productId)).toEqual(['p1', 'p3'])
  })

  it('gives each its own key, so one does not overwrite the other', () => {
    // ⚠️ `sync_conflicts` is unique on (workspace_id, mutation_id). Keying by
    // the bare mutation id would let the second product silently replace the
    // first product's conflict — one of the two oversells would vanish.
    expect(breachKey('m1', 'p1')).not.toBe(breachKey('m1', 'p3'))
  })
})

describe('M2.5 — replaying a mutation files no second conflict', () => {
  it('the key is stable for the same mutation and product', () => {
    // The upsert is `onConflict: workspace_id,mutation_id`, so a stable key
    // means a replay updates the same row instead of creating another.
    expect(breachKey('m1', 'p1')).toBe(breachKey('m1', 'p1'))
  })
})

describe('the conflict is always financial and always for a person', () => {
  it('every divergence is marked financial', () => {
    const [breach] = detectBreaches([CONCURRENT_OFFLINE[1]!])
    const divergences = breachDivergences(breach!)
    expect(divergences.every((d) => d.financial)).toBe(true)
  })

  it('carries what the shop has and what the device thought', () => {
    const [breach] = detectBreaches([CONCURRENT_OFFLINE[1]!])
    const [quantity] = breachDivergences(breach!)
    expect(quantity).toMatchObject({ field: 'quantity', serverValue: -3, clientValue: 5 })
  })
})

describe('the resolutions are stated honestly, including the missing ones', () => {
  it('names all three the spec asks for', () => {
    const codes = NEGATIVE_STOCK_RESOLUTIONS.map((r) => r.code)
    expect(codes).toContain('refund_sale')
    expect(codes).toContain('replenish')
    expect(codes).toContain('inventory_adjust')
  })

  it('marks which the product can actually carry out', () => {
    // ⚠️ Offering three buttons where one works is the theater G1 forbids.
    //
    //   inventory_adjust — EXISTS, via L2's cycle count
    //   refund_sale      — needs a credit note (J3.4 stop condition)
    //   replenish        — needs a purchase order create form (gap 11)
    const byCode = new Map(NEGATIVE_STOCK_RESOLUTIONS.map((r) => [r.code, r.available]))
    expect(byCode.get('inventory_adjust')).toBe(true)
    expect(byCode.get('refund_sale')).toBe(false)
    expect(byCode.get('replenish')).toBe(false)
  })
})

describe('M2.4 — the four forbidden outcomes', () => {
  const domain = readFileSync(
    join(__dirname, '..', 'services', 'pos', 'negative-stock.domain.ts'),
    'utf8',
  )
  const conflict = readFileSync(
    join(__dirname, '..', 'services', 'conflict', 'conflict.service.ts'),
    'utf8',
  )
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('detection never clamps a negative to zero', () => {
    // Silent stock correction. `Math.max(0, …)` anywhere in this file would be
    // the shop's oversell quietly disappearing.
    expect(code(domain)).not.toContain('Math.max(0')
  })

  it('detection writes nothing at all', () => {
    // Silent reject / overwrite / delete. The domain decides whether a
    // conflict is owed; it cannot move stock or reverse a sale because it
    // cannot reach the database.
    expect(code(domain)).not.toContain('supabase')
    expect(code(domain)).not.toContain('from(')
  })

  it('filing the breach does not touch stock', () => {
    const method = code(conflict).slice(code(conflict).indexOf('async recordStockBreach'))
    const body = method.slice(0, 3000)
    expect(body).not.toContain("from('products')")
    expect(body).not.toContain("from('stock_movements')")
  })

  it('the breach is filed OPEN, never auto-resolved', () => {
    // There is no correct side to take: both sales happened. Auto-resolving
    // would mean silently choosing which customer did not buy anything.
    const method = code(conflict).slice(code(conflict).indexOf('async recordStockBreach'))
    const body = method.slice(0, 3000)
    expect(body).toContain("status: 'open'")
    expect(body).toContain('has_financial_divergence: true')
    expect(body).toContain('resolution: null')
  })
})
