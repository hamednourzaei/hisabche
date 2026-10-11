// ============================================
// Importing invoices, over real HTTP — scan, dry run, commit, a second run of
// the same file, and the way back.
//
// The one thing replaced here is `InvoiceService.create` / `.delete`: what an
// invoice DOES when it is created (numbering, stock, the ledger, the payment)
// is that service's and is tested there. What this file owns is the seam:
// that the importer hands it the right documents, once each, and undoes them
// through it and not around it.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'miginv-token-owner' }
const SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as any).__migInvFakeDb)

const AHMAD = fakeId('customer')
const TEA = fakeId('product')

// A report as a shop really exports it: a title, a blank line, then one row
// per LINE with the invoice number repeated, Solar Hijri dates, Persian digits.
const SALES = [
  'فروشگاه نور,,,,,,',
  ',,,,,,',
  'شماره فاکتور,تاریخ,نام مشتری,نام کالا,تعداد,فی,پرداخت شده',
  '1001,۱۴۰۵/۰۷/۱۹,احمد,چای,2,150,390',
  '1001,۱۴۰۵/۰۷/۱۹,احمد,قند,1,90,',
  '1002,۱۴۰۵/۰۷/۲۰,احمد,چای,1,150,0',
  '1003,۱۴۰۵/۰۷/۲۰,ناشناس,چای,1,150,0',
].join('\n')

