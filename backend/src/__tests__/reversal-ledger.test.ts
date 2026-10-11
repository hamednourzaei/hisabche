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
    '/api/purchase-orders/:id/receive': none('a goods receipt has no reversing route'),
  },
  'warehouse.routes.ts': {
    '/api/warehouses': proven('DELETE /api/warehouses/:id', 'reverse-guards.test.ts'),
    '/api/stock-transfers': none('corrected by the opposite transfer, not by removal'),
    '/api/warehouses/:id/assign': inert,
  },
  'customer.routes.ts': {
    '/api/customers': proven('DELETE /api/customers/:id', 'reverse-guards.test.ts'),
  },
  'product.routes.ts': {
    '/api/products': proven('DELETE /api/products/:id', 'reverse-guards.test.ts'),
    '/api/products/:id/barcodes': inert,
  },
  'human-resources.routes.ts': {
    '/api/departments': inert,
    '/api/employees': unproven('DELETE /api/employees/:id'),
    '/api/attendance': inert,
    '/api/payrolls': none('a paid payroll is final; nothing reverses its entry'),
    '/api/leaves': inert,
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
    expect(counts).toEqual({ proven: 8, unproven: 14, none: 16, inert: 14 })
  })
})
