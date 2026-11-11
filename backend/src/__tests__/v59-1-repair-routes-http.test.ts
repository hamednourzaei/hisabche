// ============================================
// backend/src/__tests__/v59-1-repair-routes-http.test.ts
//
// Proves V59.1 Repair Tickets & Spare Parts HTTP workflow:
//   1. POST /api/repair-tickets/:id/parts reserves ATP via ReservationService
//   2. POST /api/repair-tickets/:id/parts/:partId/consume refuses when unapproved
//      (`REPAIR_APPROVAL_REQUIRED` via canConsumePartsOnRepair)
//   3. POST /api/repair-tickets/:id/approve + consume settles reservation and issues
//      stock via costing.recordIssue (one stock deduction only)
//   4. POST /api/repair-tickets/:id/bill creates the invoice through InvoiceService.create
//      with splitRepairInvoiceRevenue parts vs labor breakdown
// ============================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

const WS1 = '22222222-2222-4222-8222-222222222221'
const USER1 = '11111111-1111-4111-8111-111111111111'
const CUST1 = '33333333-3333-4333-8333-333333333331'
const WH1 = '44444444-4444-4444-8444-444444444441'
const PROD_PART = '55555555-5555-4555-8555-555555555551'
const TICKET1 = '66666666-6666-4666-8666-666666666661'
const PART1 = '77777777-7777-4777-8777-777777777771'
const RES1 = '88888888-8888-4888-8888-888888888881'
const INV_CREATED = '99999999-9999-4999-8999-999999999991'

const state = {
  ticket: {
    id: TICKET1,
    workspace_id: WS1,
    number: 42,
    customer_id: CUST1,
    serial_id: null as string | null,
    device_label: 'Galaxy S23',
    problem: 'Broken display',
    status: 'diagnosing',
    under_warranty: false,
    customer_approved: false,
    estimate_minor: 50000,
    currency: 'AFN',
    technician_employee_id: null as string | null,
    promised_on: null as string | null,
    invoice_id: null as string | null,
    created_at: '2026-11-11T00:00:00Z',
    updated_at: '2026-11-11T00:00:00Z',
    closed_at: null as string | null,
  },
  parts: [] as Array<Record<string, unknown>>,
}

const reserveMock = vi.fn(async () => ({
  status: 'reserved' as const,
  reservationId: RES1,
  reservationStatus: 'active',
}))
const settleMock = vi.fn(async () => ({ status: 'settled' }))
const releaseMock = vi.fn(async () => ({ status: 'released' }))
const recordIssueMock = vi.fn(async () => ({
  status: 'consumed' as const,
  quantity: 1,
  totalCost: 800,
  shortfall: 0,
}))
const invoiceCreateMock = vi.fn(async (_ctx: unknown, input: unknown) => ({
  id: INV_CREATED,
  ...(input as Record<string, unknown>),
}))

function createBuilder(table: string) {
  const eqs: Array<[string, unknown]> = []
  let patch: Record<string, unknown> | null = null
  let insertRow: Record<string, unknown> | null = null

  const execute = () => {
    if (table === 'repair_tickets') {
      const id = eqs.find(([k]) => k === 'id')?.[1]
      const ws = eqs.find(([k]) => k === 'workspace_id')?.[1]
      if (id !== TICKET1 || ws !== WS1) return { data: null, error: null }
      if (patch) Object.assign(state.ticket, patch)
      return { data: [{ ...state.ticket }], error: null }
    }
    if (table === 'repair_ticket_events') return { data: [], error: null }
    if (table === 'repair_ticket_parts') {
      if (insertRow) {
        const row = {
          id: PART1,
          unit_cost_minor: null,
          consumed_at: null,
          created_at: '2026-11-11T00:00:00Z',
          ...insertRow,
        }
        state.parts.push(row)
        return { data: [row], error: null }
      }
      const matched = state.parts.filter((r) =>
        eqs.every(([k, v]) => (r as Record<string, unknown>)[k] === v),
      )
      if (patch) {
        for (const r of matched) Object.assign(r, patch)
      }
      return { data: matched.map((r) => ({ ...r })), error: null }
    }
    if (table === 'products') {
      return { data: [{ id: PROD_PART, name: 'OLED Screen', sell_price: 1200 }], error: null }
    }
    if (table === 'stock_movements') return { data: [], error: null }
    if (table === 'invoices') {
      // The bill is created through InvoiceService (mocked), and then the ticket
      // links it: the service reads that invoice back to check type and customer.
      const id = eqs.find(([k]) => k === 'id')?.[1]
      const created = invoiceCreateMock.mock.results.length > 0 && id === INV_CREATED
      return {
        data: created
          ? [{ id: INV_CREATED, type: 'sale', customer_id: state.ticket.customer_id }]
          : [],
        error: null,
      }
    }
    return { data: [], error: null }
  }

  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (row: Record<string, unknown>) => {
      insertRow = row
      return builder
    },
    update: (p: Record<string, unknown>) => {
      patch = p
      return builder
    },
    eq: (col: string, val: unknown) => {
      eqs.push([col, val])
      return builder
    },
    in: () => builder,
    not: () => builder,
    order: () => builder,
    limit: () => builder,
    returns: () => builder,
    single: async () => {
      const res = execute()
      const row = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data
      return { data: row, error: res.error }
    },
    maybeSingle: async () => {
      const res = execute()
      const row = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data
      return { data: row, error: res.error }
    },
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(execute()).then(resolve, reject),
  }
  return builder
}

