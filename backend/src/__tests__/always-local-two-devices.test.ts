// ============================================
// backend/src/__tests__/always-local-two-devices.test.ts
//
// F4.4 (D11): two offline tills, one shelf, not enough stock.
//
// Server stock is 5. Device A sells 3 while offline. Device B sells 3 while
// offline. Both sales HAPPENED — money changed hands, goods left the shelf.
// The server applies the two outbox entries in queue order, and on-hand is −1.
//
// DOMAIN-LEVEL AND DETERMINISTIC: no devices, no database, no HTTP. The two
// outbox entries are the shape the local engine writes (asserted in
// packages/local-engine/src/__tests__/offline-invoice-outbox.test.ts), and the
// conflict side is the REAL M2 domain code — detectBreaches, breachKey,
// breachDivergences — so the shortfall and the conflict's identity are not
// re-implemented here.
//
// What a person reads afterwards: two invoices, a balance of −1, one conflict,
// and nothing changed by a second delivery of the same two entries.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  breachDivergences,
  breachKey,
  detectBreaches,
  type StockOutcome,
} from '../services/pos/negative-stock.domain'

const PRODUCT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STOCK_ON_SHELF = 5
const EACH_TILL_SELLS = 3
const MUTATION_A = 'mutation-a'
const MUTATION_B = 'mutation-b'

/** One outbox row, as the local engine writes it (`client_id` = the sale's id). */
interface OutboxEntry {
  clientId: string
  productId: string
  quantity: number
}

interface Books {
  /** On-hand, per product. */
  onHand: Record<string, number>
  /** The sales the server has applied, by client request id. */
  invoices: Map<string, OutboxEntry>
  /** What each applied movement left behind — the reading the conflict reads. */
  outcomes: StockOutcome[]
}

/**
 * The server applies one queued sale.
 *
 * ⚠️ A REPLAY IS NOT A SECOND SALE. The server keys on the client request id
 * (`invoices.client_request_id`, written from the Idempotency-Key the device
 * sent), so the same entry delivered twice moves the stock once. That rule is
 * modelled here because this test is domain-level; it also has its own test
 * against the real route.
 */
function applyEntry(books: Books, entry: OutboxEntry, believed: number): void {
  if (books.invoices.has(entry.clientId)) return
  books.invoices.set(entry.clientId, entry)
  const left = (books.onHand[entry.productId] ?? 0) - entry.quantity
  books.onHand[entry.productId] = left
  // Read back AFTER the movement, exactly as the domain expects it.
  books.outcomes.push({
    productId: entry.productId,
    onHandAfter: left,
    quantitySold: entry.quantity,
    deviceBelievedOnHand: believed,
  })
}

describe('two offline tills, one shelf', () => {
  it('records both sales, ends at −1, and files exactly one conflict', () => {
    const entryA: OutboxEntry = {
      clientId: MUTATION_A,
      productId: PRODUCT,
      quantity: EACH_TILL_SELLS,
    }
    const entryB: OutboxEntry = {
      clientId: MUTATION_B,
      productId: PRODUCT,
      quantity: EACH_TILL_SELLS,
    }

    const books: Books = {
      onHand: { [PRODUCT]: STOCK_ON_SHELF },
      invoices: new Map(),
      outcomes: [],
    }

    // ── Queue order. The first sale fits: 5 − 3 = 2, nothing is owed.
    applyEntry(books, entryA, STOCK_ON_SHELF)
    expect(books.onHand[PRODUCT]).toBe(2)
    expect(detectBreaches(books.outcomes)).toHaveLength(0)

    // ── The second sale does not fit. It is still recorded: money was taken.
    applyEntry(books, entryB, STOCK_ON_SHELF)
    expect(books.onHand[PRODUCT]).toBe(-1)
    expect(books.invoices.size).toBe(2)

    const breaches = detectBreaches(books.outcomes)
    expect(breaches).toHaveLength(1)
    const breach = breaches[0]!
    expect(breach.productId).toBe(PRODUCT)
    expect(breach.onHandAfter).toBe(-1)
    // −1 on hand IS one unit sold that did not exist.
    expect(breach.shortfall).toBe(1)
    // Honest oversell: the till sold from a count it believed was five.
    expect(breach.soldBeyondOwnBelief).toBe(false)
    expect(breachDivergences(breach).every((d) => d.financial)).toBe(true)

    // The conflict's identity: the SECOND entry, and that product.
    const key = breachKey(entryB.clientId, PRODUCT)
    expect(key).toBe(`${MUTATION_B}:negative-stock:${PRODUCT}`)
    // Stable across retries — the same mutation never files a second conflict.
    expect(breachKey(entryB.clientId, PRODUCT)).toBe(key)

    // ── Both entries delivered again: same balance, same two invoices, same
    // one conflict. Balances, not row counts.
    applyEntry(books, entryA, STOCK_ON_SHELF)
    applyEntry(books, entryB, STOCK_ON_SHELF)

    expect(books.onHand[PRODUCT]).toBe(-1)
    expect(books.invoices.size).toBe(2)
    expect(books.outcomes).toHaveLength(2)
    expect(detectBreaches(books.outcomes)).toHaveLength(1)
    expect(detectBreaches(books.outcomes)[0]!.shortfall).toBe(1)
  })

  it('never files a conflict when the shelf is merely emptied', () => {
    // Selling the last units is a normal sale, not an oversell: the rule is
    // «negative on-hand», not «zero on-hand».
    const books: Books = {
      onHand: { [PRODUCT]: STOCK_ON_SHELF },
      invoices: new Map(),
      outcomes: [],
    }

    applyEntry(books, { clientId: MUTATION_A, productId: PRODUCT, quantity: 2 }, STOCK_ON_SHELF)
    applyEntry(books, { clientId: MUTATION_B, productId: PRODUCT, quantity: 3 }, STOCK_ON_SHELF)

    expect(books.onHand[PRODUCT]).toBe(0)
    expect(books.invoices.size).toBe(2)
    expect(detectBreaches(books.outcomes)).toHaveLength(0)
  })
})
