// ============================================
// THE LINE TOTAL ON AN INVOICE IS THE SERVER'S ARITHMETIC, NOT THE CLIENT'S.
//
// ---------------------------------------------------------------------------
// ⚠️ THE DEFECT (found 19 Oct 2026, while extracting the money rules for the
// offline edition).
//
// `InvoiceService.buildItemRows` wrote the stored line as
//
//     total_price: item.totalPrice || item.quantity * item.unitPrice
//
// — the request's own line total, with a fallback. The HEADER was already
// derived from the lines (`computeInvoiceMoney`, F2-01), so a request could
// carry a header that footed and lines that did not, and `total_price` was the
// one money figure on the document that nothing recomputed.
//
// It is not a display field. It is read by:
//
//   the profit report   `lineRevenues` shares the invoice's net sales over the
//                       lines by `total_price` — a wrong line moves revenue
//                       between products, and therefore the per-product profit
//   a purchase's cost   `applyCosting` divides it to get the unit cost of the
//                       cost layer, so a made-up line total invents what the
//                       goods cost for ever after
//   the printed invoice what the customer is shown and can be asked to check
//
// Rule 3 of CLAUDE.md: the server derives the amount from the lines, and never
// trusts a total the client sent. `computeItemTotalRounded` (one shared rule,
// used by the header too) is now the only thing that produces it.
//
// ⚠️ WHAT THESE TESTS PROVE. The service is driven with a deliberately wrong
// `totalPrice` and the database is a mock, so «what was written» is a statement
// about real calls: the rows handed to the one-transaction write
// (`invoice_write_document`) carry the derived total, and the request's value
// is nowhere in them. Two currencies with different minor units — USD (2) and
// IQD (3) — because rounding a line is what the currency decides.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The books currency this database answers with, per test. */
let booksCurrency = 'USD'
/** Every `rpc` call the service made, with its arguments. */
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = []

vi.mock('../db', () => {
  const builder = (table: string) => {
    const q: any = {
      select: () => q,
      insert: () => q,
      update: () => q,
      upsert: () => q,
      delete: () => q,
      eq: () => q,
      neq: () => q,
      in: () => q,
      is: () => q,
      gt: () => q,
      gte: () => q,
      lte: () => q,
      or: () => q,
      order: () => q,
      range: () => q,
      limit: () => q,
      maybeSingle: async () => {
        if (table === 'workspaces') return { data: { base_currency: booksCurrency }, error: null }
        if (table === 'customers') return { data: { full_name: 'مشتری' }, error: null }
        return { data: null, error: null }
      },
      single: async () => ({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null, count: 0 }),
    }
    return q
  }
  const supabase = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      return name === 'get_next_invoice_number'
        ? { data: 'INV-000001', error: null }
        : { data: null, error: null }
    },
  }
  return { supabase, default: supabase }
})

const ctx = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'owner',
} as const

const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333'

/** A sale on credit (nothing paid, so no payment is recorded), so the write we
 *  assert on is the whole of what the request reached. */
const sale = (items: Array<Record<string, unknown>>, currency = 'USD') =>
  ({ type: 'sale', currency, customerId: CUSTOMER_ID, items }) as never

beforeEach(() => {
  rpcCalls.length = 0
  booksCurrency = 'USD'
})

/**
 * Runs `create` and returns what was handed to the atomic write.
 *
 * ⚠️ THE MOCK DATABASE HAS NOTHING TO READ BACK, so `create` throws after the
 * write (`getById` on a row that is not there). The write has already happened
 * and is the whole of what these tests are about, so the failure is tolerated —
 * as in `invoice-exchange-rate.test.ts`. A refusal about the money itself is
 * NOT tolerated: it would mean the request never reached the write.
 */
async function writeAttempt(items: Array<Record<string, unknown>>, currency = 'USD') {
  const { InvoiceService } = await import('../services/invoice.service')
  await new InvoiceService().create(ctx, sale(items, currency)).catch((error: Error) => {
    expect(error.message).not.toMatch(/INVOICE_CURRENCY|INVOICE_CREDIT|INVOICE_AMOUNT/)
  })
  const write = rpcCalls.find((call) => call.name === 'invoice_write_document')
  expect(write, 'the invoice document was never written').toBeDefined()
  return {
    rows: (write?.args.p_items ?? []) as Array<Record<string, unknown>>,
    header: (write?.args.p_header ?? {}) as Record<string, unknown>,
  }
}

/** A line the request claims is worth far more than its quantity × price. */
const overclaimed = {
  productName: 'phone',
  quantity: 3,
  unitPrice: 0.335,
  discount: 0,
  details: [],
  // 3 × 0.335 is 1.005, and the rule rounds a line in the currency's smallest
  // unit — 1.01 in USD. The request says 9.99.
  totalPrice: 9.99,
}

