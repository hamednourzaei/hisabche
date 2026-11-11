// ============================================
// THE WAY BACK, FOR EVERY WAY FORWARD.
//
// The suite had thousands of tests that walk a document forward and almost
// none that walk it back, which is how «delete an invoice» stayed two table
// deletes for as long as it did. This file is the register that makes the
// missing half visible: every POST route in the money and stock route files
// is written down with ONE of four honest answers.
//
//   proven    there is a way back, and a test that starts from the end state,
//             goes back over real HTTP and checks what is left
//   unproven  there is a way back; nothing yet walks it from the end
//   none      there is no way back — and the reason is said
//   inert     the route moves no money and no stock; nothing to undo
//
// ⚠️ A NEW POST ROUTE IN THESE FILES FAILS THIS TEST until somebody decides
// which of the four it is. That is the point: the decision is made when the
// route is written, not found out when a customer deletes something.
//
// `none` is not a pass mark. It is a list of things a person cannot undo
// today, kept where it can be read and shortened.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROUTES = join(__dirname, '..', 'routes')

type Way =
  | { kind: 'proven'; back: string; proof: string }
  | { kind: 'unproven'; back: string }
  | { kind: 'none'; why: string }
  | { kind: 'inert' }

const proven = (back: string, proof: string): Way => ({ kind: 'proven', back, proof })
const unproven = (back: string): Way => ({ kind: 'unproven', back })
const none = (why: string): Way => ({ kind: 'none', why })
const inert: Way = { kind: 'inert' }

