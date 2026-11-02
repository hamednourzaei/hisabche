// ============================================
// A return made on the device (offline) — the same document the server makes, recorded and QUEUED.
//
// The device computes the document with the reference function (`buildReturnDocument`), writes header,
// lines, deductions and the outbox row in ONE transaction, and moves NOTHING else: stock, cost layers,
// the ledger and money are applied by the server when the return syncs (one transaction there too).
// Until then the return is "pending sync" — the person sees it, the books do not move twice.
//
// The expected numbers come from `packages/validation/src/__golden__/returns-vectors.json`, written by hand
// from the rule and also run against the real SQL function (backend) and the reference function (validation).
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { endpointAvailability } from '@hisabche/validation'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

interface ReturnVector {
  id: string
  title: string
  fractionDigits: number
  invoice: {
    taxMinor: number
    lines: Array<{ id: string; quantity: number; unitPriceMinor: number; discountMinor: number }>
  }
  request: {
    lines: Array<{ originalLineId: string; quantity: number; conditionCode?: string }>
    deductions?: unknown[]
  }
  expected?: {
    subtotalMinor: number
    discountMinor: number
    taxMinor: number
    deductionMinor: number
    netCreditMinor: number
    lines: Array<{
      originalLineId: string
      subtotalMinor: number
      discountMinor: number
      taxMinor: number
    }>
  }
  expectedError?: string
}

const corpus = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../validation/src/__golden__/returns-vectors.json'),
    'utf8',
  ),
) as { vectors: ReturnVector[] }

const QUEUE = { 'x-hisabche-queue': '1' }
let counter = 0

