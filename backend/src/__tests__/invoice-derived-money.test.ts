// ============================================
// MODULE INVOICE — the money is derived, the stock moves once, nothing is
// compensated with a DELETE.
//
// ---------------------------------------------------------------------------
// THE THREE DEFECTS
//
// 1. THE CLIENT DICTATED THE TOTAL, AND THE LEDGER BOOKED IT.
//    `create()` wrote `subtotal`, `discount_total` and `total` straight from
//    the request body, and `createAccountingEntries` booked the journal entry
//    from that same `total`. Nothing recomputed the header from the lines.
//
//    `POST /api/invoices` with items worth 5,000,000 and `"total": 1` removed
//    the full stock, consumed the full cost layers, and booked revenue of ONE
//    — while COGS came from the real consumed cost, making the entry a
//    guaranteed loss and the receivable wrong by the difference. `"total": 0`
//    was worse: `createAccountingEntries` returns early on a non-positive
//    total, so the goods left and nothing at all was booked.
//
//    The same number also fed the APPROVAL THRESHOLD, so `"total": 1` walked
//    past any «above X needs a manager» rule.
//
// 2. AN INVOICE HELD FOR APPROVAL MOVED ITS STOCK TWICE.
//    The approval decision ran AFTER the items block had already called
//    `batchUpdateStock`, and `postApprovedInvoice` called it again on
//    approval. A ten-unit sale removed twenty. A REJECTED invoice still took
//    the goods, while the code's own log line said «ledger and stock
//    deferred».
//
// 3. THE CUSTOMER WAS VERIFIED AFTER THE STOCK HAD MOVED.
//    On a customer from another workspace, `create` had already written the
//    items, their details and the stock movements — then deleted the invoice
//    and threw. The movements pointed at a row that no longer existed and the
//    goods were gone with no document explaining where.
//
// ⚠️ Source-level assertions. The standing rule here is that green tests are
// not proof — proof is real HTTP or a real database. What these lock down is
// that the shapes which produced the bugs cannot return.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { computeInvoiceMoney } from '@hisabche/validation'

const SERVICE = join(__dirname, '..', 'services', 'invoice.service.ts')

