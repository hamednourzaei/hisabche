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
  branchId: string | null
  requestId: string | null
}
const created: CreateCall[] = []
const deleted: string[] = []
// Loaded after the database stand-in is in place (it reaches the real module graph).
let IMPORT_LIMITS: (typeof import('../services/migration'))['IMPORT_LIMITS']
/** Set by a test to make the Nth create (1-based) fail, as a dropped database call would. */
let failCreateAt = 0
let createAttempts = 0
/** 1 = the books hold what was paid; less = a payment that did not land. */
let paidShare = 1

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0
  created.length = 0
  deleted.length = 0
  failCreateAt = 0
  createAttempts = 0
  paidShare = 1
  IMPORT_LIMITS.invoicesPerRequest = 100
  IMPORT_LIMITS.staleAfterMs = 120_000

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
  db.seed('invoices', [])
  db.seed('invoice_items', [])
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__migInvFakeDb = createFakeDb(db, users)
  db.unique('migration_records', ['workspace_id', 'source_entity_type', 'source_identity'])

  ;({ IMPORT_LIMITS } = await import('../services/migration'))
  const { InvoiceService } = await import('../services/invoice.service')
  vi.spyOn(InvoiceService.prototype, 'create').mockImplementation((async (
    _ctx: unknown,
    body: Record<string, any>,
    branch: string | null,
    options: { clientRequestId?: string | null } = {},
  ) => {
    createAttempts += 1
    if (createAttempts === failCreateAt) throw new Error('connection reset')
    // The same promise the real service makes: one invoice per request id.
    const seen = created.findIndex((call) => call.requestId === options.clientRequestId)
    if (seen >= 0) return { id: `invoice-${seen + 1}`, idempotentReplay: true }
    created.push({ body, branchId: branch, requestId: options.clientRequestId ?? null })
    const id = `invoice-${created.length}`
    db.seed('invoices', [
      { id, workspace_id: SHOP, total: body.total, paid_amount: body.paidAmount * paidShare },
    ])
    db.seed(
      'invoice_items',
      (body.items as unknown[]).map(() => ({ id: fakeId('item'), invoice_id: id })),
    )
    return { id }
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
    const response = await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
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
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
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
    expect(first?.requestId).toMatch(/^mig-inv-[0-9a-f]{32}$/)
    expect(first?.requestId).not.toBe(second?.requestId)

    // And each is written down, so it can be found and undone.
    expect(db.rows('migration_records').map((row) => [row.source_identity, row.target_id])).toEqual(
      [
        ['number:1001|2026-10-11|احمد', 'invoice-1'],
        ['number:1002|2026-10-12|احمد', 'invoice-2'],
      ],
    )
  })

  it('⚠️ the same file a second time imports nothing twice', async () => {
    const first = await scan(SALES)
    await post(`/${first.job.id}/dry-run`, { content: first.content, currency: 'AFN' })
    await post(`/${first.job.id}/commit`, { content: first.content })

    const again = await scan(SALES)
    const response = await post(`/${again.job.id}/dry-run`, {
      content: again.content,
      currency: 'AFN',
    })
    const body = JSON.parse(response.body)

    expect(body.dryRun).toMatchObject({ toCreate: 0, toSkip: 2 })
    expect(created).toHaveLength(2)
  })

  it('⚠️ a commit that dies half-way leaves a job that says so, and what it made is on record', async () => {
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })

    failCreateAt = 2
    const response = await post(`/${job.id}/commit`, { content })

    expect(response.statusCode).toBeGreaterThanOrEqual(500)
    const stored = db.rows('migration_jobs').find((row) => row.id === job.id)
    expect(stored).toMatchObject({ status: 'failed', rows_created: 1 })
    // The one invoice that WAS created is written down — it can be found and undone.
    expect(db.rows('migration_records').map((row) => row.source_identity)).toEqual([
      'number:1001|2026-10-11|احمد',
    ])
    expect(created).toHaveLength(1)
  })

  it('⚠️ giving the same file again finishes the job: the rest is imported, nothing twice', async () => {
    const first = await scan(SALES)
    await post(`/${first.job.id}/dry-run`, { content: first.content, currency: 'AFN' })
    failCreateAt = 2
    await post(`/${first.job.id}/commit`, { content: first.content })
    failCreateAt = 0

    const again = await scan(SALES)
    const dry = JSON.parse(
      (await post(`/${again.job.id}/dry-run`, { content: again.content, currency: 'AFN' })).body,
    )
    // Only the invoice that did not make it is left to do.
    expect(dry.dryRun).toMatchObject({ toCreate: 1, toSkip: 1 })

    const response = await post(`/${again.job.id}/commit`, { content: again.content })
    expect(response.statusCode, response.body).toBe(200)

    expect(created.map((call) => call.body.reference)).toEqual(['1001', '1002'])
    expect(
      db
        .rows('migration_records')
        .map((row) => row.source_identity)
        .sort(),
    ).toEqual(['number:1001|2026-10-11|احمد', 'number:1002|2026-10-12|احمد'])
  })

  it('⚠️ created but never written down (the server died in between): a second run does not make it twice', async () => {
    const first = await scan(SALES)
    await post(`/${first.job.id}/dry-run`, { content: first.content, currency: 'AFN' })
    await post(`/${first.job.id}/commit`, { content: first.content })
    expect(created).toHaveLength(2)
    // What a crash between «created» and «written down» leaves: the invoices
    // exist, and the importer has no record that it made them.
    db.tables.set('migration_records', [])

    const again = await scan(SALES)
    const dry = JSON.parse(
      (await post(`/${again.job.id}/dry-run`, { content: again.content, currency: 'AFN' })).body,
    )
    // With no record, the importer honestly believes both are still to do …
    expect(dry.dryRun.toCreate).toBe(2)
    const response = await post(`/${again.job.id}/commit`, { content: again.content })
    expect(response.statusCode, response.body).toBe(200)

    // … and still two invoices exist, not four: each was recognised by its key,
    // because the key is the document's and not the attempt's.
    expect(created.map((call) => call.body.reference)).toEqual(['1001', '1002'])
    expect(db.rows('migration_records')).toHaveLength(2)
  })

  it('a second commit of the same job is refused, not run again', async () => {
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
    await post(`/${job.id}/commit`, { content })

    const twice = await post(`/${job.id}/commit`, { content })
    expect(twice.statusCode).toBe(409)
    expect(created).toHaveLength(2)
  })

  it('⚠️ after the commit, the books are read back and set beside the file — line by line', async () => {
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
    const body = JSON.parse((await post(`/${job.id}/commit`, { content })).body)

    expect(body.status).toBe('completed')
    // 2 invoices, 3 lines; 390 + 150 = 540; 390 paid; 150 still owed.
    expect(
      Object.fromEntries(
        body.reconciliation.lines.map(
          (line: { measure: string; sourceValue: number; hisabcheValue: number }) => [
            line.measure,
            [line.sourceValue, line.hisabcheValue],
          ],
        ),
      ),
    ).toEqual({
      invoices: [2, 2],
      lines: [3, 3],
      totalMinor: [54_000, 54_000],
      paidMinor: [39_000, 39_000],
      receivableMinor: [15_000, 15_000],
    })
    expect(body.reconciliation.matched).toBe(true)
  })

  it('⚠️ if the books do not hold what the file said, the job does not say «completed»', async () => {
    // The invoices are created, but the payment recorded is half of what the file says.
    paidShare = 0.5
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
    const body = JSON.parse((await post(`/${job.id}/commit`, { content })).body)

    expect(body.status).toBe('completed_with_warnings')
    expect(body.reconciliation.matched).toBe(false)
    const paid = body.reconciliation.lines.find(
      (line: { measure: string }) => line.measure === 'paidMinor',
    )
    expect(paid).toMatchObject({ sourceValue: 39_000, hisabcheValue: 19_500, matched: false })
  })

  it('⚠️ a large import is done in pieces: each request does a bounded part and says where it is', async () => {
    IMPORT_LIMITS.invoicesPerRequest = 1
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })

    const first = JSON.parse((await post(`/${job.id}/commit`, { content })).body)
    expect(first).toMatchObject({ status: 'importing', rowsCreated: 1 })
    expect(created).toHaveLength(1)

    const second = JSON.parse((await post(`/${job.id}/commit`, { content })).body)
    expect(second).toMatchObject({ status: 'completed', rowsCreated: 2 })
    expect(created).toHaveLength(2)
    expect(second.reconciliation.matched).toBe(true)
  })

  it('⚠️ while one request is running a piece, a second one is told so — it does not run beside it', async () => {
    IMPORT_LIMITS.invoicesPerRequest = 1
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
    await post(`/${job.id}/commit`, { content })

    // A piece is in flight: the lease is held and fresh.
    const stored = db.rows('migration_jobs').find((row) => row.id === job.id)!
    stored.error_code = 'MIGRATION_RUNNING'
    stored.updated_at = new Date().toISOString()

    const beside = await post(`/${job.id}/commit`, { content })
    expect(beside.statusCode).toBe(409)
    expect(beside.body).toContain('MIGRATION_BUSY')
    expect(created).toHaveLength(1)
  })

  it('⚠️ a run that died holding the job is taken over, and the import finishes', async () => {
    IMPORT_LIMITS.invoicesPerRequest = 1
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
    await post(`/${job.id}/commit`, { content })

    // The server went down in the middle of the next piece: the lease is still
    // there, and nothing has been heard from it for ten minutes.
    const stored = db.rows('migration_jobs').find((row) => row.id === job.id)!
    stored.error_code = 'MIGRATION_RUNNING'
    stored.updated_at = new Date(Date.now() - 10 * 60_000).toISOString()

    const resumed = JSON.parse((await post(`/${job.id}/commit`, { content })).body)
    expect(resumed).toMatchObject({ status: 'completed', rowsCreated: 2 })
    expect(created).toHaveLength(2)
  })

  it('⚠️ an import left hanging can be closed — as INTERRUPTED, and what it made stays on record', async () => {
    IMPORT_LIMITS.invoicesPerRequest = 1
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
    await post(`/${job.id}/commit`, { content })

    const closed = await post(`/${job.id}/cancel`)
    expect(closed.statusCode, closed.body).toBe(200)
    expect(JSON.parse(closed.body)).toMatchObject({
      status: 'failed',
      errorCode: 'MIGRATION_INTERRUPTED',
    })
    expect(db.rows('migration_records')).toHaveLength(1)

    // And it is closed for good: no piece runs on it afterwards.
    const after = await post(`/${job.id}/commit`, { content })
    expect(after.statusCode).toBe(409)
    expect(created).toHaveLength(1)
  })

  it('⚠️ with no currency on the rows and none chosen, nothing is imported — it is not assumed', async () => {
    const { job, content } = await scan(SALES)
    const body = JSON.parse((await post(`/${job.id}/dry-run`, { content })).body)

    expect(body.dryRun.toCreate).toBe(0)
    expect(body.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVOICE_CURRENCY_REQUIRED' })]),
    )
  })

  const WORDS = [
    'شماره فاکتور,تاریخ,نام مشتری,نام کالا,تعداد,فی,ارز',
    '2001,۱۴۰۵/۰۷/۱۹,احمد,چای,2,150000,تومان',
    '2002,۱۴۰۵/۰۷/۱۹,احمد,چای,1,40,USD',
    '2003,۱۴۰۵/۰۷/۱۹,احمد,چای,1,40,سکه',
    '2004,۱۴۰۵/۰۷/۱۹,احمد,چای,1,40,افغانی',
  ].join('\n')

  it('⚠️ an invoice in a currency other than the books currency is CLOSED — named, not imported', async () => {
    const { job, content } = await scan(WORDS)
    const dry = JSON.parse((await post(`/${job.id}/dry-run`, { content })).body)
    expect(dry.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVOICE_CURRENCY_UNKNOWN', detail: 'سکه' }),
        expect.objectContaining({ code: 'INVOICE_FOREIGN_CURRENCY_CLOSED', detail: 'IRT' }),
        expect.objectContaining({ code: 'INVOICE_FOREIGN_CURRENCY_CLOSED', detail: 'USD' }),
      ]),
    )
    await post(`/${job.id}/commit`, { content })

    // The books here are in AFN (no base currency was ever chosen).
    expect(created.map((call) => [call.body.reference, call.body.currency])).toEqual([
      ['2004', 'AFN'],
    ])
  })

  it('⚠️ «foreign» means «not the books currency of THIS business» — not «not AFN»', async () => {
    db.seed('workspaces', [{ id: SHOP, base_currency: 'IRT' }])
    const { job, content } = await scan(WORDS)
    const dry = JSON.parse((await post(`/${job.id}/dry-run`, { content })).body)
    expect(dry.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVOICE_FOREIGN_CURRENCY_CLOSED', detail: 'AFN' }),
        expect.objectContaining({ code: 'INVOICE_FOREIGN_CURRENCY_CLOSED', detail: 'USD' }),
      ]),
    )
    await post(`/${job.id}/commit`, { content })

    expect(created.map((call) => [call.body.reference, call.body.currency])).toEqual([
      ['2001', 'IRT'],
    ])
  })
  it('⚠️ the warehouse and the branch a row names travel with the invoice', async () => {
    const MAIN = fakeId('warehouse')
    const KABUL = fakeId('branch')
    db.seed('warehouses', [
      { id: MAIN, workspace_id: SHOP, name: 'انبار مرکزی', is_active: true, deleted_at: null },
      {
        id: fakeId('warehouse'),
        workspace_id: SHOP,
        name: 'انبار دوم',
        is_active: true,
        deleted_at: null,
      },
    ])
    db.seed('branches', [{ id: KABUL, workspace_id: SHOP, name: 'شعبه کابل' }])

    const file = [
      'شماره فاکتور,تاریخ,نام مشتری,نام کالا,تعداد,فی,انبار,شعبه',
      '3001,۱۴۰۵/۰۷/۱۹,احمد,چای,2,150,انبار مرکزی,شعبه کابل',
      '3002,۱۴۰۵/۰۷/۱۹,احمد,چای,1,150,,',
      '3003,۱۴۰۵/۰۷/۱۹,احمد,چای,1,150,انبار خیالی,',
    ].join('\n')
    const { job, content } = await scan(file)
    const dry = JSON.parse((await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })).body)

    expect(dry.dryRun).toMatchObject({ toCreate: 1, needsReview: 2 })
    expect(dry.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVOICE_WAREHOUSE_REQUIRED' }),
        expect.objectContaining({ code: 'INVOICE_WAREHOUSE_UNKNOWN', detail: 'انبار خیالی' }),
      ]),
    )

    await post(`/${job.id}/commit`, { content })
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      branchId: KABUL,
      body: { warehouseId: MAIN, currency: 'AFN' },
    })
  })

  it('⚠️ rolling back undoes each invoice THROUGH the invoice service', async () => {
    const { job, content } = await scan(SALES)
    await post(`/${job.id}/dry-run`, { content, currency: 'AFN' })
    await post(`/${job.id}/commit`, { content })

    const response = await post(`/${job.id}/rollback`)
    expect(response.statusCode, response.body).toBe(200)

    expect(deleted).toEqual(['invoice-1', 'invoice-2'])
    expect(db.rows('migration_records')).toHaveLength(0)
    // Never around it: the importer has no business deleting from `invoices`.
    expect(db.queries.some((query) => query.table === 'invoices' && query.op !== 'select')).toBe(
      false,
    )
  })
})