interface CreateCall {
  body: Record<string, any>
  requestId: string | null
}
const created: CreateCall[] = []
const deleted: string[] = []

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0
  created.length = 0
  deleted.length = 0

  db.seed('workspace_members', [
    {
      id: fakeId('member'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])
  db.seed('customers', [{ id: AHMAD, workspace_id: SHOP, full_name: 'احمد', phone: '0700123456' }])
  db.seed('products', [{ id: TEA, workspace_id: SHOP, name: 'چای', sku: 'T-1', barcode: '' }])
  db.seed('migration_jobs', [])
  db.seed('migration_records', [])
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__migInvFakeDb = createFakeDb(db, users)
  db.unique('migration_records', ['workspace_id', 'source_entity_type', 'source_identity'])

  const { InvoiceService } = await import('../services/invoice.service')
  vi.spyOn(InvoiceService.prototype, 'create').mockImplementation((async (
    _ctx: unknown,
    body: Record<string, any>,
    _branch: unknown,
    options: { clientRequestId?: string | null } = {},
  ) => {
    // The same promise the real service makes: one invoice per request id.
    const seen = created.findIndex((call) => call.requestId === options.clientRequestId)
    if (seen >= 0) return { id: `invoice-${seen + 1}`, idempotentReplay: true }
    created.push({ body, requestId: options.clientRequestId ?? null })
    return { id: `invoice-${created.length}` }
  }) as never)
  vi.spyOn(InvoiceService.prototype, 'delete').mockImplementation((async (id: string) => {
    deleted.push(id)
  }) as never)

  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

const headers = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP }
const post = (url: string, payload: Record<string, unknown> = {}) =>
  app.inject({ method: 'POST', url: `/api/migrations${url}`, headers, payload })

/** Inspect → scan, the way the screen does it: nobody says what the file is. */
async function scan(text: string) {
  const looked = await post('/inspect', { filename: 'sales.csv', content: text })
  expect(looked.statusCode, looked.body).toBe(200)
  const seen = JSON.parse(looked.body)

  const scanned = await post('', {
    entity: seen.detection.entity,
    sourceType: seen.sourceType,
    filename: 'sales.csv',
    content: seen.content,
  })
  expect(scanned.statusCode, scanned.body).toBe(201)
  return { seen, job: JSON.parse(scanned.body), content: seen.content as string }
}

describe('importing invoices', () => {
  it('⚠️ the file is recognised as invoices, under its title, without being told', async () => {
    const { seen, job } = await scan(SALES)

    expect(seen.detection.entity).toBe('invoice')
    expect(seen.skippedRows).toBe(2)
    expect(job.entity).toBe('invoice')
    expect(job.mapping).toMatchObject({ invoiceNumber: 0, date: 1, customerName: 2, itemName: 3 })
    expect(created).toHaveLength(0)
  })

  it('the dry run counts INVOICES, names the one it cannot place, and creates nothing', async () => {
    const { job, content } = await scan(SALES)
    const response = await post(`/${job.id}/dry-run`, { content })
    expect(response.statusCode, response.body).toBe(200)
    const body = JSON.parse(response.body)

    // Four rows of 1001–1002 are two invoices; 1003 names a customer nobody has.
    expect(body.dryRun).toMatchObject({ entity: 'invoice', toCreate: 2, needsReview: 1 })
    // 390 + 150 = 540 → 54,000 minor; 390 of it paid → 39,000.
    expect(body.dryRun.financialImpactMinor).toEqual({ invoiceTotal: 54_000, paid: 39_000 })
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVOICE_CUSTOMER_UNKNOWN', detail: 'ناشناس' }),
        expect.objectContaining({ code: 'INVOICE_PRODUCT_UNMATCHED', detail: 'قند' }),
      ]),
    )
    expect(created).toHaveLength(0)
    expect(db.rows('migration_records')).toHaveLength(0)
  })

  it('⚠️ the commit hands each invoice to the invoice service once, as that service takes it', async () => {
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content })
    const response = await post(`/${job.id}/commit`, { content })
    expect(response.statusCode, response.body).toBe(200)
    expect(JSON.parse(response.body).status).toBe('completed')

    expect(created).toHaveLength(2)
    const [first, second] = created

    expect(first?.body).toMatchObject({
      type: 'sale',
      date: '2026-10-11T00:00:00.000Z',
      customerId: AHMAD,
      total: 390,
      paidAmount: 390,
      reference: '1001',
    })
    expect(first?.body.items).toEqual([
      expect.objectContaining({ productId: TEA, productName: 'چای', quantity: 2, unitPrice: 150 }),
      expect.objectContaining({ productName: 'قند', quantity: 1, unitPrice: 90 }),
    ])
    expect(second?.body).toMatchObject({
      date: '2026-10-12T00:00:00.000Z',
      total: 150,
      reference: '1002',
    })

    // Each carries its own idempotency key, tied to the job.
    expect(first?.requestId).toContain(`mig-${job.id}-`)
    expect(first?.requestId).not.toBe(second?.requestId)

    // And each is written down, so it can be found and undone.
    expect(db.rows('migration_records').map((row) => [row.source_identity, row.target_id])).toEqual(
      [
        ['number:1001', 'invoice-1'],
        ['number:1002', 'invoice-2'],
      ],
    )
  })

  it('⚠️ the same file a second time imports nothing twice', async () => {
    const first = await scan(SALES)
    await post(`/${first.job.id}/dry-run`, { content: first.content })
    await post(`/${first.job.id}/commit`, { content: first.content })

    const again = await scan(SALES)
    const response = await post(`/${again.job.id}/dry-run`, { content: again.content })
    const body = JSON.parse(response.body)

    expect(body.dryRun).toMatchObject({ toCreate: 0, toSkip: 2 })
    expect(created).toHaveLength(2)
  })

  it('⚠️ rolling back undoes each invoice THROUGH the invoice service', async () => {
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content })
    await post(`/${job.id}/commit`, { content })

    const response = await post(`/${job.id}/rollback`)
    expect(response.statusCode, response.body).toBe(200)

    expect(deleted).toEqual(['invoice-1', 'invoice-2'])
    expect(db.rows('migration_records')).toHaveLength(0)
    // Never around it: the importer has no business deleting from `invoices`.
    expect(db.queries.some((query) => query.table === 'invoices')).toBe(false)
  })
})
