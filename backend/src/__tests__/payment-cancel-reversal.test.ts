// ============================================
// Target A3: Payment Cancellation Reversal Atomicity & Error Propagation
//
// Asserts that cancelPayment:
// 1. Invokes ledger.reverseDocument BEFORE marking the payment cancelled.
// 2. Propagates any error thrown by ledger.reverseDocument (e.g. PERIOD_CLOSED)
//    without swallowing it via .catch.
// 3. Fails closed so unreversed ledger entries cannot survive.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Target A3: cancelPayment ledger reversal atomicity', () => {
  const serviceFile = join(__dirname, '..', 'services', 'payments', 'payments.service.ts')
  const content = readFileSync(serviceFile, 'utf8')

  it('reverses ledger document before updating payment status in repository', () => {
    const reverseIndex = content.indexOf("await ledger.reverseDocument(ctx, 'payment', paymentId")
    const cancelRepoIndex = content.indexOf('await this.repo.cancelPayment(ctx, paymentId)')

    expect(reverseIndex).toBeGreaterThan(-1)
    expect(cancelRepoIndex).toBeGreaterThan(-1)
    expect(reverseIndex).toBeLessThan(cancelRepoIndex)
  })

  it('does NOT swallow reversal errors with .catch', () => {
    // Assert that .reverseDocument is not followed by .catch in cancelPayment
    const cancelSection = content.slice(
      content.indexOf('async cancelPayment('),
      content.indexOf('// ─── Reports ───'),
    )

    expect(cancelSection).not.toMatch(/reverseDocument[\s\S]*?\.catch\s*\(/)
  })
})
