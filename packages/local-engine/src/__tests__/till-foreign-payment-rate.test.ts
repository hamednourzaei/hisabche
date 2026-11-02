// ============================================
// A foreign payment into the till is moved at the rate the payment is BOOKED at.
//
// The till block read the rate from the request body and fell back to 1; the ledger side used the shared
// `resolveBookingRate` (body, else the named invoices' frozen rate). So a dollar payment settling a dollar invoice
// with no rate in the body booked at 70 in the ledger and put ONE afghani per dollar into the drawer — the count
// and the books disagreed from that minute on. One rate, decided once, used by both.
// ============================================
import { describe, expect, it } from 'vitest'
import { FRACTION_DIGITS } from '@hisabche/formatting'
import { createTestDb, createTestEngine } from './test-db'

const digits = (FRACTION_DIGITS as Record<string, number>).AFN ?? 2
const minorOf = (major: number) => Math.round(major * 10 ** digits)

async function fixture() {
  const db = createTestDb()
  const engine = createTestEngine(db)
  const session = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/pos/sessions',
      body: { openingFloatMinor: minorOf(1000) },
    })
  ).data
  const customer = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/customers',
      body: { fullName: 'مشتری دلاری' },
    })
  ).data.id
  const invoice = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'USD',
        exchangeRate: 70,
        customerId: customer,
        items: [{ productName: 'کالا', quantity: 1, unitPrice: 10 }],
      },
    })
  ).data.id
  const pay = (extra: Record<string, unknown>) =>
    engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: customer,
        amount: 10,
        currency: 'USD',
        method: 'cash',
        tillSessionId: session.id,
        allocations: [{ invoiceId: invoice, amount: 10 }],
        ...extra,
      },
    })
  return { db, pay }
}

describe('till movement of a foreign payment', () => {
  it("uses the named invoice's frozen rate when the body carries none (not 1)", async () => {
    const { db, pay } = await fixture()
    const res = await pay({})
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    const row = db.get<{ till_amount_minor: number }>(
      'SELECT till_amount_minor FROM payment ORDER BY created_at DESC LIMIT 1',
      [],
    )
    expect(row?.till_amount_minor).toBe(minorOf(700)) // 10 USD x 70, not 10 x 1
  })

  it('a rate in the body still wins, and the ledger and the drawer use the same one', async () => {
    const { db, pay } = await fixture()
    const res = await pay({ exchangeRate: 72 })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    const row = db.get<{ till_amount_minor: number }>(
      'SELECT till_amount_minor FROM payment ORDER BY created_at DESC LIMIT 1',
      [],
    )
    expect(row?.till_amount_minor).toBe(minorOf(720))
  })
})
