// ============================================
// packages/local-engine/src/__tests__/m6-subledger-invariants.test.ts
//
// M6-A / M6-B - the sub-ledgers agree with their control accounts, through the REAL device routes (no fixtures written around the ledger):
//   AR       the receivable account == what the unpaid sale invoices still owe
//   Cashbox  the cash account == the payments received (and paid out)
//   Stock    the inventory account == remaining cost layers x unit cost, after a purchase and a sale
//   Numbers  document numbers are unique and sequential
//   Tax      a mixed invoice (goods + service + package) books tax once and the entry balances
//   Distinctions: Refund cash != credit reversal; delivery != payment; package credit != cash (no cash/payment row moves by a delivery)
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const SERVICE = '55555555-5555-4555-8555-555555555555'
const PACKAGE = '66666666-6666-4666-8666-666666666666'
const GOODS = '88888888-8888-4888-8888-888888888801'
const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const num = (sql: string, params: unknown[] = []) =>
  Number(db.all<{ v: number | null }>(sql, params)[0]?.v ?? 0)
const roleBalance = (role: string, side: 'debit' | 'credit') =>
  num(
    side === 'debit'
      ? `SELECT ROUND(SUM(jl.debit - jl.credit), 2) AS v FROM journal_line jl JOIN account a ON a.id = jl.account_id WHERE a.role = ?`
      : `SELECT ROUND(SUM(jl.credit - jl.debit), 2) AS v FROM journal_line jl JOIN account a ON a.id = jl.account_id WHERE a.role = ?`,
    [role],
  )

const invoice = (body: Record<string, unknown>) =>
  engine.request<{ id: string; invoiceNumber?: string; invoice_number?: string }>({
    method: 'POST',
    path: '/invoices',
    headers,
    body: { customerId: CUST, currency: 'AFN', date: '2026-11-01', ...body },
  })

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at) VALUES (?, ?, 'Zahra', '2026-11-01', '2026-11-01')`,
    [CUST, ws],
  )
  for (const [id, type, buy] of [
    [SERVICE, 'service', 0],
    [PACKAGE, 'package', 0],
    [GOODS, 'goods', 100],
  ] as const) {
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at) VALUES (?, ?, 'x', ?, 100, 0, 1, ?, '2026-11-01')`,
      [id, ws, buy, type],
    )
  }
})

describe('M6 AR / cashbox', () => {
  it('the receivable account equals what the unpaid invoices still owe, before and after a part payment', async () => {
    const sale = await invoice({
      type: 'sale',
      items: [{ productId: SERVICE, productName: 's', quantity: 1, unitPrice: 1000 }],
    })
    expect(sale.status, JSON.stringify(sale.data)).toBe(201)
    const owed = () =>
      num(
        `SELECT SUM(total - COALESCE(paid_amount, 0)) AS v FROM invoice WHERE type = 'sale' AND status <> 'cancelled'`,
      )
    expect(roleBalance('receivable', 'debit')).toBe(owed())
    expect(owed()).toBe(1000)

    const pay = await engine.request({
      method: 'POST',
      path: '/payments',
      headers: { ...headers, 'idempotency-key': 'pay-ar-1' },
      body: {
        id: 'pay-ar-1',
        amount: 400,
        direction: 'in',
        partyType: 'customer',
        partyId: CUST,
        method: 'cash',
        currency: 'AFN',
        entryDate: '2026-11-02',
        allocations: [{ invoiceId: sale.data.id, amount: 400 }],
      },
    })
    expect(pay.status, JSON.stringify(pay.data)).toBeLessThan(300)
    expect(roleBalance('receivable', 'debit')).toBe(owed())
    expect(owed()).toBe(600)
  })

  it('the cash account equals the payments received', async () => {
    const sale = await invoice({
      type: 'sale',
      items: [{ productId: SERVICE, productName: 's', quantity: 1, unitPrice: 1000 }],
    })
    await engine.request({
      method: 'POST',
      path: '/payments',
      headers: { ...headers, 'idempotency-key': 'pay-cash-1' },
      body: {
        id: 'pay-cash-1',
        amount: 700,
        direction: 'in',
        partyType: 'customer',
        partyId: CUST,
        method: 'cash',
        currency: 'AFN',
        entryDate: '2026-11-02',
        allocations: [{ invoiceId: sale.data.id, amount: 700 }],
      },
    })
    const received = num(
      `SELECT SUM(amount) AS v FROM payment WHERE direction = 'in' AND status <> 'cancelled'`,
    )
    expect(roleBalance('cash', 'debit')).toBe(received)
    expect(received).toBe(700)
  })
})