/** Route file → its POST paths exactly as written in the file → the way back. */
const LEDGER: Record<string, Record<string, Way>> = {
  'invoice.routes.ts': {
    '/api/invoices': proven('DELETE /api/invoices/:id', 'reverse-invoice.test.ts'),
    // Posting is part of the invoice's own life; undoing the invoice undoes it.
    '/api/invoices/post-unposted': proven('DELETE /api/invoices/:id', 'reverse-invoice.test.ts'),
    '/api/invoices/:id/post-to-ledger': proven(
      'DELETE /api/invoices/:id',
      'reverse-invoice.test.ts',
    ),
    // The cost given to a sale late is its own entry; deleting the sale
    // reverses it with the rest.
    '/api/invoices/:id/cost': proven(
      'DELETE /api/invoices/:id',
      'cost-unknown-is-not-zero.test.ts',
    ),
  },
  'payments.routes.ts': {
    '/': unproven('POST /:id/cancel'),
    '/:id/cancel': inert,
  },
  'transaction.routes.ts': {
    '/api/transactions': unproven('DELETE /api/transactions/:id'),
  },
  'accounting.routes.ts': {
    '/accounts': inert,
    '/journal': unproven('POST /journal/:id/reverse'),
    '/journal/:id/post': unproven('POST /journal/:id/reverse'),
    '/journal/:id/reverse': inert,
    '/year-end/close': none('a closed year has no reopening route'),
    '/month-end': none('a closed month has no reopening route'),
  },
  'pos.routes.ts': {
    '/sessions': proven('DELETE /sessions/:id', 'reverse-till.test.ts'),
    '/sessions/:id/orders': proven('POST /orders/:id/void', 'reverse-guards.test.ts'),
    '/orders/:id/void': inert,
    '/sessions/:id/cash': none('corrected by the opposite cash movement, not by removal'),
    '/sessions/:id/bank-transfer': none('no route reverses a till-to-bank transfer'),
    '/opening-capital': none('corrected by a manual journal entry; a till keeps what was put in'),
    '/sessions/:id/close': none('a counted till is final by design'),
    '/sessions/:id/suspend': unproven('POST /sessions/:id/resume'),
    '/sessions/:id/resume': inert,
  },
  'finance-ops.routes.ts': {
    '/assets': none('an asset can be disposed of, not removed'),
    '/assets/depreciation/run': none('no route reverses a depreciation run'),
    '/assets/:id/dispose': none('a disposal cannot be undone'),
    '/bank/statements': none('an imported statement cannot be removed'),
    '/bank/reconcile': unproven('POST /bank/lines/:id/unmatch'),
    '/bank/lines/:id/unmatch': inert,
    '/currency/revalue': none('no route reverses a revaluation'),
  },
  'late-fees.routes.ts': {
    // The fee is an ordinary invoice and is undone as one — but the assessment
    // row that says «this period was charged» stays, so it cannot be re-charged.
    '/api/invoices/:id/late-fees': unproven('DELETE /api/invoices/:id'),
  },
  'manufacturing.routes.ts': {
    '/api/manufacturing/produce': none('a production run has no reversing route'),
    '/api/work-orders': unproven('PATCH /api/work-orders/:id'),
  },
  'orders.routes.ts': {
    '/api/orders': unproven('POST /api/orders/:id/cancel'),
    '/api/orders/:id/confirm': unproven('POST /api/orders/:id/cancel'),
    '/api/orders/:id/cancel': inert,
    '/api/orders/:id/fulfill': none('no route takes a fulfilment back'),
    '/api/orders/:id/invoice': unproven('DELETE /api/invoices/:id'),
  },
  'purchasing.routes.ts': {
    '/api/purchase-orders': unproven('PATCH /api/purchase-orders/:id'),
    '/api/purchase-orders/from-suggestions': unproven('PATCH /api/purchase-orders/:id'),
    '/api/purchase-orders/:id/receive': none('a goods receipt has no reversing route'),
  },
  'warehouse.routes.ts': {
    '/api/warehouses': proven('DELETE /api/warehouses/:id', 'reverse-guards.test.ts'),
    '/api/stock-transfers': none('corrected by the opposite transfer, not by removal'),
    '/api/warehouses/:id/assign': inert,
    // 10 Nov 2026: a transfer request is cancelled before it ships; once
    // received, it is corrected like a direct transfer — by the opposite one.
    '/api/transfer-requests': unproven('POST /api/transfer-requests/:id/action'),
    '/api/transfer-requests/:id/action': none(
      'a received transfer is corrected by the opposite transfer request',
    ),
  },
  // QA document business packs (10 Nov 2026).
  'variant.routes.ts': {
    '/api/products/:id/variants': none(
      'no route retires a variant yet; past invoice lines name it',
    ),
    '/api/products/:id/variants/matrix': none(
      'no route retires a variant yet; past invoice lines name it',
    ),
    '/api/products/:id/variants/:variantId/stock': unproven(
      'POST /api/products/:id/variants/:variantId/stock',
    ),
  },
  'repair.routes.ts': {
    '/api/repair-tickets': unproven('POST /api/repair-tickets/:id/status'),
    '/api/repair-tickets/:id/status': none(
      'the slip history is append-only; a wrong move is followed by the move back where REPAIR_MOVES allows it',
    ),
    '/api/repair-tickets/:id/approve': inert,
    '/api/repair-tickets/:id/parts': unproven('POST /api/repair-tickets/:id/parts/:partId/release'),
    '/api/repair-tickets/:id/parts/:partId/consume': none(
      'consumed spare parts are stock adjustments reversed only by a stock count',
    ),
    '/api/repair-tickets/:id/parts/:partId/release': inert,
    '/api/repair-tickets/:id/bill': unproven('DELETE /api/invoices/:id'),
  },
  'exchange.routes.ts': {
    '/api/fx/rates': inert,
    '/api/fx/trades': unproven('POST /api/fx/trades/:id/void'),
    '/api/fx/trades/:id/resolve-review': unproven('POST /api/fx/trades/:id/void'),
    '/api/fx/trades/:id/void': none('a void is final; a wrongly voided trade is recorded again'),
    '/api/fx/remittances': unproven('POST /api/fx/remittances/:id/status'),
    '/api/fx/remittances/:id/status': none(
      'a payout is money that left; cancel is possible only before it',
    ),
    '/api/fx/remittances/settle': none(
      'an agent settlement is posted to the general ledger and is never deleted',
    ),
    '/api/fx/reconciliations': inert,
  },
  'salon.routes.ts': {
    '/api/service-resources': unproven('PATCH /api/service-resources/:id'),
    '/api/resource-bookings': unproven('POST /api/resource-bookings/:id/release'),
    '/api/resource-bookings/:id/release': inert,
  },
  'customer.routes.ts': {
    '/api/customers': proven('DELETE /api/customers/:id', 'reverse-guards.test.ts'),
  },
  'product.routes.ts': {
    '/api/products': proven('DELETE /api/products/:id', 'reverse-guards.test.ts'),
    '/api/products/:id/barcodes': inert,
    // A waste record is a stock movement; a mistaken one is corrected by
    // counting the shelf, which records the difference back.
    '/api/products/:id/waste': unproven('POST /api/cycle-counts'),
  },
  'human-resources.routes.ts': {
    '/api/departments': inert,
    '/api/employees': unproven('DELETE /api/employees/:id'),
    '/api/attendance': inert,
    '/api/payrolls': none('a paid payroll is final; nothing reverses its entry'),
    // Re-booking is idempotent per (sourceType, sourceId), so a retry writes no
    // second entry. If the entry itself was wrong, the ledger reverses it.
    '/api/payrolls/:id/book': unproven('POST /journal/:id/reverse'),
    '/api/leaves': inert,
    // V58 (leave-policy-01): the entitlement side. A policy is configuration —
    // no money and no stock moves when it is written, and switching it off is
    // its own undo. The accrual run writes idempotent entitlement rows
    // (unique per employee × type × month); it moves no money and no stock,
    // and the ONE balance reads only what the policy still grants.
    '/api/leave-policies': inert,
    '/api/leaves/accrue': inert,
  },
  'cycle-count.routes.ts': {
    '/api/cycle-counts': unproven('POST /api/cycle-counts/:id/cancel'),
    '/api/cycle-counts/:id/lines': inert,
    '/api/cycle-counts/:id/complete': none('a completed count has adjusted stock for good'),
    '/api/cycle-counts/:id/cancel': inert,
  },
}

