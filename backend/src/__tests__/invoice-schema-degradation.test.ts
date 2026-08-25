// ============================================
// A database that is behind on a migration must not look like a missing
// invoice.
//
// The bug this pins: `getById` selected `public_token`, the item unit columns
// and the embedded `invoice_item_details` table unconditionally. On an
// environment where `docs/unified-sale-purchase-migration.sql` had not run,
// Postgres answered "column does not exist" — an *error*, not an empty result —
// so the method threw NotFound. That produced two production symptoms:
//
//   GET  /api/invoices/:id  → 404 for invoices that plainly exist
//   POST /api/invoices      → 500 "Invoice not found"
//
// The POST case was the damaging one: `create()` ends with `getById()`, so the
// invoice was written and *then* the request failed. Users retried and created
// duplicates.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const single = vi.fn()
const eqUser = vi.fn(() => ({ single }))
const eqId = vi.fn(() => ({ eq: eqUser }))
const select = vi.fn((_columns: string) => ({ eq: eqId }))

vi.mock('../db', () => ({
  supabase: { from: vi.fn(() => ({ select })) },
}))

const { InvoiceService } = await import('../services/invoice.service')

/** What PostgREST returns for a column the schema does not have. */
const missingColumn = (name: string) => ({
  data: null,
  error: { code: '42703', message: `column invoice_items.${name} does not exist` },
})

/** What PostgREST returns for an embedded table it cannot find. */
const missingRelation = {
  data: null,
  error: {
    code: 'PGRST200',
    message: "Could not find a relationship between 'invoice_items' and 'invoice_item_details'",
  },
}

const invoiceRow = {
  id: 'inv-1',
  invoice_number: 'INV-001',
  type: 'purchase',
  total: 5000,
  customer: { full_name: 'مجید طلافروش' },
  invoice_items: [{ id: 'item-1', product_name: 'گردنبند', quantity: 1 }],
}

/**
 * The service now takes an authorized TenancyContext rather than a bare user
 * id — the workspace is the tenancy boundary, and the type is what stops a
 * route from calling in without having resolved one.
 */
const CTX = { workspaceId: 'workspace-1', userId: 'user-1', role: 'owner' } as const

describe('getById on a database behind on migrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    single.mockReset()
    select.mockClear()
  })

  it('returns the invoice after dropping a missing embedded details table', async () => {
    single
      .mockResolvedValueOnce(missingRelation)
      .mockResolvedValueOnce({ data: invoiceRow, error: null })

    const service = new InvoiceService()
    const invoice = await service.getById('inv-1', CTX)

    expect(invoice.id).toBe('inv-1')
    expect(invoice.customerName).toBe('مجید طلافروش')
  })

  it('stops asking for the missing table on later reads', async () => {
    // The retry is remembered for the process. Paying a failed round-trip on
    // every single read would turn a migration gap into a latency problem.
    single.mockResolvedValue({ data: invoiceRow, error: null })

    const service = new InvoiceService()
    await service.getById('inv-2', CTX)

    expect(select).toHaveBeenCalledTimes(1)
    expect(select.mock.calls[0]?.[0]).not.toContain('invoice_item_details')
  })

  it('degrades again for a different missing column rather than throwing', async () => {
    single
      .mockResolvedValueOnce(missingColumn('weight_grams'))
      .mockResolvedValueOnce({ data: invoiceRow, error: null })

    const service = new InvoiceService()
    await expect(service.getById('inv-3', CTX)).resolves.toMatchObject({ id: 'inv-1' })
  })

  it('still reports NotFound when the invoice genuinely does not exist', async () => {
    // Degradation must not swallow a real miss — an id belonging to another
    // workspace has to stay a 404, or the tenant boundary reads as a server bug.
    single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } })

    const service = new InvoiceService()
    await expect(service.getById('nope', CTX)).rejects.toThrow()
  })
})
