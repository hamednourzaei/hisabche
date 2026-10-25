// ============================================
// The books' statements on the device.
//
// The device answers balance sheet, income statement, general ledger, the profit
// report by currency and the evidence chain with the SAME pure functions the
// server calls. These tests read the figures back from SQLite, through the
// engine, and check the invariants those functions promise — not the functions
// themselves.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID } from './test-db'

interface Statement {
  assets: Array<{ accountId: string; accountCode: string; balance: number }>
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  outOfBalanceBy: number
}

describe('statements on the device', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>
  let productId: string
  let uncostedProductId: string
  const today = new Date().toISOString().slice(0, 10)

  beforeEach(async () => {
    db = createTestDb()
    engine = createLocalEngine(db)
    const costed = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'شکر',
        buyPrice: 50,
        sellPrice: 65,
        quantity: 100,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    productId = (costed.data as { id: string }).id
    // Stock with no purchase price: its cost is UNKNOWN, not zero.
    const uncosted = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'چای',
        buyPrice: 0,
        sellPrice: 200,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    uncostedProductId = (uncosted.data as { id: string }).id
  })

  async function sell(id: string, quantity: number, unitPrice: number, extra = {}) {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: id, productName: 'x', quantity, unitPrice, discount: 0 }],
        ...extra,
      },
    })
    expect(res.status).toBe(201)
    return res.data as { id: string }
  }

  it('the balance sheet balances and its sides agree with the trial balance', async () => {
    await sell(productId, 10, 65)
    const sheet = (
      await engine.request<Statement>({ method: 'GET', path: '/accounting/balance-sheet' })
    ).data
    expect(sheet.outOfBalanceBy).toBe(0)
    expect(sheet.totalAssets).toBe(sheet.totalLiabilities + sheet.totalEquity)

    const trial = (
      await engine.request<{ rows: Array<{ accountId: string; balance: number }> }>({
        method: 'GET',
        path: '/accounting/trial-balance',
      })
    ).data
    for (const line of sheet.assets) {
      const same = trial.rows.find((r) => r.accountId === line.accountId)
      expect(same?.balance).toBe(line.balance)
    }
  })

  it('the income statement revenue is the profit report revenue', async () => {
    await sell(productId, 10, 65)
    const income = (
      await engine.request<{ totalRevenue: number; netIncome: number }>({
        method: 'GET',
        path: `/accounting/income-statement?from=${today}&to=${today}`,
      })
    ).data
    const reports = (
      await engine.request<Array<{ currency: string; totals: { revenue: number } }>>({
        method: 'GET',
        path: `/accounting/profit-report/by-currency?from=${today}&to=${today}`,
      })
    ).data
    expect(income.totalRevenue).toBe(650)
    expect(reports.find((r) => r.currency === 'AFN')?.totals.revenue).toBe(650)
  })

  it('the general ledger closes on the trial balance, and the first day is not counted twice', async () => {
    await sell(productId, 10, 65)
    const trial = (
      await engine.request<{
        rows: Array<{ accountId: string; accountCode: string; balance: number }>
      }>({
        method: 'GET',
        path: '/accounting/trial-balance',
      })
    ).data
    const withMovement = trial.rows.filter((r) => r.balance !== 0)
    expect(withMovement.length).toBeGreaterThan(0)
    for (const row of withMovement) {
      const ledger = (
        await engine.request<{ closingBalance: number; openingBalance: number; lines: unknown[] }>({
          method: 'GET',
          path: `/accounting/general-ledger?accountId=${row.accountId}&fromDate=${today}&toDate=${today}`,
        })
      ).data
      // Everything was booked today: nothing is "before" the window, and the
      // closing balance is the whole account.
      expect(ledger.openingBalance).toBe(0)
      expect(ledger.closingBalance).toBe(row.balance)
    }
  })

  it('refuses a general ledger without an account, and for an account that is not there', async () => {
    const none = await engine.request({ method: 'GET', path: '/accounting/general-ledger' })
    expect(none.status).toBe(400)
    const missing = await engine.request({
      method: 'GET',
      path: '/accounting/general-ledger?accountId=00000000-0000-4000-8000-000000000000',
    })
    expect(missing.status).toBe(404)
  })

  it('a sale whose cost is unknown has NO profit — null, never 0', async () => {
    const invoice = await sell(uncostedProductId, 2, 200)
    const reports = (
      await engine.request<
        Array<{
          currency: string
          totals: { cost: number; grossProfit: number | null; costStatus: string }
        }>
      >({
        method: 'GET',
        path: `/accounting/profit-report/by-currency?from=${today}&to=${today}`,
      })
    ).data
    const afn = reports.find((r) => r.currency === 'AFN')!
    expect(afn.totals.grossProfit).toBeNull()
    expect(['partial', 'unknown']).toContain(afn.totals.costStatus)

    const evidence = (
      await engine.request<{
        grossProfit: number | null
        warnings: string[]
        netSales: number
      }>({ method: 'GET', path: `/accounting/evidence/invoices/${invoice.id}` })
    ).data
    expect(evidence.grossProfit).toBeNull()
    expect(evidence.warnings).toContain('COST_MISSING')
    expect(evidence.netSales).toBe(400)
  })

  it('the evidence chain adds up to the profit report', async () => {
    const invoice = await sell(productId, 10, 65)
    const evidence = (
      await engine.request<{
        netSales: number
        cost: number
        grossProfit: number | null
        paidTotal: number
        ledger: Array<{ status: string }>
        lines: Array<{ sources: Array<{ layer: { sourceType: string } | null }> }>
      }>({ method: 'GET', path: `/accounting/evidence/invoices/${invoice.id}` })
    ).data
    expect(evidence.netSales).toBe(650)
    expect(evidence.cost).toBe(500)
    expect(evidence.grossProfit).toBe(150)
    expect(evidence.ledger.some((j) => j.status === 'posted')).toBe(true)
    // The cost came from a layer, and the layer says what created it.
    expect(evidence.lines[0]?.sources[0]?.layer?.sourceType).toBeTruthy()
  })

  it("a product's journey says what was bought, sold and is left", async () => {
    await sell(productId, 10, 65)
    const journey = (
      await engine.request<{
        bought: { quantity: number }
        sold: { quantity: number; cost: number }
        onHand: { quantity: number }
        profit: number | null
      }>({
        method: 'GET',
        path: `/accounting/evidence/products/${productId}?fromDate=${today}&toDate=${today}&currency=AFN`,
      })
    ).data
    expect(journey.bought.quantity).toBe(100)
    expect(journey.sold.quantity).toBe(10)
    expect(journey.sold.cost).toBe(500)
    expect(journey.onHand.quantity).toBe(90)
    expect(journey.profit).toBe(150)

    const noCurrency = await engine.request({
      method: 'GET',
      path: `/accounting/evidence/products/${productId}?fromDate=${today}&toDate=${today}`,
    })
    expect(noCurrency.status).toBe(400)
  })

  it('rejects a reversed range', async () => {
    const res = await engine.request({
      method: 'GET',
      path: '/accounting/profit-report/by-currency?from=2026-10-10&to=2026-10-01',
    })
    expect(res.status).toBe(400)
  })
})