const source = (file: string): string =>
  readFileSync(join(ROUTES, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** Every `fastify.<method>('<path>'` in a route file, as «METHOD path». */
function routesOf(file: string): string[] {
  return [
    ...source(file).matchAll(/fastify\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g),
  ].map((match) => `${(match[1] ?? '').toUpperCase()} ${match[2]}`)
}

const allRoutes = new Set(
  [...new Set([...Object.keys(LEDGER), 'invoice.routes.ts'])].flatMap((file) => routesOf(file)),
)

describe('every way forward has a decided way back', () => {
  for (const [file, ways] of Object.entries(LEDGER)) {
    it(`${file}: each POST route is in the register, and nothing in it is stale`, () => {
      const posts = routesOf(file)
        .filter((route) => route.startsWith('POST '))
        .map((route) => route.slice(5))

      expect(
        posts.filter((path) => !(path in ways)),
        `POST routes in ${file} with no decided way back — add them to LEDGER`,
      ).toEqual([])
      expect(
        Object.keys(ways).filter((path) => !posts.includes(path)),
        `LEDGER names routes that ${file} no longer has`,
      ).toEqual([])
    })
  }

  it('a way back that is named is a route that exists', () => {
    const missing: string[] = []
    for (const [file, ways] of Object.entries(LEDGER)) {
      for (const [path, way] of Object.entries(ways)) {
        if ((way.kind === 'proven' || way.kind === 'unproven') && !allRoutes.has(way.back)) {
          missing.push(`${file} ${path} → ${way.back}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('⚠️ «proven» means the test is there and really goes back over HTTP', () => {
    for (const ways of Object.values(LEDGER)) {
      for (const way of Object.values(ways)) {
        if (way.kind !== 'proven') continue
        const path = join(__dirname, way.proof)
        expect(existsSync(path), way.proof).toBe(true)
        const proof = readFileSync(path, 'utf8')
        const method = way.back.split(' ')[0] ?? ''
        // The proof drives the real server, with the method of the way back.
        expect(proof, way.proof).toContain('app.inject(')
        expect(proof, `${way.proof} never sends ${method}`).toContain(`'${method}'`)
      }
    }
  })

  it('«none» always says why', () => {
    for (const ways of Object.values(LEDGER)) {
      for (const way of Object.values(ways)) {
        if (way.kind === 'none') expect(way.why.length).toBeGreaterThan(15)
      }
    }
  })

  it('the count is what the report says it is', () => {
    const counts = { proven: 0, unproven: 0, none: 0, inert: 0 }
    for (const ways of Object.values(LEDGER)) {
      for (const way of Object.values(ways)) counts[way.kind]++
    }
    // Written down so a change to the register is a change someone reads.
    // unproven 16 since 10 Nov 2026: «ثبت ضایعات» (corrected by a stock count).
    // 10 Nov 2026 (business packs): +6 unproven (each undone by its own status
    // or retire route), +6 none (final states), +1 inert (rate board is history).
    // V58 (leave-policy-01): +2 inert — the entitlement side moves no money
    // and no stock; a policy's undo is switching it off.
    // V59 (exchange-02): +1 inert — physical cashbox count snapshot moves no money or stock.
    // V59.1 (exchange-03 + repair-parts-01): +3 unproven (fx resolve-review, repair parts reserve,
    // repair final bill), +2 none (fx agent settle, repair part consume), +2 inert (repair approve, part release).
    // V60 (Slice 7 & Slice 10): +2 unproven (POST /api/resource-bookings, POST /api/purchase-orders/from-suggestions),
    // +1 inert (POST /api/resource-bookings/:id/release).
    expect(counts).toEqual({ proven: 9, unproven: 27, none: 25, inert: 21 })
  })
})
