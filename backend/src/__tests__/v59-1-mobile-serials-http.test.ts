// ============================================
// backend/src/__tests__/v59-1-mobile-serials-http.test.ts
//
// Proves V59.1 Mobile & Serialized Devices HTTP routes:
//   1. Two competing concurrent hold requests for the same IMEI: strictly 1 succeeds, 1 refuses
//   2. POST /api/operations/serials/holds/release-expired frees expired holds
//   3. POST /api/operations/serials/:id/return invokes InvoiceReturnService.createReturn
//      for financial reversal of the original sale invoice AND routes stock_serials via
//      routeReturnedSerial ('in_stock' for sealed/opened, 'returned' for defective/damaged)
//   4. POST /api/invoices/:id/returns accepts line.serialNumbers and routes sold IMEIs too
// ============================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

const WS1 = '22222222-2222-4222-8222-222222222221'
const USER1 = '11111111-1111-4111-8111-111111111111'
const CUST1 = '33333333-3333-4333-8333-333333333331'
const CUST2 = '33333333-3333-4333-8333-333333333332'
const PROD1 = '44444444-4444-4444-8444-444444444444'
const SER_HOLD = '66666666-6666-4666-8666-666666666661'
const SER_EXP = '66666666-6666-4666-8666-666666666662'
const SER_SOLD = '66666666-6666-4666-8666-666666666663'
const INV1 = '77777777-7777-4777-8777-777777777771'
const LINE1 = '88888888-8888-4888-8888-888888888881'

interface SerialRow {
  id: string
  workspace_id: string
  product_id: string
  serial_number: string
  status: string
  warehouse_id: string | null
  invoice_id: string | null
  sold_on: string | null
  reserved_for_customer_id: string | null
  reserved_until: string | null
}

const serialRows: SerialRow[] = []
const createReturnMock = vi.fn()

function matchFilters(
  rows: SerialRow[],
  eqs: Array<[string, unknown]>,
  ins: Array<[string, unknown[]]>,
  ltes: Array<[string, string]>,
) {
  return rows.filter((row) => {
    const rec = row as unknown as Record<string, unknown>
    for (const [k, v] of eqs) if (rec[k] !== v) return false
    for (const [k, vs] of ins) if (!vs.includes(rec[k])) return false
    for (const [k, ceiling] of ltes) {
      const val = rec[k]
      if (typeof val !== 'string' || val > ceiling) return false
    }
    return true
  })
}

const makeBuilder = (table: string) => {
  const eqs: Array<[string, unknown]> = []
  const ins: Array<[string, unknown[]]> = []
  const ltes: Array<[string, string]> = []
  let patch: Record<string, unknown> | null = null

  const execute = () => {
    if (table === 'customers') {
      const id = eqs.find(([k]) => k === 'id')?.[1]
      const ws = eqs.find(([k]) => k === 'workspace_id')?.[1]
      const valid = ws === WS1 && (id === CUST1 || id === CUST2)
      return { data: valid ? { id } : null, error: null }
    }
    if (table === 'invoices') {
      const id = eqs.find(([k]) => k === 'id')?.[1]
      return {
        data:
          id === INV1
            ? { id: INV1, workspace_id: WS1, customer_id: CUST1, currency: 'AFN', status: 'paid' }
            : null,
        error: null,
      }
    }
    if (table === 'invoice_items') {
      return {
        data: [{ id: LINE1, invoice_id: INV1, product_id: PROD1, quantity: 1 }],
        error: null,
      }
    }
    if (table === 'stock_serials') {
      const matched = matchFilters(serialRows, eqs, ins, ltes)
      if (patch) {
        const updated: SerialRow[] = []
        for (const r of matched) {
          Object.assign(r, patch)
          updated.push({ ...r })
        }
        return { data: updated, error: null }
      }
      return { data: matched.map((r) => ({ ...r })), error: null }
    }
    return { data: [], error: null }
  }

  const builder: Record<string, unknown> = {
    select: () => builder,
    update: (p: Record<string, unknown>) => {
      patch = p
      return builder
    },
    eq: (col: string, val: unknown) => {
      eqs.push([col, val])
      return builder
    },
    in: (col: string, vals: unknown[]) => {
      ins.push([col, vals])
      return builder
    },
    lte: (col: string, ceiling: string) => {
      ltes.push([col, ceiling])
      return builder
    },
    order: () => builder,
    maybeSingle: async () => {
      const res = execute()
      const first = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data
      return { data: first, error: res.error }
    },
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(execute()).then(resolve, reject),
  }
  return builder
}

const supabaseMock = {
  from: (table: string) => makeBuilder(table),
  rpc: async (fn: string, params: Record<string, unknown>) => {
    if (fn === 'serial_hold_with_expiry') {
      const ws = params.p_workspace_id as string
      const sid = params.p_serial_id as string
      const cid = params.p_customer_id as string | null
      const exp = (params.p_expires_at as string | null) ?? null
      const row = serialRows.find((r) => r.workspace_id === ws && r.id === sid)
      if (!row) return { data: null, error: { code: 'P0002', message: 'SERIAL_NOT_FOUND' } }
      if (cid) {
        if (
          row.status === 'reserved' &&
          row.reserved_until &&
          row.reserved_until <= new Date().toISOString()
        ) {
          row.status = 'in_stock'
          row.reserved_for_customer_id = null
          row.reserved_until = null
        }
        if (row.status !== 'in_stock') {
          return {
            data: null,
            error: {
              code: '40001',
              message:
                row.status === 'reserved'
                  ? 'SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER'
                  : 'SERIAL_NOT_IN_STOCK',
            },
          }
        }
        row.status = 'reserved'
        row.reserved_for_customer_id = cid
        row.reserved_until = exp
        return { data: [{ ...row }], error: null }
      }
      if (row.status !== 'reserved') {
        return { data: null, error: { code: '22023', message: 'SERIAL_NOT_HELD' } }
      }
      row.status = 'in_stock'
      row.reserved_for_customer_id = null
      row.reserved_until = null
      return { data: [{ ...row }], error: null }
    }
    if (fn === 'serial_release_expired_holds') {
      const ws = params.p_workspace_id as string
      const nowIso = new Date().toISOString()
      const ids: Array<{ released_id: string }> = []
      for (const row of serialRows) {
        if (
          row.workspace_id === ws &&
          row.status === 'reserved' &&
          row.reserved_until &&
          row.reserved_until <= nowIso
        ) {
          row.status = 'in_stock'
          row.reserved_for_customer_id = null
          row.reserved_until = null
          ids.push({ released_id: row.id })
        }
      }
      return { data: ids, error: null }
    }
    return { data: null, error: { code: '42883', message: 'missing fn' } }
  },
}

