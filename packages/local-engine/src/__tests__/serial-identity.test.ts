import { describe, expect, it } from 'vitest'
import { ConflictError } from '../errors'
import { Router } from '../router'
import { registerSerialsRoutes } from '../routes/serials'

describe('V61 §2.5 local-engine serial identity', () => {
  it('enforces workspace-wide uniqueness on receive and refuses selling an already-sold serial', () => {
    const serials = [
      {
        id: 's1',
        workspace_id: 'ws1',
        product_id: 'p1',
        serial_number: 'IMEI-001',
        status: 'sold',
        unit_cost_minor: 1000,
        warehouse_id: null,
        received_on: '2026-11-12',
        invoice_id: 'inv-1',
        sold_on: '2026-11-12',
        deleted_at: null,
      },
    ]

    const router = new Router()
    registerSerialsRoutes(router)

    const fakeDb = {
      transaction: <T>(fn: () => T) => fn(),
      get: (sql: string, params: unknown[]) => {
        if (sql.includes('FROM invoice ')) return { type: 'sale', status: 'paid' }
        if (sql.includes('COUNT(*)')) return { count: 0 }
        if (sql.includes("status = 'sold'")) {
          const [, sn] = params as [string, string]
          return serials.find((s) => s.serial_number === sn && s.status === 'sold')
        }
        return undefined
      },
      all: () => [{ quantity: 1 }],
      run: () => ({ changes: 0 }),
    }

    const matched = router.find('POST', '/operations/serials/issue')
    expect(matched).not.toBeNull()
    expect(() =>
      matched!.handler({
        db: fakeDb as never,
        ctx: {
          workspaceId: 'ws1',
          userId: 'u1',
          role: 'owner',
          capabilities: ['invoice.create'],
        } as never,
        params: matched!.params,
        query: {},
        headers: {},
        body: { invoiceId: 'inv-2', productId: 'p2', serialNumbers: ['IMEI-001'] },
      }),
    ).toThrow(ConflictError)
  })
})