describe('the stored line total is derived, and the request’s is ignored', () => {
  it('⚠️ USD: three 0.335s are stored as 1.01, not as the 9.99 the request sent', async () => {
    const { rows } = await writeAttempt([overclaimed])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.total_price).toBe(1.01)
  })

  it('⚠️ the stored lines add up to the stored subtotal — the invoice foots', async () => {
    const { rows, header } = await writeAttempt([overclaimed, overclaimed, overclaimed])

    // Three printed lines of 1.01. Sum-then-round would be 1.005 × 3 = 3.02.
    const lines = rows.reduce((total, row) => total + Math.round(Number(row.total_price) * 100), 0)
    expect(lines).toBe(303)
    expect(Math.round(Number(header.subtotal) * 100)).toBe(lines)
    expect(Math.round(Number(header.total) * 100)).toBe(lines)
  })

  it('⚠️ IQD has three minor units: 3 × 0.0005 is stored as 0.002, not the claimed 0.001', async () => {
    booksCurrency = 'IQD'
    const { rows } = await writeAttempt(
      [
        {
          productName: 'دانه',
          quantity: 3,
          unitPrice: 0.0005,
          discount: 0,
          details: [],
          totalPrice: 0.001,
        },
      ],
      'IQD',
    )
    expect(rows[0]?.total_price).toBe(0.002)
  })

  it('a line’s components count, and the request’s total does not override them', async () => {
    const { rows } = await writeAttempt([
      {
        productName: 'گردنبند',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        details: [
          { title: 'زنجیر', quantity: 1, amount: 2000 },
          { title: 'سنگ', quantity: 2, amount: 500 },
        ],
        totalPrice: 1,
      },
    ])
    // The components ADD to the line: 0 + (1 × 2000) + (2 × 500) = 3000 —
    // not the «1» the request stated as its own total.
    expect(rows[0]?.total_price).toBe(3000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('no path reads a total_price off the request', () => {
  const SERVICE = join(__dirname, '..', 'services', 'invoice.service.ts')
  /** Comments stripped and whitespace flattened: every shape below is discussed
   *  at length in comments, and formatting is not the point. */
  const flat = readFileSync(SERVICE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .split(/\s+/)
    .join(' ')

  const createBody = (() => {
    const start = flat.indexOf('async create( ctx: TenancyContext, data: CreateInvoice')
    expect(start, 'create() not found').toBeGreaterThan(-1)
    const rest = flat.slice(start + 1)
    const next = rest.indexOf('async update(')
    return next === -1 ? rest : rest.slice(0, next)
  })()

  it('⚠️ buildItemRows writes the derived total, not `item.totalPrice || …`', () => {
    expect(flat).not.toContain('total_price: item.totalPrice || item.quantity * item.unitPrice')
    expect(flat).toContain('total_price: item.totalPrice,')
  })

  it('there is exactly one derivation of a line total, and it is the shared rule', () => {
    expect(flat).toContain('totalPrice: computeItemTotalRounded(item, currency)')
    // No second derivation in this file: one call, in `withDerivedLineTotals`.
    expect(flat.split('computeItemTotalRounded(').length - 1).toBe(1)
    // …and it is the shared rule that is imported, not reimplemented.
    expect(flat).toContain('computeInvoiceMoney, computeItemTotalRounded,')
    expect(flat).not.toMatch(/function computeItemTotalRounded|const computeItemTotalRounded/)
  })

  it('⚠️ create() derives the lines once, and the header is totalled from them', () => {
    expect(createBody).toContain(
      'const lines = this.withDerivedLineTotals(data.items ?? [], bookCurrency)',
    )
    expect(createBody).toMatch(/computeInvoiceMoney\(\{ items: lines,/)
  })

  it('⚠️ the cost layers are consumed from the derived lines, never from the request', () => {
    // A purchase's unit cost is `line total ÷ quantity`. Taken from the request,
    // a made-up line total invents the cost of the goods for every later sale.
    expect(createBody).toMatch(
      /this\.applyCosting\( ctx, invoice\.id, String\(data\.type \?\? 'sale'\), lines,/,
    )
    expect(createBody).not.toMatch(/this\.applyCosting\( ctx, invoice\.id,[^)]*data\.items/)
  })

  it('⚠️ an EDITED line is derived too — the edit screen is the same rule', () => {
    const replace = flat.slice(flat.indexOf('private async replaceInvoiceItems('))
    expect(replace).toContain('const lines = this.withDerivedLineTotals(items, currency)')
    expect(replace).toContain('this.buildItemRows(lines, invoiceId')
    // …and the caller passes the invoice's own currency, not the request's.
    expect(flat).toContain('String(currentInvoice?.type ?? ' + "'sale'" + '), invoiceCurrency, {')
  })
})