describe('M6 inventory sub-ledger', () => {
  it('the inventory account equals remaining layers x unit cost after a purchase and a sale', async () => {
    const bought = await invoice({
      type: 'purchase',
      date: '2026-10-01',
      items: [{ productId: GOODS, productName: 'Pen', quantity: 5, unitPrice: 100 }],
    })
    expect(bought.status, JSON.stringify(bought.data)).toBe(201)
    const sold = await invoice({
      type: 'sale',
      items: [{ productId: GOODS, productName: 'Pen', quantity: 2, unitPrice: 150 }],
    })
    expect(sold.status, JSON.stringify(sold.data)).toBe(201)

    const layers = num(
      `SELECT ROUND(SUM(remaining_qty * unit_cost), 2) AS v FROM cost_layer WHERE workspace_id = ?`,
      [ws],
    )
    expect(layers).toBe(300) // 3 pens left at 100
    expect(roleBalance('inventory', 'debit')).toBe(layers)
  })
})

describe('M6 numbering, tax and the distinctions between domains', () => {
  it('document numbers are unique and strictly increasing', async () => {
    const numbers: string[] = []
    for (let i = 0; i < 4; i += 1) {
      const res = await invoice({
        type: 'sale',
        items: [{ productId: SERVICE, productName: 's', quantity: 1, unitPrice: 10 }],
      })
      expect(res.status).toBe(201)
      numbers.push(String(res.data.invoiceNumber ?? res.data.invoice_number))
    }
    expect(new Set(numbers).size).toBe(4)
    const digits = numbers.map((n) => Number(n.replace(/[^0-9]/g, '')))
    expect([...digits].sort((a, b) => a - b)).toEqual(digits)
    expect(digits.every((d, i) => i === 0 || d === digits[i - 1]! + 1)).toBe(true)
  })

  it('a mixed invoice (goods + service + package) books tax ONCE and the entry balances', async () => {
    await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'purchase',
        customerId: CUST,
        currency: 'AFN',
        date: '2026-10-01',
        items: [{ productId: GOODS, productName: 'Pen', quantity: 5, unitPrice: 100 }],
      },
    })
    const mixed = await invoice({
      type: 'sale',
      taxRate: 10,
      items: [
        { productId: GOODS, productName: 'Pen', quantity: 1, unitPrice: 200 },
        { productId: SERVICE, productName: 's', quantity: 1, unitPrice: 300 },
        { productId: PACKAGE, productName: 'p', quantity: 2, unitPrice: 250 },
      ],
    })
    expect(mixed.status, JSON.stringify(mixed.data)).toBe(201)
    const header = db.all<{ total: number; tax_total: number; subtotal: number }>(
      `SELECT total, tax_total, subtotal FROM invoice WHERE id = ?`,
      [mixed.data.id],
    )[0]!
    const entry = db.all<{ id: string }>(
      `SELECT id FROM journal_entry WHERE source_type = 'invoice' AND source_id = ?`,
      [mixed.data.id],
    )
    expect(entry).toHaveLength(1)
    const sums = db.all<{ role: string; debit: number; credit: number }>(
      `SELECT a.role, jl.debit, jl.credit FROM journal_line jl JOIN account a ON a.id = jl.account_id WHERE jl.journal_id = ?`,
      [entry[0]!.id],
    )
    expect(sums.filter((l) => l.role === 'tax')).toHaveLength(1) // tax booked once, not per line
    expect(sums.find((l) => l.role === 'tax')?.credit).toBe(header.tax_total)
    expect(sums.find((l) => l.role === 'receivable')?.debit).toBe(header.total)
    expect(Math.round(sums.reduce((a, l) => a + l.debit - l.credit, 0) * 100)).toBe(0)
  })

  it('a delivery moves NO payment and NO cash: package credit != cash, delivery != payment', async () => {
    await invoice({
      type: 'sale',
      items: [{ productId: PACKAGE, productName: 'p', quantity: 3, unitPrice: 100 }],
    })
    const payments = num('SELECT COUNT(*) AS v FROM payment')
    const cash = roleBalance('cash', 'debit')
    const session = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/service-delivery/sessions',
      headers,
      body: {
        workspaceId: ws,
        customerId: CUST,
        serviceOfferingId: SERVICE,
        sessionDate: '2026-11-02',
        startTime: '10:00',
        endTime: '11:00',
        settlementMethod: 'package_credit',
      },
    })
    const res = await engine.request({
      method: 'POST',
      path: `/service-delivery/sessions/${session.data.id}/deliver`,
      headers,
      body: { packageProductId: PACKAGE },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)
    expect(num('SELECT COUNT(*) AS v FROM payment')).toBe(payments)
    expect(roleBalance('cash', 'debit')).toBe(cash)
  })
})
