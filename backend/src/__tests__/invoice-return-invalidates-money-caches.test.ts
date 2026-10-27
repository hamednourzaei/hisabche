// ============================================
// A return changes the customer's statement and balance, the dashboard and
// stock. The route used to answer 201 and leave every cached copy standing for
// minutes (BUG-008, the same failure after a payment).
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

describe('POST /api/invoices/:id/returns', () => {
  const routes = code('../routes/invoice-return.routes.ts')

  it('clears the money caches after the return is created', () => {
    const created = routes.indexOf('service.createReturn(')
    const cleared = routes.indexOf('invalidateMoneyCaches(workspaceId)')
    const answered = routes.indexOf('reply.status(201)')
    expect(created).toBeGreaterThan(-1)
    expect(cleared).toBeGreaterThan(created)
    expect(answered).toBeGreaterThan(cleared)
  })
})

describe('a customer balance counts sale returns', () => {
  it('getBalance adds them as «return» movements to what the view lists', () => {
    const service = code('../services/customer.service.ts')
    expect(service).toContain('saleReturnsOfCustomer(workspaceId, customerId)')
    expect(service).toContain("kind: 'return' as const")
  })

  it('the statement read gets them from the same reader', () => {
    const repository = code('../services/payments/payments.repository.ts')
    expect(repository).toContain(
      'this.returnsOfInvoices(workspaceId, invoices as PartyInvoiceRow[])',
    )
  })
})
