// ============================================
// A stock-item sheet with its bills of materials, imported over real HTTP.
//
// The sheet has the item on one row and its components on that row and the
// rows under it. The products are created by the importer; each FORMULA is
// handed to `ManufacturingService.saveDefinition` — the path the production
// screen saves through — and that one method is what is stood in for here.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'migbom-token-owner' }
const SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as any).__migBomFakeDb)

const PEN = fakeId('product')

// The layout of an accounting package's «stock item with BoM» sheet.
const SHEET = [
  'Name,Units,Name of BOM,Unit of manufacture,BOM Component - Item Name,BOM Component - Quantity',
  'Stationary Hamper,Nos,Stationary Hamper,1,Pen,10',
  ',,,,Eraser,5',
  ',,,,Pencil,',
  'Gift Hamper,Nos,Gift Hamper,1,Pen,2',
].join('\n')

const saved: Array<{ productId: string; rows: Array<Record<string, any>> }> = []

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0
  saved.length = 0
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
  // One component is already a product, with a buying price; the others are not.
  db.seed('products', [
    { id: PEN, workspace_id: SHOP, name: 'Pen', sku: '', barcode: '', buy_price: 12.5 },
  ])
  db.seed('migration_jobs', [])
  db.seed('migration_records', [])
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__migBomFakeDb = createFakeDb(db, users)
  db.unique('migration_records', ['workspace_id', 'source_entity_type', 'source_identity'])

  const { ManufacturingService } = await import('../services/manufacturing.service')
  vi.spyOn(ManufacturingService.prototype, 'getDefinition').mockImplementation((async (
    _ctx: unknown,
    productId: string,
  ) => (saved.some((entry) => entry.productId === productId) ? { productId } : null)) as never)
  vi.spyOn(ManufacturingService.prototype, 'saveDefinition').mockImplementation((async (
    _ctx: unknown,
    input: { productId: string; rows: Array<Record<string, any>> },
  ) => {
    saved.push({ productId: input.productId, rows: input.rows })
    return { bom_id: fakeId('bom'), version: 1, revised: false }
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

async function scan() {
  const seen = JSON.parse((await post('/inspect', { filename: 'stock.csv', content: SHEET })).body)
  const scanned = await post('', {
    entity: seen.detection.entity,
    sourceType: seen.sourceType,
    filename: 'stock.csv',
    content: seen.content,
  })
  expect(scanned.statusCode, scanned.body).toBe(201)
  return { seen, job: JSON.parse(scanned.body), content: seen.content as string }
}

const idOf = (name: string) => String(db.rows('products').find((row) => row.name === name)?.id)

describe('importing stock items with their formulas', () => {
  it('⚠️ the component columns have somewhere to go: they map themselves', async () => {
    const { seen, job } = await scan()

    expect(seen.detection.entity).toBe('product')
    expect(job.mapping).toMatchObject({ name: 0, unit: 1, bomComponent: 4, bomQuantity: 5 })
  })

  it('the dry run counts the formulas and names what it could not price — and writes nothing', async () => {
    const { job, content } = await scan()
    const body = JSON.parse((await post(`/${job.id}/dry-run`, { content })).body)

    // Two items, each with a formula; the component rows are not products.
    expect(body.dryRun).toMatchObject({ toCreate: 2, boms: 2 })
    const codes = body.findings.map((finding: { code: string }) => finding.code)
    expect(codes.filter((code: string) => code === 'BOM_COMPONENT_ROW')).toHaveLength(2)
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BOM_COMPONENT_UNMATCHED', detail: 'Eraser' }),
        // «Pencil» has no quantity: it is left out, and said to be.
        expect.objectContaining({ code: 'BOM_COMPONENT_NO_QUANTITY', detail: 'Pencil' }),
      ]),
    )
    expect(saved).toHaveLength(0)
    expect(db.rows('products')).toHaveLength(1)
  })

  it('⚠️ the commit creates the items and gives each formula to the production service', async () => {
    const { job, content } = await scan()
    await post(`/${job.id}/dry-run`, { content })
    const response = await post(`/${job.id}/commit`, { content })
    expect(response.statusCode, response.body).toBe(200)

    // The two items — and not «Eraser» or «Pencil» as products.
    expect(
      db
        .rows('products')
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Gift Hamper', 'Pen', 'Stationary Hamper'])

    expect(saved.map((entry) => entry.productId).sort()).toEqual(
      [idOf('Stationary Hamper'), idOf('Gift Hamper')].sort(),
    )
    const hamper = saved.find((entry) => entry.productId === idOf('Stationary Hamper'))
    expect(hamper?.rows).toEqual([
      // In the catalogue: linked, at its current buying price.
      expect.objectContaining({
        productId: PEN,
        values: { description: 'Pen', quantity: '10', unitPrice: '12.5' },
      }),
      // Not in the catalogue: a line of text, with NO invented cost.
      expect.objectContaining({ values: { description: 'Eraser', quantity: '5', unitPrice: '0' } }),
    ])
    expect(hamper?.rows[1]).not.toHaveProperty('productId')
  })

  it('⚠️ opening stock goes INTO the warehouse the row names, as a stock movement — not onto the product row', async () => {
    const MAIN = fakeId('warehouse')
    db.seed('warehouses', [
      { id: MAIN, workspace_id: SHOP, name: 'Main Location', is_active: true, deleted_at: null },
      {
        id: fakeId('warehouse'),
        workspace_id: SHOP,
        name: 'Second',
        is_active: true,
        deleted_at: null,
      },
    ])
    db.seed('stock_movements', [])

    const file = [
      'Product Name,Stock,Warehouse,Sell Price',
      'Tea,40,Main Location,150',
      'Sugar,25,,90',
      'Salt,10,Nowhere,20',
      'Rice,0,,300',
    ].join('\n')
    const seen = JSON.parse((await post('/inspect', { filename: 'p.csv', content: file })).body)
    const job = JSON.parse(
      (
        await post('', {
          entity: 'product',
          sourceType: 'csv',
          filename: 'p.csv',
          content: seen.content,
        })
      ).body,
    )
    const dry = JSON.parse((await post(`/${job.id}/dry-run`, { content: seen.content })).body)

    expect(dry.dryRun.toCreate).toBe(2)
    expect(dry.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PRODUCT_WAREHOUSE_REQUIRED', row: 2 }),
        expect.objectContaining({ code: 'PRODUCT_WAREHOUSE_UNKNOWN', detail: 'Nowhere' }),
      ]),
    )

    const committed = await post(`/${job.id}/commit`, { content: seen.content })
    expect(committed.statusCode, committed.body).toBe(200)

    expect(
      db
        .rows('products')
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Pen', 'Rice', 'Tea'])
    // The forty units are a movement into the named warehouse …
    const movements = db.rows('stock_movements')
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({
      quantity: 40,
      to_warehouse_id: MAIN,
      product_id: idOf('Tea'),
    })
  })

  it('⚠️ a product that already has a formula is left alone: the file twice is one formula', async () => {
    const first = await scan()
    await post(`/${first.job.id}/dry-run`, { content: first.content })
    await post(`/${first.job.id}/commit`, { content: first.content })
    expect(saved).toHaveLength(2)

    const again = await scan()
    await post(`/${again.job.id}/dry-run`, { content: again.content })
    await post(`/${again.job.id}/commit`, { content: again.content })

    expect(saved).toHaveLength(2)
  })
})