vi.mock('../db', () => ({ supabase: supabaseMock }))
vi.mock('../services/cache', () => ({ invalidateWorkspaceCaches: vi.fn(async () => {}) }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: vi.fn(async () => {}) }))
vi.mock('../services/sales/invoice-return.service', () => ({
  InvoiceReturnService: class {
    createReturn = createReturnMock
    refundReturn = vi.fn(async () => ({ id: 'refund-1' }))
  },
}))
vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (req: { userId?: string }) => {
    req.userId = USER1
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (req: { tenancy?: unknown }) => {
    req.tenancy = { workspaceId: WS1, userId: USER1, role: 'owner' }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => {},
}))

let app: FastifyInstance

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

beforeEach(() => {
  createReturnMock.mockReset()
  createReturnMock.mockResolvedValue({ id: 'ret-101', grandTotalMinor: 50000 })
  serialRows.splice(
    0,
    serialRows.length,
    {
      id: SER_HOLD,
      workspace_id: WS1,
      product_id: PROD1,
      serial_number: '356789012345611',
      status: 'in_stock',
      warehouse_id: null,
      invoice_id: null,
      sold_on: null,
      reserved_for_customer_id: null,
      reserved_until: null,
    },
    {
      id: SER_EXP,
      workspace_id: WS1,
      product_id: PROD1,
      serial_number: '356789012345612',
      status: 'reserved',
      warehouse_id: null,
      invoice_id: null,
      sold_on: null,
      reserved_for_customer_id: CUST1,
      reserved_until: new Date(Date.now() - 3600_000).toISOString(),
    },
    {
      id: SER_SOLD,
      workspace_id: WS1,
      product_id: PROD1,
      serial_number: '356789012345613',
      status: 'sold',
      warehouse_id: null,
      invoice_id: INV1,
      sold_on: '2026-11-10',
      reserved_for_customer_id: null,
      reserved_until: null,
    },
  )
})

describe('V59.1 Mobile IMEI holds, expiry, and return-to-reversal HTTP routes', () => {
  it('concurrent two-device hold on same IMEI allows exactly 1 winner and rejects the loser', async () => {
    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/operations/serials/${SER_HOLD}/hold`,
        payload: { customerId: CUST1, holdMinutes: 120 },
      }),
      app.inject({
        method: 'POST',
        url: `/api/operations/serials/${SER_HOLD}/hold`,
        payload: { customerId: CUST2, holdMinutes: 120 },
      }),
    ])
    const statuses = [r1.statusCode, r2.statusCode].sort()
    expect(statuses).toEqual([200, 409])
    const holder = serialRows.find((r) => r.id === SER_HOLD)
    expect(holder?.status).toBe('reserved')
    expect(holder?.reserved_until).toBeTruthy()
  })

  it('POST /api/operations/serials/holds/release-expired clears expired holds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/operations/serials/holds/release-expired',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().releasedIds).toEqual([SER_EXP])
    expect(serialRows.find((r) => r.id === SER_EXP)?.status).toBe('in_stock')
  })

  it('POST /api/operations/serials/:id/return executes invoice return financial reversal and routes defective serial to returned', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/operations/serials/${SER_SOLD}/return`,
      payload: { conditionCode: 'defective' },
    })
    expect(res.statusCode).toBe(200)
    expect(createReturnMock).toHaveBeenCalledTimes(1)
    expect(createReturnMock).toHaveBeenCalledWith(
      WS1,
      expect.objectContaining({
        originalInvoiceId: INV1,
        returnType: 'sale_return',
      }),
    )
    const body = res.json()
    expect(body.routedStatus).toBe('returned')
    expect(serialRows.find((r) => r.id === SER_SOLD)?.status).toBe('returned')
    expect(serialRows.find((r) => r.id === SER_SOLD)?.invoice_id).toBeNull()
  })

  it('POST /api/invoices/:id/returns routes opened IMEI back to in_stock via routeReturnedSerial', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/invoices/${INV1}/returns`,
      payload: {
        returnType: 'sale_return',
        returnNumber: 'RET-201',
        returnDate: '2026-11-11',
        lines: [
          {
            originalLineId: LINE1,
            returnQuantity: 1,
            restockChoice: 'restock',
            conditionCode: 'opened',
            serialNumbers: ['356789012345613'],
          },
        ],
      },
    })
    expect(res.statusCode).toBe(201)
    expect(serialRows.find((r) => r.id === SER_SOLD)?.status).toBe('in_stock')
    expect(serialRows.find((r) => r.id === SER_SOLD)?.invoice_id).toBeNull()
  })
})
