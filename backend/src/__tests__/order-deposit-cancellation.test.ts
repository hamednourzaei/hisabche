// ============================================
// Cancelling an order does not touch the money a customer already gave (V53 4.1).
//
// A deposit is a customer-advance LIABILITY. The order's status is not an input to receiving, applying or
// refunding it, and nothing in the deposit service deletes or reverses a posted movement, so:
//   • cancelling an order never erases an applied amount;
//   • the unapplied remainder of a cancelled order's deposit stays refundable, in full (no cancellation
//     fee is deducted by any code path — retaining a fee is an unmade owner decision, NEEDS_OWNER_DECISION);
//   • a posted receipt/apply/refund is never deleted.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) =>
  readFileSync(join(__dirname, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const service = read('../services/sales/order-deposit.service.ts')
const routes = read('../routes/order-deposit.routes.ts')

describe('order deposits survive the order', () => {
  it('no deposit row is ever deleted', () => {
    expect(service).not.toMatch(/\.delete\(\)/)
    expect(routes).not.toMatch(/fastify\.delete\(/)
    expect(routes).not.toMatch(/\.delete\(\s*['"`]/)
  })

  it('the order status is not an input to receiving, applying or refunding', () => {
    expect(service).not.toMatch(/sales_orders/)
    expect(service).not.toMatch(/order_status|orderStatus|\bcancelled\b/)
  })

  it('no cancellation fee is deducted anywhere: the refund is bounded by the remaining balance only', () => {
    expect(service).not.toMatch(/cancellation_fee|cancelFee|retain/i)
    expect(routes).not.toMatch(/cancellation_fee|cancelFee|retain/i)
  })

  it('the movement history is append-only from the service: no update of an applied or refunded amount', () => {
    expect(service).not.toMatch(
      /\.from\('order_deposit_(applications|refunds)'\)\s*\.(update|delete)\(/,
    )
  })
})
