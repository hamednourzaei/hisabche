// ============================================
// GET /api/transactions/balance/:customerId answers from the one balance definition.
//
// Its private copy read only transactions_view, so sale returns were left out: paid in full,
// one unit returned, and the route said 0 while the ledger said the shop owes 1,400.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(__dirname, '..', 'routes', 'transaction.routes.ts'), 'utf8')
const service = readFileSync(join(__dirname, '..', 'services', 'customer.service.ts'), 'utf8')

describe('customer balance counts sale returns', () => {
  it('the route uses CustomerService.getBalance, not a copy of its arithmetic', () => {
    expect(route).toContain('await customerBalances.getBalance(customerId, request.tenancy)')
    expect(route).not.toContain('partyBalancesByCurrency(')
  })

  it('getBalance includes the sale returns', () => {
    const body = service.slice(service.indexOf('async getBalance('))
    expect(body).toContain('saleReturnsOfCustomer(workspaceId, customerId)')
    expect(body).toContain('...returnMovements')
  })
})