/** An invoice on the device: MINOR integer units, the shape the local invoice route writes. */
function seedInvoice(
  db: LocalDb,
  seed: {
    taxMinor: number
    lines: Array<{ quantity: number; unitPriceMinor: number; discountMinor: number }>
    type?: 'sale' | 'purchase'
    currency?: string
  },
) {
  counter += 1
  const invoiceId = `inv-${counter}`
  const total = seed.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0)
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, date, currency, subtotal, tax_total, total, status, updated_at)
     VALUES (?, ?, ?, ?, '2026-11-01', ?, ?, ?, ?, 'paid', datetime('now'))`,
    [
      invoiceId,
      TEST_WORKSPACE_ID,
      `INV-${counter}`,
      seed.type ?? 'sale',
      seed.currency ?? 'USD',
      total,
      seed.taxMinor,
      total + seed.taxMinor,
    ],
  )
  const productId = `prod-${counter}`
  db.run(
    `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, updated_at)
     VALUES (?, ?, 'کالا', 10, 100, 200, datetime('now'))`,
    [productId, TEST_WORKSPACE_ID],
  )
  const lineIds = seed.lines.map((line, index) => {
    const lineId = `${invoiceId}-line-${index}`
    db.run(
      `INSERT INTO invoice_item (id, workspace_id, invoice_id, product_id, product_name, quantity, unit_price, discount, total_price, updated_at)
       VALUES (?, ?, ?, ?, 'کالا', ?, ?, ?, ?, datetime('now'))`,
      [
        lineId,
        TEST_WORKSPACE_ID,
        invoiceId,
        productId,
        line.quantity,
        line.unitPriceMinor,
        line.discountMinor,
        line.quantity * line.unitPriceMinor - line.discountMinor,
      ],
    )
    return lineId
  })
  return { invoiceId, productId, lineIds }
}

const count = (db: LocalDb, table: string) =>
  db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]!.n

describe('the golden vectors, through the offline route', () => {
  for (const vector of corpus.vectors) {
    it(`${vector.id}: ${vector.title}`, async () => {
      const db = createTestDb()
      const engine = createTestEngine(db)
      const seeded = seedInvoice(db, {
        taxMinor: vector.invoice.taxMinor,
        lines: vector.invoice.lines,
        currency: vector.fractionDigits === 0 ? 'AFN' : 'USD',
      })
      const lineIdOf = new Map(
        vector.invoice.lines.map((line, index) => [line.id, seeded.lineIds[index]!]),
      )

      const res = await engine.request<Record<string, unknown>>({
        method: 'POST',
        path: `/invoices/${seeded.invoiceId}/returns`,
        headers: QUEUE,
        body: {
          returnType: 'sale_return',
          returnNumber: `R-${vector.id}`,
          returnDate: '2026-11-01',
          deductions: vector.request.deductions,
          lines: vector.request.lines.map((line) => ({
            originalLineId: lineIdOf.get(line.originalLineId),
            quantity: line.quantity,
            restockChoice: 'restock',
            reasonCode: 'other',
            conditionCode: line.conditionCode,
          })),
        },
      })

      if (vector.expectedError) {
        expect(res.status, JSON.stringify(res.data)).toBeGreaterThanOrEqual(400)
        expect(JSON.stringify(res.data)).toContain(vector.expectedError)
        expect(count(db, 'invoice_returns')).toBe(0)
        expect(count(db, 'sync_queue')).toBe(0)
        return
      }

      expect(res.status, JSON.stringify(res.data)).toBe(201)
      const expected = vector.expected!
      expect({
        subtotalMinor: res.data.totalSubtotalMinor,
        discountMinor: res.data.totalDiscountMinor,
        taxMinor: res.data.totalTaxMinor,
        deductionMinor: res.data.deductionMinor,
        netCreditMinor: res.data.grandTotalMinor,
      }).toEqual({
        subtotalMinor: expected.subtotalMinor,
        discountMinor: expected.discountMinor,
        taxMinor: expected.taxMinor,
        deductionMinor: expected.deductionMinor,
        netCreditMinor: expected.netCreditMinor,
      })

      // what was STORED is the same document: `grand_total_minor` is the NET credit, as on the server
      const [header] = db.all<Record<string, number>>(
        'SELECT total_subtotal_minor, total_discount_minor, total_tax_minor, deduction_minor, grand_total_minor FROM invoice_returns',
      )
      expect(Number(header!.grand_total_minor)).toBe(expected.netCreditMinor)
      expect(Number(header!.deduction_minor)).toBe(expected.deductionMinor)
      for (const line of expected.lines) {
        const [row] = db.all<Record<string, number>>(
          'SELECT subtotal_minor, discount_minor, tax_minor FROM invoice_return_lines WHERE original_line_id = ?',
          [lineIdOf.get(line.originalLineId)],
        )
        expect([
          Number(row!.subtotal_minor),
          Number(row!.discount_minor),
          Number(row!.tax_minor),
        ]).toEqual([line.subtotalMinor, line.discountMinor, line.taxMinor])
      }
    })
  }
})

describe('what the device records, and what it leaves to the server', () => {
  const basic = {
    taxMinor: 1000,
    lines: [{ quantity: 5, unitPriceMinor: 2000, discountMinor: 0 }],
  }
  const body = (lineId: string, extra: Record<string, unknown> = {}) => ({
    returnType: 'sale_return',
    returnNumber: 'R-1',
    returnDate: '2026-11-01',
    reasonCode: 'customer_change_of_mind',
    notes: 'opened box',
    deductions: [{ reason: 'return_fee', mode: 'percent', percent: 10 }],
    lines: [
      {
        originalLineId: lineId,
        quantity: 2,
        restockChoice: 'restock',
        reasonCode: 'other',
        conditionCode: 'sealed',
      },
    ],
    ...extra,
  })

  it('writes the document and the outbox row together — and moves no stock, cost, ledger or money', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    const snapshot = () => ({
      stock: db.all<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
        seeded.productId,
      ])[0]!.quantity,
      journal: count(db, 'journal_entry'),
      payments: count(db, 'payment'),
      movements: count(db, 'inventory_movement'),
      layers: count(db, 'cost_layer'),
    })
    const before = snapshot()

    const res = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: { ...QUEUE, 'x-hisabche-user-id': 'user-7' },
      body: body(seeded.lineIds[0]!),
    })
    expect(res.status).toBe(201)

    expect(count(db, 'invoice_returns')).toBe(1)
    expect(count(db, 'invoice_return_lines')).toBe(1)
    expect(count(db, 'invoice_return_deductions')).toBe(1)
    expect(count(db, 'sync_queue')).toBe(1)
    expect(snapshot()).toEqual(before)
  })

  it('the outbox row carries the WHOLE document, owned by the person who made it', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    const res = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: { ...QUEUE, 'x-hisabche-user-id': 'user-7' },
      body: body(seeded.lineIds[0]!),
    })

    const [row] = db.all<{
      client_id: string
      entity: string
      operation: string
      payload: string
      user_id: string
    }>('SELECT client_id, entity, operation, payload, user_id FROM sync_queue')
    expect(row).toMatchObject({
      client_id: res.data.id,
      entity: 'invoice_returns',
      operation: 'create',
      user_id: 'user-7',
    })
    const payload = JSON.parse(row!.payload)
    expect(payload).toMatchObject({
      originalInvoiceId: seeded.invoiceId,
      returnType: 'sale_return',
      returnNumber: 'R-1',
      reasonCode: 'customer_change_of_mind',
      notes: 'opened box',
      deductions: [{ reason: 'return_fee', mode: 'percent', percent: 10 }],
    })
    expect(payload.lines).toEqual([
      expect.objectContaining({
        originalLineId: seeded.lineIds[0],
        quantity: 2,
        conditionCode: 'sealed',
      }),
    ])
  })

  it('without the queue header nothing is queued (the offline edition has no server to send to)', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    const res = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      body: body(seeded.lineIds[0]!),
    })
    expect(res.status).toBe(201)
    expect(count(db, 'invoice_returns')).toBe(1)
    expect(count(db, 'sync_queue')).toBe(0)
  })

  it('one return per invoice — the second is refused and writes nothing', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    const first = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!),
    })
    expect(first.status).toBe(201)

    const second = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!, { returnNumber: 'R-2' }),
    })
    expect(second.status).toBe(409)
    expect(JSON.stringify(second.data)).toContain('INVOICE_ALREADY_RETURNED')
    expect(count(db, 'invoice_returns')).toBe(1)
    expect(count(db, 'sync_queue')).toBe(1)
  })

  it('the same request sent twice is one return (the id is the idempotency key)', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    const send = () =>
      engine.request<{ id: string }>({
        method: 'POST',
        path: `/invoices/${seeded.invoiceId}/returns`,
        headers: QUEUE,
        body: body(seeded.lineIds[0]!, { id: 'ret-fixed-1' }),
      })
    const first = await send()
    const again = await send()
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect(again.data.id).toBe('ret-fixed-1')
    expect(count(db, 'invoice_returns')).toBe(1)
    expect(count(db, 'sync_queue')).toBe(1)
  })

  it('all or nothing: a failure while writing the lines leaves no header, no deduction and no outbox row', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    // a row already holds the id the first line would take
    db.run(
      `INSERT INTO invoice_return_lines (id, workspace_id, return_id, original_line_id, product_id, quantity, restock_choice, reason_code, subtotal_minor, total_minor)
       VALUES ('ret-clash-line-${seeded.lineIds[0]}', ?, 'other-return', 'x', 'p', 1, 'scrap', 'other', 1, 1)`,
      [TEST_WORKSPACE_ID],
    )
    const res = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!, { id: 'ret-clash' }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(count(db, 'invoice_returns')).toBe(0)
    expect(count(db, 'invoice_return_deductions')).toBe(0)
    expect(count(db, 'sync_queue')).toBe(0)
  })

  it('a purchase return carries no tax and refuses deductions', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, { ...basic, type: 'purchase' })
    const refused = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!, { returnType: 'purchase_return' }),
    })
    expect(refused.status).toBeGreaterThanOrEqual(400)
    expect(JSON.stringify(refused.data)).toContain('RETURN_DEDUCTION_NOT_ALLOWED')

    const ok = await engine.request<{ totalTaxMinor: number; grandTotalMinor: number }>({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!, { returnType: 'purchase_return', deductions: undefined }),
    })
    expect(ok.status).toBe(201)
    expect(ok.data.totalTaxMinor).toBe(0)
    expect(ok.data.grandTotalMinor).toBe(4000)
  })

  it('an invoice that is not on the device is not found, and a missing number is refused', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const missing = await engine.request({
      method: 'POST',
      path: '/invoices/nope/returns',
      headers: QUEUE,
      body: body('x'),
    })
    expect(missing.status).toBe(404)

    const seeded = seedInvoice(db, basic)
    const noNumber = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!, { returnNumber: '' }),
    })
    expect(noNumber.status).toBe(400)
    expect(count(db, 'invoice_returns')).toBe(0)
  })

  it('a viewer may not make a return', async () => {
    const db = createTestDb()
    db.run(`UPDATE local_user SET role = 'viewer'`)
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    const res = await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!),
    })
    expect(res.status).toBe(403)
    expect(count(db, 'invoice_returns')).toBe(0)
  })

  it('lists the returns of an invoice in the shape the server lists them, marked pending sync', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const seeded = seedInvoice(db, basic)
    await engine.request({
      method: 'POST',
      path: `/invoices/${seeded.invoiceId}/returns`,
      headers: QUEUE,
      body: body(seeded.lineIds[0]!),
    })
    const res = await engine.request<Array<{ deductions: unknown[]; lines: unknown[] }>>({
      method: 'GET',
      path: `/invoices/${seeded.invoiceId}/returns`,
    })
    expect(res.status).toBe(200)
    expect(res.data).toHaveLength(1)
    expect(res.data[0]).toMatchObject({
      originalInvoiceId: seeded.invoiceId,
      returnType: 'sale_return',
      returnNumber: 'R-1',
      reasonCode: 'customer_change_of_mind',
      notes: 'opened box',
      totalSubtotalMinor: 4000,
      deductionMinor: 400,
      pendingSync: true,
    })
    expect(res.data[0]!.deductions).toEqual([
      { reason: 'return_fee', mode: 'percent', percent: 10, amountMinor: 400, note: '' },
    ])
    expect(res.data[0]!.lines[0]).toMatchObject({
      originalLineId: seeded.lineIds[0],
      conditionCode: 'sealed',
    })
  })
})

describe('what the device does NOT do', () => {
  it('cash refunds stay online-only: no local route, and the matrix says so', async () => {
    const engine = createTestEngine(createTestDb())
    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/invoices/inv-1/returns/ret-1/refunds',
      headers: QUEUE,
      body: { amount: 1, method: 'cash' },
    })
    expect(res.status).toBe(501)
    expect(res.data.code).toBe('OFFLINE_NOT_AVAILABLE')
    expect(endpointAvailability('POST', '/invoices/x/returns/x/refunds')?.status).toBe(
      'online_required',
    )
    expect(endpointAvailability('POST', '/invoices/x/returns')?.status).toBe('available')
  })
})
