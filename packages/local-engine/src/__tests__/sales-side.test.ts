// Installments, late fees, price lists and promotions on the device. The rules
// are @hisabche/validation's (the server calls the same functions); these tests
// prove the ROUTES: rows in SQLite → the shared builders → the shape the
// screens read, and that the writes land.
import { describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID } from './test-db'

const DAY = 86_400_000
const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)

async function world() {
  const db = createTestDb()
  const engine = createLocalEngine(db)
  const customer = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/customers',
      body: { fullName: 'مشتری قسطی' },
    })
  ).data.id
  const sale = async (
    unitPrice: number,
    dueDate: string | null,
    customerId: string | null = customer,
  ) =>
    (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          customerId,
          ...(dueDate ? { dueDate } : {}),
          items: [{ productName: 'کالا', quantity: 1, unitPrice }],
        },
      })
    ).data.id
  return { db, engine, customer, sale }
}

describe('installments on the device', () => {
  it('splits what is owed, remainder on the first part, and derives what is paid', async () => {
    const { engine, sale, customer } = await world()
    const invoiceId = await sale(1000, isoDay(10))

    const put = await engine.request<{
      lines: { seq: number; amount: number; paid: number; remaining: number }[]
      nextDue: { seq: number } | null
      outstanding: number
    }>({
      method: 'PUT',
      path: `/invoices/${invoiceId}/installments`,
      body: { count: 3, firstDueDate: isoDay(5) },
    })
    expect(put.status).toBe(200)
    expect(put.data.outstanding).toBe(1000)
    // 100000 hundredths / 3 → 33334 + 33333 + 33333
    expect(put.data.lines.map((l) => l.amount)).toEqual([333.34, 333.33, 333.33])

    // 400 arrives through the ordinary payment path → part 1 paid, part 2 partly.
    const pay = await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: customer,
        amount: 400,
        currency: 'AFN',
        allocations: [{ invoiceId, amount: 400 }],
      },
    })
    expect(pay.status).toBe(201)
    const got = await engine.request<typeof put.data>({
      method: 'GET',
      path: `/invoices/${invoiceId}/installments`,
    })
    expect(got.data.outstanding).toBe(600)
    expect(got.data.lines[0]?.remaining).toBe(0)
    expect(got.data.lines[1]?.paid).toBeCloseTo(66.66, 2)
    expect(got.data.nextDue?.seq).toBe(2)

    const cleared = await engine.request<typeof put.data>({
      method: 'DELETE',
      path: `/invoices/${invoiceId}/installments`,
    })
    expect(cleared.data.lines).toEqual([])
  })

  it('refuses what the server refuses', async () => {
    const { engine, sale } = await world()
    const invoiceId = await sale(1000, null)
    const one = await engine.request({
      method: 'PUT',
      path: `/invoices/${invoiceId}/installments`,
      body: { count: 1, firstDueDate: isoDay(1) },
    })
    expect(one.status).toBe(400)
    const missing = await engine.request({
      method: 'GET',
      path: '/invoices/9b2f4c1e-0000-4000-8000-000000000001/installments',
    })
    expect(missing.status).toBe(404)
  })
})

describe('late fees on the device', () => {
  it('is off until a policy is saved, then charges once as an ordinary sale invoice', async () => {
    const { engine, sale, customer } = await world()
    const invoiceId = await sale(1000, isoDay(-70))

    const off = await engine.request<{ state: string }>({
      method: 'GET',
      path: `/invoices/${invoiceId}/late-fees`,
    })
    expect(off.data.state).toBe('off')

    const saved = await engine.request<{ policy: { isEnabled: boolean } }>({
      method: 'PUT',
      path: '/late-fees/policy',
      body: { isEnabled: true, basis: 'per_period', amount: 10, currency: 'AFN', graceDays: 0 },
    })
    expect(saved.status).toBe(200)
    expect(saved.data.policy.isEnabled).toBe(true)

    const preview = await engine.request<{
      state: string
      totalToAssess: number
      lines: { daysLate: number; toAssess: number }[]
    }>({ method: 'GET', path: `/invoices/${invoiceId}/late-fees` })
    expect(preview.data.state).toBe('ready')
    // 70 days late → two whole 30-day periods → 2 × 10
    expect(preview.data.totalToAssess).toBe(20)

    const charged = await engine.request<{
      totalToAssess: number
      assessments: { feeInvoiceId: string | null; fee: number }[]
    }>({ method: 'POST', path: `/invoices/${invoiceId}/late-fees`, body: { language: 'en' } })
    expect(charged.status).toBe(200)
    expect(charged.data.totalToAssess).toBe(0)
    expect(charged.data.assessments).toHaveLength(1)
    const feeInvoiceId = charged.data.assessments[0]?.feeInvoiceId
    expect(feeInvoiceId).toBeTruthy()

    // The fee is a real sale invoice of the customer, for the fee.
    const fee = await engine.request<{
      total: number
      customerId: string
      items: { productName: string }[]
    }>({
      method: 'GET',
      path: `/invoices/${feeInvoiceId}`,
    })
    expect(fee.data.total).toBe(20)
    expect(fee.data.customerId).toBe(customer)
    expect(fee.data.items[0]?.productName).toContain('Late fee')

    // Charged once: asking again has nothing to assess, and a fee invoice is never assessed.
    const again = await engine.request({
      method: 'POST',
      path: `/invoices/${invoiceId}/late-fees`,
      body: {},
    })
    expect(again.status).toBe(400)
    const onFee = await engine.request<{ state: string }>({
      method: 'GET',
      path: `/invoices/${feeInvoiceId}/late-fees`,
    })
    expect(onFee.data.state).toBe('fee_invoice')
  })
})

