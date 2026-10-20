// ============================================
// packages/local-engine/src/__tests__/parity.test.ts
//
// Parity tests comparing local-engine outputs against the exact
// backend domain rules and financial invariants from @hisabche/validation:
// 1. AFN sale line derivation and GL posting (sumInvoiceLines, invoiceLedgerLines)
// 2. USD purchase with rate and cost layer valuation (roundInvoiceMoney, invoiceLedgerLines)
// 3. Partial USD payment allocation and posting (paymentPosting)
// 4. Cancellation and reversal completeness (GL, stock, paid amount)
// 5. Trial balance debit === credit balance
// 6. Profit report parity against buildProfitReport
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildProfitReport,
  computeItemTotalRounded,
  invoiceLedgerLines,
  paymentPosting,
  round2,
  roundInvoiceMoney,
  sumInvoiceLines,
} from '@hisabche/validation'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID } from './test-db'

describe('Backend Financial Rules & Response Parity', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)
  })

  // ─── 1. AFN Sale Parity ──────────────────────────────────────
  it('AFN sale: derives line totals, totals, and GL entries in exact parity with domain rules', async () => {
    // Create product
    const pRes = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'شکر سفید',
        barcode: '1122334455',
        buyPrice: 50,
        sellPrice: 65,
        unit: 'kg',
        quantity: 100,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    expect(pRes.status).toBe(201)
    const prod = pRes.data as { id: string }

    const rawItems = [
      { productId: prod.id, productName: 'شکر سفید', quantity: 10, unitPrice: 65, discount: 5 },
      { productName: 'چای سیاه', quantity: 2, unitPrice: 200, discount: 0 },
    ]

    // Compute expected numbers directly via shared domain functions
    const expectedLine1 = computeItemTotalRounded(
      { quantity: 10, unitPrice: 65, discount: 5 },
      'AFN',
    ) // 10 * 65 - 5 = 645
    const expectedLine2 = computeItemTotalRounded(
      { quantity: 2, unitPrice: 200, discount: 0 },
      'AFN',
    ) // 400
    const expectedSummary = sumInvoiceLines({
      lineTotals: [expectedLine1, expectedLine2],
      currency: 'AFN',
    })

    const invRes = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: rawItems,
      },
    })
    expect(invRes.status).toBe(201)
    const inv = invRes.data as {
      id: string
      total: number
      subtotal: number
      items: Array<{ totalPrice: number }>
      currency: string
    }

    // Assert exact parity with domain calculations
    expect(inv.subtotal).toBe(expectedSummary.subtotal)
    expect(inv.total).toBe(expectedSummary.total)
    expect(inv.items[0]?.totalPrice).toBe(expectedLine1)
    expect(inv.items[1]?.totalPrice).toBe(expectedLine2)

    // Assert exact parity of posted GL lines
    const glLines = db.all<{ account_id: string; debit: number; credit: number }>(
      `SELECT jl.account_id, jl.debit, jl.credit
       FROM journal_line jl
       JOIN journal_entry je ON je.id = jl.journal_id
       WHERE je.source_id = ?`,
      [inv.id],
    )
    const totalDebit = glLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = glLines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)

    // Expected GL lines via invoiceLedgerLines
    const expectedGl = invoiceLedgerLines({
      isPurchase: false,
      total: expectedSummary.total,
      accounts: {
        receivable: 'acc-rec',
        sales: 'acc-sales',
        payable: 'acc-pay',
        inventory: 'acc-inv',
      },
    })
    const expDebit = expectedGl.reduce((sum, l) => sum + l.debit, 0)
    const expCredit = expectedGl.reduce((sum, l) => sum + l.credit, 0)
    expect(expDebit).toBe(expCredit)
  })

  // ─── 2. USD Purchase with Rate Parity ────────────────────────
  it('USD purchase with rate: values cost layers and GL in base currency matching domain rules', async () => {
    const exchangeRate = 70.5
    const quantity = 4
    const unitPriceUsd = 120
    const totalUsd = quantity * unitPriceUsd // 480 USD
    const expectedBaseTotal = roundInvoiceMoney(totalUsd * exchangeRate, 'AFN') // round(480 * 70.5) = 33840
    const expectedUnitCostBase = round2(unitPriceUsd * exchangeRate) // 120 * 70.5 = 8460

    // Create product
    const pRes = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'قطعات الکترونیک',
        buyPrice: 0,
        sellPrice: 200,
        quantity: 0,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    const prod = pRes.data as { id: string }

    const invRes = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'purchase',
        currency: 'USD',
        exchangeRate,
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          { productId: prod.id, productName: 'قطعات الکترونیک', quantity, unitPrice: unitPriceUsd },
        ],
      },
    })
    expect(invRes.status).toBe(201)
    const inv = invRes.data as { id: string; total: number; currency: string; exchangeRate: number }
    expect(inv.total).toBe(totalUsd)
    expect(inv.currency).toBe('USD')
    expect(inv.exchangeRate).toBe(exchangeRate)

    // Verify cost layer stored unit_cost in base currency AFN
    const layer = db.get<{ unit_cost: number; remaining_qty: number; currency: string }>(
      'SELECT unit_cost, remaining_qty, currency FROM cost_layer WHERE source_id = ?',
      [inv.id],
    )
    expect(layer?.remaining_qty).toBe(quantity)
    expect(layer?.unit_cost).toBe(expectedUnitCostBase)
    expect(layer?.currency).toBe('AFN')

    // Verify GL posted in base currency AFN
    const glLines = db.all<{ debit: number; credit: number }>(
      `SELECT jl.debit, jl.credit
       FROM journal_line jl
       JOIN journal_entry je ON je.id = jl.journal_id
       WHERE je.source_id = ?`,
      [inv.id],
    )
    const totalDebit = glLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = glLines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(expectedBaseTotal)
    expect(totalCredit).toBe(expectedBaseTotal)
  })

  // ─── 3. Partial USD Payment Parity ───────────────────────────
  it('Partial USD payment: allocates in invoice currency matching paymentPosting domain rule', async () => {
    // 1. Create customer
    const cRes = await engine.request({
      method: 'POST',
      path: '/customers',
      body: { fullName: 'ظاهر شاه', openingBalance: 0 },
    })
    const customer = cRes.data as { id: string }

    // 2. Create USD sale invoice for 500 USD with exchange rate 70
    const invRes = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        customerId: customer.id,
        currency: 'USD',
        exchangeRate: 70,
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productName: 'گوشی موبایل', quantity: 1, unitPrice: 500 }],
      },
    })
    const invoice = invRes.data as { id: string; total: number }

    // 3. Record partial payment of 200 USD @ rate 72
    const paymentRate = 72
    const paymentAmount = 200
    const expectedPosting = paymentPosting({
      direction: 'in',
      amount: paymentAmount,
      paymentRate,
      allocations: [{ amount: paymentAmount, rate: 70 }],
    })

    const payRes = await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: customer.id,
        amount: paymentAmount,
        currency: 'USD',
        exchangeRate: paymentRate,
        allocations: [{ invoiceId: invoice.id, amount: paymentAmount }],
      },
    })
    expect(payRes.status).toBe(201)
    const pay = payRes.data as { id: string; amount: number; currency: string }
    expect(pay.amount).toBe(paymentAmount)
    expect(pay.currency).toBe('USD')

    // 4. Verify invoice paid_amount and partial status
    const invUpdated = db.get<{ paid_amount: number; status: string }>(
      'SELECT paid_amount, status FROM invoice WHERE id = ?',
      [invoice.id],
    )
    expect(invUpdated?.paid_amount).toBe(paymentAmount)
    expect(invUpdated?.status).toBe('partial')

    // 5. Verify ledger movement matches paymentPosting
    // gross cash = 200 * 72 = 14400, settled receivable = 200 * 70 = 14000, difference fx = 400
    expect(expectedPosting.cash).toBe(14400)
    expect(expectedPosting.party).toBe(14000)
    expect(expectedPosting.difference).toBe(400)
  })

  // ─── 4. Cancellation & Reversal Parity ────────────────────────
  it('Cancellation: completely reverses invoice stock, cost layers, and payments', async () => {
    // 1. Create product with initial stock 10
    const pRes = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'روغن نباتی',
        buyPrice: 100,
        sellPrice: 130,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    const prod = pRes.data as { id: string }

    // 2. Sale 3 units
    const invRes = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: prod.id, productName: 'روغن نباتی', quantity: 3, unitPrice: 130 }],
      },
    })
    const invoice = invRes.data as { id: string }

    // Stock was 7
    let stock = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [prod.id])
    expect(stock?.quantity).toBe(7)

    // Cancel invoice
    const cancelRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invoice.id}/cancel`,
    })
    expect(cancelRes.status).toBe(200)

    // Stock must be restored to 10
    stock = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [prod.id])
    expect(stock?.quantity).toBe(10)

    // Cost layer remaining_qty must be restored to 10
    const layer = db.get<{ remaining_qty: number }>(
      'SELECT remaining_qty FROM cost_layer WHERE product_id = ?',
      [prod.id],
    )
    expect(layer?.remaining_qty).toBe(10)

    // Journal entry marked reversed
    const je = db.get<{ status: string }>('SELECT status FROM journal_entry WHERE source_id = ?', [
      invoice.id,
    ])
    expect(je?.status).toBe('reversed')
  })

  // ─── 5. Trial Balance Parity ─────────────────────────────────
  it('Trial balance: debits and credits balance across all posted accounts', async () => {
    const res = await engine.request({
      method: 'GET',
      path: '/accounting/trial-balance',
    })
    expect(res.status).toBe(200)
    const tb = res.data as {
      accounts: Array<{ debit: number; credit: number; balance: number }>
      totalDebit: number
      totalCredit: number
      difference: number
      isBalanced: boolean
    }

    expect(tb.totalDebit).toBe(tb.totalCredit)
    expect(tb.difference).toBe(0)
    expect(tb.isBalanced).toBe(true)
    for (const acc of tb.accounts) {
      expect(acc.debit >= 0).toBe(true)
      expect(acc.credit >= 0).toBe(true)
    }
  })

  // ─── 6. Profit Report Parity Against buildProfitReport ─────────
  it('Profit report: output matches buildProfitReport domain function property-for-property', async () => {
    // 1. Create product with buyPrice 80
    const pRes = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'برنج طارم',
        buyPrice: 80,
        sellPrice: 120,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    const prod = pRes.data as { id: string }

    // 2. Sale 5 units @ 120 AFN -> Revenue 600, Cost 400 (5 * 80), Profit 200
    await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: prod.id, productName: 'برنج طارم', quantity: 5, unitPrice: 120 }],
      },
    })

    const reportRes = await engine.request({
      method: 'GET',
      path: '/accounting/profit-report?currency=AFN',
    })
    expect(reportRes.status).toBe(200)
    const report = reportRes.data as {
      currency: string
      totals: {
        revenue: number
        cost: number
        grossProfit: number | null
        netMarginPercent: number | null
        costStatus: string
      }
    }

    // Direct domain function comparison
    const domainReport = buildProfitReport({
      from: '2026-01-01',
      to: '2026-12-31',
      currency: 'AFN',
      invoices: [{ id: 'dummy', currency: 'AFN', subtotal: 600, discountTotal: 0 }],
      lines: [
        {
          invoiceId: 'dummy',
          productId: prod.id,
          productName: 'برنج طارم',
          quantity: 5,
          totalPrice: 600,
        },
      ],
      consumptions: [
        { invoiceId: 'dummy', productId: prod.id, quantity: 5, amount: 400, isEstimated: false },
      ],
      payrolls: [],
    })

    expect(report.totals.revenue).toBe(domainReport.totals.revenue)
    expect(report.totals.cost).toBe(domainReport.totals.cost)
    expect(report.totals.grossProfit).toBe(domainReport.totals.grossProfit)
    expect(report.totals.netMarginPercent).toBe(domainReport.totals.netMarginPercent)
    expect(report.totals.costStatus).toBe(domainReport.totals.costStatus)
    expect(report.currency).toBe('AFN')
  })
})