const supabaseMock = {
  from: (table: string) => createBuilder(table),
  rpc: async (fn: string, params: Record<string, unknown>) => {
    if (fn === 'repair_ticket_move') {
      if (state.ticket.status !== params.p_from) return { data: false, error: null }
      state.ticket.status = String(params.p_to)
      if (params.p_invoice_id) state.ticket.invoice_id = String(params.p_invoice_id)
      return { data: true, error: null }
    }
    return { data: null, error: null }
  },
}

vi.mock('../db', () => ({ supabase: supabaseMock }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: vi.fn(async () => 'AFN') }))
vi.mock('../services/inventory/reservation.service', () => ({
  InventoryReservationService: class {
    reserve = reserveMock
    settle = settleMock
    release = releaseMock
  },
}))
// buildServer() loads every route: keep the module's other exports real, override only `costing`.
vi.mock('../services/inventory-costing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/inventory-costing')>()),
  costing: { recordIssue: recordIssueMock },
}))
vi.mock('../services/invoice.service', () => ({
  InvoiceService: class {
    create = invoiceCreateMock
  },
}))
vi.mock('../services/cache', () => ({ invalidateWorkspaceCaches: vi.fn(async () => {}) }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: vi.fn(async () => {}) }))
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
  state.ticket.status = 'diagnosing'
  state.ticket.customer_approved = false
  state.ticket.invoice_id = null
  state.parts = []
  reserveMock.mockClear()
  settleMock.mockClear()
  releaseMock.mockClear()
  recordIssueMock.mockClear()
  invoiceCreateMock.mockClear()
})

describe('V59.1 Repair spare parts ATP reservation, consumption gate, and final bill', () => {
  it('reserves ATP, blocks consumption until customer approves, consumes through costing, and splits final bill', async () => {
    const reserveRes = await app.inject({
      method: 'POST',
      url: `/api/repair-tickets/${TICKET1}/parts`,
      payload: {
        warehouseId: WH1,
        productId: PROD_PART,
        quantity: 1,
        unitPriceMinor: 120000,
      },
    })
    expect(reserveRes.statusCode).toBe(201)
    expect(reserveMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        warehouseId: WH1,
        productId: PROD_PART,
        quantity: 1,
        referenceType: 'repair_ticket',
        referenceId: TICKET1,
      }),
    )

    // Refuses consumption before customer approval (`canConsumePartsOnRepair`).
    const blockedConsume = await app.inject({
      method: 'POST',
      url: `/api/repair-tickets/${TICKET1}/parts/${PART1}/consume`,
      payload: {},
    })
    expect(blockedConsume.statusCode).toBe(400)
    expect(JSON.stringify(blockedConsume.json())).toContain('REPAIR_APPROVAL_REQUIRED')
    expect(recordIssueMock).not.toHaveBeenCalled()

    // Approve, consume part, move ticket to ready, and bill.
    const approved = await app.inject({
      method: 'POST',
      url: `/api/repair-tickets/${TICKET1}/approve`,
      payload: {},
    })
    expect(approved.statusCode).toBe(200)
    expect(approved.json().data.customerApproved).toBe(true)

    const consumed = await app.inject({
      method: 'POST',
      url: `/api/repair-tickets/${TICKET1}/parts/${PART1}/consume`,
      payload: {},
    })
    expect(consumed.statusCode).toBe(200)
    expect(consumed.json().data.status).toBe('consumed')
    expect(settleMock).toHaveBeenCalledTimes(1)
    expect(recordIssueMock).toHaveBeenCalledTimes(1)

    await app.inject({
      method: 'POST',
      url: `/api/repair-tickets/${TICKET1}/status`,
      payload: { status: 'ready' },
    })

    const billed = await app.inject({
      method: 'POST',
      url: `/api/repair-tickets/${TICKET1}/bill`,
      payload: { laborFeeMinor: 50000, paymentMethod: 'cash' },
    })
    expect(billed.statusCode).toBe(201)
    const billBody = billed.json().data
    expect(billBody.revenueSplit).toEqual({
      partsRevenueMinor: 120000,
      laborRevenueMinor: 50000,
      totalRevenueMinor: 170000,
    })
    expect(invoiceCreateMock).toHaveBeenCalledTimes(1)
    // Part line omits productId so warehouse stock is not double-deducted after consumePart.
    const passedItems = (
      invoiceCreateMock.mock.calls[0]?.[1] as { items: Array<Record<string, unknown>> }
    ).items
    expect(passedItems[0]?.productId).toBeUndefined()
    expect(billBody.ticket.status).toBe('delivered')
    expect(billBody.ticket.invoiceId).toBe(INV_CREATED)
  })
})