describe('price lists and promotions on the device', () => {
  it('prices a product on a list, puts a customer on it, retires — never deletes', async () => {
    const { engine, customer } = await world()
    const product = (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/products',
        body: {
          name: 'برنج',
          sellPrice: 100,
          buyPrice: 60,
          unit: 'kg',
          quantity: 10,
          warehouseId: TEST_WAREHOUSE_ID,
        },
      })
    ).data.id

    const created = await engine.request<{ id: string; itemCount: number }>({
      method: 'POST',
      path: '/price-lists',
      body: { name: 'عمده', currency: 'AFN', validFrom: null, validTo: null },
    })
    expect(created.status).toBe(201)
    const listId = created.data.id

    const dup = await engine.request({
      method: 'POST',
      path: '/price-lists',
      body: { name: 'عمده', currency: 'AFN', validFrom: null, validTo: null },
    })
    expect(dup.status).toBe(400)

    const set = await engine.request<{
      items: { productId: string; unitPrice: number; ownPrice: number }[]
    }>({
      method: 'PUT',
      path: `/price-lists/${listId}/items`,
      body: { items: [{ productId: product, unitPrice: 85.5 }] },
    })
    expect(set.status).toBe(200)
    expect(set.data.items[0]).toMatchObject({ productId: product, unitPrice: 85.5, ownPrice: 100 })

    const assigned = await engine.request({
      method: 'PUT',
      path: `/price-lists/customers/${customer}`,
      body: { priceListId: listId },
    })
    expect(assigned.status).toBe(200)

    const forCustomer = await engine.request<{
      priceList: { prices: { unitPrice: number }[] } | null
    }>({ method: 'GET', path: `/price-lists/for-customer/${customer}` })
    expect(forCustomer.data.priceList?.prices[0]?.unitPrice).toBe(85.5)

    // Taking the product off retires the row; the list is retired, not deleted.
    const off = await engine.request<{ items: unknown[] }>({
      method: 'PUT',
      path: `/price-lists/${listId}/items`,
      body: { items: [{ productId: product, unitPrice: null }] },
    })
    expect(off.data.items).toEqual([])
    const retired = await engine.request<{ isActive: boolean }>({
      method: 'PATCH',
      path: `/price-lists/${listId}/active`,
      body: { isActive: false },
    })
    expect(retired.data.isActive).toBe(false)
    const lists = await engine.request<{ priceLists: { id: string }[] }>({
      method: 'GET',
      path: '/price-lists',
    })
    expect(lists.data.priceLists.map((l) => l.id)).toContain(listId)

    const retiredAssign = await engine.request({
      method: 'PUT',
      path: `/price-lists/customers/${customer}`,
      body: { priceListId: listId },
    })
    expect(retiredAssign.status).toBe(400)
  })

  it('saves a promotion scoped to products of this business only, and retires it', async () => {
    const { engine } = await world()
    const stranger = '9b2f4c1e-0000-4000-8000-0000000000aa'
    const refused = await engine.request({
      method: 'POST',
      path: '/promotions',
      body: {
        name: 'تخفیف',
        kind: 'percentage',
        value: 10,
        currency: null,
        stacking: 'exclusive',
        productIds: [stranger],
        customerIds: null,
        validFrom: null,
        validTo: null,
      },
    })
    expect(refused.status).toBe(400)

    const saved = await engine.request<{ id: string; kind: string; productIds: string[] | null }>({
      method: 'POST',
      path: '/promotions',
      body: {
        name: 'تخفیف همگانی',
        kind: 'percentage',
        value: 10,
        currency: null,
        stacking: 'exclusive',
        productIds: null,
        customerIds: null,
        validFrom: null,
        validTo: null,
      },
    })
    expect(saved.status).toBe(201)
    expect(saved.data.productIds).toBeNull()

    await engine.request({
      method: 'PATCH',
      path: `/promotions/${saved.data.id}/active`,
      body: { isActive: false },
    })
    const active = await engine.request<{ promotions: unknown[] }>({
      method: 'GET',
      path: '/promotions?active=1',
    })
    expect(active.data.promotions).toEqual([])
    const all = await engine.request<{ promotions: { isActive: boolean }[] }>({
      method: 'GET',
      path: '/promotions',
    })
    expect(all.data.promotions).toHaveLength(1)
    expect(all.data.promotions[0]?.isActive).toBe(false)
  })
})