/** Comments stripped — every one of these is discussed at length in comments. */
const source = readFileSync(SERVICE, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

/** The body of `create`, up to the next method. */
const createBody = (() => {
  // Signature may wrap across lines (an options parameter was added).
  const start = source.search(/async create\(\s*ctx: TenancyContext,\s*data: CreateInvoice/)
  expect(start, 'create() not found').toBeGreaterThan(-1)
  const rest = source.slice(start + 1)
  const next = rest.search(/\n {2}(?:private |protected )?async \w+\(/)
  return next === -1 ? rest : rest.slice(0, next)
})()

// ─────────────────────────────────────────────────────────────────────────────
describe('computeInvoiceMoney', () => {
  const item = (quantity: number, unitPrice: number, extra?: Partial<{ discount: number }>) => ({
    quantity,
    unitPrice,
    ...extra,
  })

  it('adds the lines up', () => {
    const money = computeInvoiceMoney({ items: [item(2, 1000), item(3, 500)] })
    expect(money.subtotal).toBe(3500)
    expect(money.total).toBe(3500)
  })

  it('applies a per-line discount as a percentage, like the grid does', () => {
    // `computeItemTotal` treats `discount` as a percent of the gross.
    const money = computeInvoiceMoney({ items: [item(1, 1000, { discount: 10 })] })
    expect(money.subtotal).toBe(900)
  })

  it('counts the components of a line', () => {
    // A necklace: chain + stone + workmanship. The custom columns of the grid
    // are persisted as details, and they are part of what the customer pays.
    const money = computeInvoiceMoney({
      items: [
        {
          quantity: 1,
          unitPrice: 0,
          details: [
            { quantity: 1, amount: 2000 },
            { quantity: 2, amount: 500 },
          ],
        },
      ],
    })
    expect(money.subtotal).toBe(3000)
  })

  it('⚠️ a detail with no quantity or amount does not make the invoice NaN', () => {
    // Both are optional on `CreateInvoice`, and `undefined * undefined` is
    // NaN — which would be stored as the invoice total.
    const money = computeInvoiceMoney({ items: [{ quantity: 1, unitPrice: 100, details: [{}] }] })
    expect(Number.isFinite(money.total)).toBe(true)
    expect(money.total).toBe(100)
  })

  it('⚠️ a discount larger than the invoice is clamped, not applied', () => {
    const money = computeInvoiceMoney({ items: [item(1, 1000)], discountTotal: 5000 })
    expect(money.discountTotal).toBe(1000)
    expect(money.total).toBe(0)
  })

  it('⚠️ a negative discount is not a surcharge', () => {
    const money = computeInvoiceMoney({ items: [item(1, 1000)], discountTotal: -500 })
    expect(money.discountTotal).toBe(0)
    expect(money.total).toBe(1000)
  })

  it('taxes the amount AFTER the discount, in that order', () => {
    // subtotal 1000, discount 200, taxable 800, tax 9% = 72, total 872.
    const money = computeInvoiceMoney({
      items: [item(1, 1000)],
      discountTotal: 200,
      taxRate: 9,
    })
    expect(money.taxTotal).toBe(72)
    expect(money.total).toBe(872)
  })

  it('a tax rate wins over a claimed tax amount', () => {
    const money = computeInvoiceMoney({ items: [item(1, 1000)], taxRate: 10, taxTotal: 999_999 })
    expect(money.taxTotal).toBe(100)
  })

  it('a claimed tax amount is used only when no rate is given, and is clamped', () => {
    expect(computeInvoiceMoney({ items: [item(1, 1000)], taxTotal: 50 }).taxTotal).toBe(50)
    expect(computeInvoiceMoney({ items: [item(1, 1000)], taxTotal: -50 }).taxTotal).toBe(0)
  })

  it('a rate above 100 is bounded', () => {
    const money = computeInvoiceMoney({ items: [item(1, 100)], taxRate: 1000 })
    expect(money.taxTotal).toBe(100)
  })

  it('⚠️ no lines means no money, whatever was claimed', () => {
    const money = computeInvoiceMoney({ items: [], discountTotal: 999, taxTotal: 999 })
    expect(money.subtotal).toBe(0)
    expect(money.total).toBe(0)
  })

  it('never returns a negative total', () => {
    const money = computeInvoiceMoney({ items: [item(1, 100)], discountTotal: 100, taxRate: 0 })
    expect(money.total).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('create() uses the derived money everywhere', () => {
  it('⚠️ the header is written from it, not from the request', () => {
    expect(createBody).toMatch(/subtotal: money\.subtotal/)
    expect(createBody).toMatch(/discount_total: money\.discountTotal/)
    expect(createBody).toMatch(/tax_total: money\.taxTotal/)
    expect(createBody).toMatch(/total: money\.total/)
  })

  it("⚠️ the request's own money fields never reach the insert", () => {
    expect(createBody).not.toMatch(/subtotal: data\.subtotal/)
    expect(createBody).not.toMatch(/discount_total: data\.discountTotal/)
    expect(createBody).not.toMatch(/total: data\.total/)
  })

  it('⚠️ the LEDGER books the derived total', () => {
    // Booking `data.total` here is what let a request say «total: 1» on a
    // five-million invoice and have the books believe it.
    expect(createBody).toMatch(/total: money\.total,\s*\n\s*costOfGoodsSold: cogs/)
  })

  it('⚠️ the APPROVAL THRESHOLD is compared against the derived total', () => {
    // Otherwise «anything above X needs a manager» is decided by the number
    // the person trying to get past it supplied.
    // (27 Sep 2026: the decision is decideApprovalRoute, made before any write.)
    expect(createBody).toMatch(/decideApprovalRoute\(ctx, money\.total/)
    expect(createBody).not.toMatch(/decideApprovalRoute\([^)]*data\.total/)
  })

  it('the money is derived before the first write', () => {
    // The first write is the one-transaction document write (27 Sep 2026).
    const firstWrite = createBody.indexOf('this.writeInvoiceDocument(')
    expect(firstWrite).toBeGreaterThan(-1)
    expect(createBody.indexOf('computeInvoiceMoney')).toBeLessThan(firstWrite)
  })
})

describe('stock moves exactly once', () => {
  it('⚠️ creation does not move stock while the document is held', () => {
    // The movements are planned only when not held, and written with the
    // document; held → none (postApprovedInvoice moves them on approval).
    expect(createBody).toMatch(
      /!isHeld && lines\.length > 0\s*\?\s*await this\.planStockMovements\(/,
    )
  })

  it('the approval decision happens before the items block', () => {
    const decision = createBody.indexOf('decideApprovalRoute(')
    expect(decision).toBeGreaterThan(-1)
    expect(decision).toBeLessThan(createBody.indexOf('this.planStockMovements('))
    expect(decision).toBeLessThan(createBody.indexOf('this.writeInvoiceDocument('))
  })

  it('there is exactly one approval decision in create()', () => {
    // Two would be two answers to one question, and the second used the
    // client's total.
    expect(createBody.match(/decideApprovalRoute\(/g)?.length ?? 0).toBe(1)
  })
})

describe('nothing is compensated with a DELETE', () => {
  it('⚠️ create() never deletes the invoice it just wrote', () => {
    // Rule 4: supabase-js has no transactions, so a compensating DELETE is a
    // second write that can fail on its own — not a rollback.
    expect(createBody).not.toMatch(/from\('invoices'\)\s*\n?\s*\.delete\(\)/)
  })

  it('⚠️ the customer is verified before the invoice row exists', () => {
    const check = createBody.indexOf("from('customers')")
    const insert = createBody.indexOf('this.writeInvoiceDocument(')
    expect(check).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(-1)
    expect(check).toBeLessThan(insert)
  })

  it('the customer lookup is scoped to the workspace', () => {
    // Without it a client could attach any customer id to its invoice — a
    // cross-workspace write that also leaked the other shop's customer name.
    const check = createBody.slice(createBody.indexOf("from('customers')"))
    expect(check.slice(0, 300)).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })

  it('a failed items insert says what state was left behind', () => {
    // Only reachable on the pre-migration path; with the migration the whole
    // document rolls back and there is no state to describe.
    expect(source).toMatch(/was saved but its items could not be/)
  })
})
