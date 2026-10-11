// ============================================
// Opening stock in several warehouses, and updates of records that already
// exist — imported over real HTTP.
//
// Nothing of the product is stood in for here: the importer calls the real
// ProductService and CustomerService, and what is asserted is what they left
// in the tables — one stock movement per (product, warehouse), read back and
// compared with the figure the file gave for THAT warehouse.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'migstock-token-owner' }
const SHOP = fakeId('shop')
const OTHER_SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as any).__migStockFakeDb)

const MAIN = fakeId('warehouse')
const SECOND = fakeId('warehouse')
const FOREIGN = fakeId('warehouse')

let IMPORT_LIMITS: (typeof import('../services/migration'))['IMPORT_LIMITS']

const warehouse = (id: string, name: string, workspace = SHOP) => ({
  id,
  workspace_id: workspace,
  name,
  is_active: true,
  deleted_at: null,
})

function resetWorld(
  warehouses = [warehouse(MAIN, 'Main Warehouse'), warehouse(SECOND, 'Secondary Warehouse')],
) {
  db.tables.clear()
  db.failures.clear()
  db.queries.length = 0
  IMPORT_LIMITS.rowsPerRequest = 1000
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
  // Another business, with a warehouse and a product that share our names.
  db.seed('warehouses', [...warehouses, warehouse(FOREIGN, 'Main Warehouse', OTHER_SHOP)])
  db.seed('products', [
    {
      id: fakeId('product'),
      workspace_id: OTHER_SHOP,
      name: 'Rice',
      sku: 'P-001',
      barcode: '',
      quantity: 7,
    },
  ])
  db.seed('customers', [])
  db.seed('transactions', [])
  db.seed('stock_movements', [])
  db.seed('migration_jobs', [])
  db.seed('migration_records', [])
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__migStockFakeDb = createFakeDb(db, users)
  db.unique('migration_records', ['workspace_id', 'source_entity_type', 'source_identity'])
  ;({ IMPORT_LIMITS } = await import('../services/migration'))
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

async function scan(file: string, entity?: string) {
  const seen = JSON.parse((await post('/inspect', { filename: 'stock.csv', content: file })).body)
  const scanned = await post('', {
    entity: entity ?? seen.detection.entity,
    sourceType: seen.sourceType,
    filename: 'stock.csv',
    content: seen.content,
  })
  expect(scanned.statusCode, scanned.body).toBe(201)
  return { seen, job: JSON.parse(scanned.body), content: seen.content as string }
}

async function run(file: string, entity?: string) {
  const { job, content } = await scan(file, entity)
  const dry = JSON.parse((await post(`/${job.id}/dry-run`, { content })).body)
  const committed = await post(`/${job.id}/commit`, { content })
  return { job, content, dry, committed, done: JSON.parse(committed.body) }
}

const mine = (table: string) => db.rows(table).filter((row) => row.workspace_id === SHOP)
const productId = (name: string) => String(mine('products').find((row) => row.name === name)?.id)

/** What the movements say is where: «product name @ warehouse» → quantity. */
function stockByPlace(): Record<string, number> {
  const names = new Map(db.rows('products').map((row) => [String(row.id), String(row.name)]))
  const places = new Map([
    [MAIN, 'Main'],
    [SECOND, 'Second'],
    [FOREIGN, 'FOREIGN'],
  ])
  const held: Record<string, number> = {}
  for (const row of db.rows('stock_movements')) {
    const key = `${names.get(String(row.product_id))} @ ${places.get(String(row.to_warehouse_id)) ?? 'none'}`
    held[key] = (held[key] ?? 0) + Number(row.quantity)
  }
  return held
}

const lineOf = (job: any, measure: string) =>
  job.reconciliation?.lines.find((line: { measure: string }) => line.measure === measure)

const codesOf = (dry: any): string[] =>
  dry.findings.map((finding: { code: string }) => finding.code)

describe('opening stock in several warehouses', () => {
  it('⚠️ shape A — a row per product and warehouse: ONE product, each warehouse its own figure', async () => {
    const { dry, done } = await run(
      [
        'SKU,Product Name,Warehouse,Stock,Sell Price',
        'P-001,Rice,Main Warehouse,100,90',
        'P-001,Rice,Secondary Warehouse,45,90',
        'P-002,Tea,Secondary Warehouse,12,150',
      ].join('\n'),
    )

    expect(dry.dryRun).toMatchObject({ toCreate: 2, stockUnits: 157, stockPlacements: 3 })
    expect(codesOf(dry)).toContain('STOCK_ROW_FOR_WAREHOUSE')
    expect(codesOf(dry)).not.toContain('DUPLICATE_IN_FILE')

    expect(
      mine('products')
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Rice', 'Tea'])
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100, 'Rice @ Second': 45, 'Tea @ Second': 12 })
    // The figure is NOT also on the product row — the movements are the stock.
    expect(mine('products').map((row) => Number(row.quantity) || 0)).toEqual([0, 0])

    expect(done.status).toBe('completed')
    expect(lineOf(done, 'stockUnits')).toMatchObject({ sourceValue: 157, hisabcheValue: 157 })
    expect(lineOf(done, 'stockPlacements')).toMatchObject({ sourceValue: 3, hisabcheValue: 3 })
  })

  it('shape A with no product code: the same name in two warehouses is one product', async () => {
    await run(
      [
        'Product Name,Warehouse,Stock',
        'Rice,Main Warehouse,100',
        'Rice,Secondary Warehouse,45',
      ].join('\n'),
      'product',
    )
    expect(mine('products')).toHaveLength(1)
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100, 'Rice @ Second': 45 })
  })

  it('⚠️ shape B — a column per warehouse: the columns map themselves to the warehouses', async () => {
    const file = [
      'SKU,Product Name,Main Warehouse,Secondary Warehouse',
      'P-001,Rice,100,45',
      // A blank cell and a zero are «none there», not a movement of nothing.
      'P-002,Tea,,12',
      'P-003,Salt,0,',
    ].join('\n')
    const { job } = await scan(file, 'product')
    expect(job.mapping).toMatchObject({
      [`warehouseStock:${MAIN}`]: 2,
      [`warehouseStock:${SECOND}`]: 3,
    })

    const { done, dry } = await run(file, 'product')
    expect(dry.dryRun).toMatchObject({ toCreate: 3, stockUnits: 157, stockPlacements: 3 })
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100, 'Rice @ Second': 45, 'Tea @ Second': 12 })
    expect(db.rows('stock_movements')).toHaveLength(3)
    expect(done.status).toBe('completed')
    expect(lineOf(done, 'stockPlacements')).toMatchObject({ sourceValue: 3, hisabcheValue: 3 })
  })

  it('shape B with a «total» column: the total is a check, and a wrong one refuses the product', async () => {
    const { dry } = await run(
      [
        'SKU,Product Name,Stock,Main Warehouse,Secondary Warehouse',
        'P-001,Rice,145,100,45',
        'P-002,Tea,50,10,12',
      ].join('\n'),
      'product',
    )
    expect(dry.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PRODUCT_STOCK_TOTAL_MISMATCH', row: 2 }),
      ]),
    )
    expect(mine('products').map((row) => row.name)).toEqual(['Rice'])
    // 145 once — not 145 from the total AND 145 from the columns.
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100, 'Rice @ Second': 45 })
  })

  it('a business with ONE warehouse needs no warehouse column', async () => {
    resetWorld([warehouse(MAIN, 'Main Warehouse')])
    await run(['SKU,Product Name,Stock', 'P-001,Rice,100'].join('\n'), 'product')
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100 })
  })

  it('⚠️ what is refused: unknown warehouse, none named, the same pair twice, a negative figure', async () => {
    const { dry } = await run(
      [
        'SKU,Product Name,Warehouse,Stock',
        'P-001,Rice,Nowhere,100',
        'P-002,Tea,,12',
        'P-003,Salt,Main Warehouse,5',
        'P-003,Salt,Main Warehouse,9',
        'P-004,Oil,Main Warehouse,-3',
        'P-005,Soap,Main Warehouse,8',
        // One of its two warehouses is unknown: NONE of its stock is written.
        'P-006,Flour,Main Warehouse,20',
        'P-006,Flour,Ghost Warehouse,30',
      ].join('\n'),
    )

    expect(dry.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PRODUCT_WAREHOUSE_UNKNOWN', row: 1, detail: 'Nowhere' }),
        expect.objectContaining({ code: 'PRODUCT_WAREHOUSE_REQUIRED', row: 2 }),
        expect.objectContaining({ code: 'DUPLICATE_STOCK_ROW', row: 4 }),
        expect.objectContaining({ code: 'PRODUCT_STOCK_QUANTITY_NEGATIVE', row: 5 }),
        expect.objectContaining({ code: 'PRODUCT_WAREHOUSE_UNKNOWN', row: 8 }),
      ]),
    )
    expect(
      mine('products')
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Salt', 'Soap'])
    // The first of a repeated pair stands; the second is not added to it.
    expect(stockByPlace()).toEqual({ 'Salt @ Main': 5, 'Soap @ Main': 8 })
    // No warehouse was created because a file named one.
    expect(mine('warehouses')).toHaveLength(2)
  })

  it('a stock row in another unit than its product is refused, not converted by guess', async () => {
    const { dry } = await run(
      [
        'SKU,Product Name,Unit,Warehouse,Stock',
        'P-001,Rice,kg,Main Warehouse,100',
        'P-001,Rice,box,Secondary Warehouse,4',
      ].join('\n'),
    )
    expect(codesOf(dry)).toContain('PRODUCT_STOCK_UNIT_MISMATCH')
    expect(mine('products')).toHaveLength(0)
    expect(db.rows('stock_movements')).toHaveLength(0)
  })
})

describe('a separate sheet of stock for products that already exist', () => {
  const STOCK_SHEET = [
    'SKU,Warehouse,Stock',
    'P-001,Main Warehouse,100',
    'P-001,Secondary Warehouse,45',
    'P-002,Main Warehouse,30',
    'P-404,Main Warehouse,9',
  ].join('\n')

  beforeEach(() => {
    db.seed('products', [
      {
        id: fakeId('product'),
        workspace_id: SHOP,
        name: 'Rice',
        sku: 'P-001',
        barcode: '',
        quantity: 0,
      },
      // Already counted and selling: its stock is not this file's to restate.
      {
        id: fakeId('product'),
        workspace_id: SHOP,
        name: 'Tea',
        sku: 'P-002',
        barcode: '',
        quantity: 60,
      },
    ])
  })

  it('⚠️ stock lands on the existing product; one already stocked is left alone; an unknown code is refused', async () => {
    const { dry, done } = await run(STOCK_SHEET, 'product')

    expect(dry.dryRun).toMatchObject({
      toCreate: 0,
      toUpdate: 2,
      stockUnits: 145,
      stockPlacements: 2,
    })
    expect(dry.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PRODUCT_ALREADY_STOCKED', row: 3 }),
        expect.objectContaining({ code: 'PRODUCT_NOT_FOUND_FOR_STOCK', row: 4 }),
      ]),
    )

    // No product was made out of a code and a number.
    expect(mine('products')).toHaveLength(2)
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100, 'Rice @ Second': 45 })
    expect(Number(mine('products').find((row) => row.sku === 'P-002')?.quantity)).toBe(60)

    expect(done.status).toBe('completed')
    expect(lineOf(done, 'stockPlacements')).toMatchObject({ sourceValue: 2, hisabcheValue: 2 })
  })

  it('⚠️ the same sheet again writes no second movement', async () => {
    await run(STOCK_SHEET, 'product')
    const again = await run(STOCK_SHEET, 'product')

    expect(codesOf(again.dry).filter((code) => code === 'PRODUCT_ALREADY_STOCKED')).toHaveLength(2)
    expect(again.dry.dryRun.stockUnits).toBeUndefined()
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100, 'Rice @ Second': 45 })
    expect(db.rows('stock_movements')).toHaveLength(2)
  })

  it('the product of ANOTHER business with the same code is neither matched nor touched', async () => {
    await run(STOCK_SHEET, 'product')
    const foreign = db.rows('products').find((row) => row.workspace_id === OTHER_SHOP)
    expect(foreign).toMatchObject({ name: 'Rice', quantity: 7 })
    expect(stockByPlace()['Rice @ FOREIGN']).toBeUndefined()
  })
})

describe('failure, retry and resumption', () => {
  const FILE = [
    'SKU,Product Name,Warehouse,Stock',
    'P-001,Rice,Main Warehouse,100',
    'P-001,Rice,Secondary Warehouse,45',
  ].join('\n')

  it('⚠️ the stock write fails after the product is made: the retry stocks it ONCE, with no second product', async () => {
    db.fail('stock_movements', { message: 'connection reset' })
    const first = await run(FILE)
    expect(first.committed.statusCode).toBeGreaterThanOrEqual(500)
    expect(mine('products')).toHaveLength(1)
    expect(db.rows('stock_movements')).toHaveLength(0)

    db.failures.clear()
    const second = await run(FILE)
    expect(second.committed.statusCode, second.committed.body).toBe(200)

    expect(mine('products')).toHaveLength(1)
    expect(stockByPlace()).toEqual({ 'Rice @ Main': 100, 'Rice @ Second': 45 })
    expect(second.done.status).toBe('completed')
  })

  it('⚠️ products with no code, imported a row per request: each is made exactly once', async () => {
    const file = ['Product Name,Sell Price', 'Rice,90', 'Tea,150', 'Salt,20'].join('\n')
    const { job, content } = await scan(file, 'product')
    await post(`/${job.id}/dry-run`, { content })

    IMPORT_LIMITS.rowsPerRequest = 1
    let status = ''
    for (let request = 0; request < 6 && status !== 'completed'; request++) {
      status = JSON.parse((await post(`/${job.id}/commit`, { content })).body).status
    }

    expect(status).toBe('completed')
    expect(
      mine('products')
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Rice', 'Salt', 'Tea'])
    // Each is in the ledger, so the import can be counted — and undone.
    expect(db.rows('migration_records')).toHaveLength(3)
  })

  it('⚠️ a run resumed BEFORE where it stopped does not turn its own «created» rows into updates', async () => {
    const file = ['SKU,Product Name,Sell Price', 'P-001,Rice,90', 'P-002,Tea,150'].join('\n')
    const { job, content } = await scan(file, 'product')
    await post(`/${job.id}/dry-run`, { content })
    IMPORT_LIMITS.rowsPerRequest = 1
    await post(`/${job.id}/commit`, { content })

    // The run died after writing the row but before noting its progress.
    const stored = db.rows('migration_jobs').find((row) => row.id === job.id)
    if (stored) Object.assign(stored, { rows_created: 0 })

    IMPORT_LIMITS.rowsPerRequest = 1000
    const done = JSON.parse((await post(`/${job.id}/commit`, { content })).body)

    expect(mine('products')).toHaveLength(2)
    expect(done).toMatchObject({ status: 'completed', rowsCreated: 2, rowsUpdated: 0 })
    expect(db.rows('migration_records').map((row) => row.outcome)).toEqual(['created', 'created'])
  })
})

describe('whose warehouse a column may be mapped to', () => {
  it('⚠️ a warehouse of another business is refused at the mapping step', async () => {
    const { job } = await scan(['SKU,Product Name,Shelf A', 'P-001,Rice,100'].join('\n'), 'product')
    const refused = await app.inject({
      method: 'PUT',
      url: `/api/migrations/${job.id}/mapping`,
      headers,
      payload: { mapping: { sku: 0, name: 1, [`warehouseStock:${FOREIGN}`]: 2 } },
    })
    expect(refused.statusCode, refused.body).toBe(400)
    expect(refused.body).toContain('MIGRATION_WAREHOUSE_UNKNOWN')

    const accepted = await app.inject({
      method: 'PUT',
      url: `/api/migrations/${job.id}/mapping`,
      headers,
      payload: { mapping: { sku: 0, name: 1, [`warehouseStock:${SECOND}`]: 2 } },
    })
    expect(accepted.statusCode, accepted.body).toBe(200)
  })
})

describe('a row that is a record the business already has', () => {
  const AHMAD = fakeId('customer')
  const FOREIGN_AHMAD = fakeId('customer')

  beforeEach(() => {
    db.seed('customers', [
      // Typed in by hand — no import has ever seen it.
      {
        id: AHMAD,
        workspace_id: SHOP,
        full_name: 'Ahmad',
        phone: '0700111222',
        email: '',
        address: 'Old address',
        notes: 'pays on Thursdays',
        opening_balance: 500,
        type: 'credit',
        updated_at: null,
      },
      {
        id: FOREIGN_AHMAD,
        workspace_id: OTHER_SHOP,
        full_name: 'Someone else',
        phone: '0700111222',
        email: '',
        address: 'Their address',
        opening_balance: 1,
      },
    ])
  })

  it('⚠️ the preview says «update» and the commit UPDATES — it used to create a twin', async () => {
    const { dry, done } = await run(
      [
        'Full Name,Phone,Address,Opening Balance',
        'Ahmad Karimi,0700111222,New address,9999',
        'Bilal,0700333444,Herat,0',
      ].join('\n'),
      'customer',
    )

    expect(dry.dryRun).toMatchObject({ toCreate: 1, toUpdate: 1 })
    expect(done).toMatchObject({ status: 'completed', rowsCreated: 1, rowsUpdated: 1 })

    expect(mine('customers')).toHaveLength(2)
    const ahmad = mine('customers').find((row) => row.id === AHMAD)
    expect(ahmad).toMatchObject({
      full_name: 'Ahmad Karimi',
      address: 'New address',
      // What the file did not say is kept; where the books began is never restated.
      notes: 'pays on Thursdays',
      opening_balance: 500,
    })
    expect(db.rows('transactions')).toHaveLength(0)
    // The same phone in another business is somebody else.
    expect(db.rows('customers').find((row) => row.id === FOREIGN_AHMAD)).toMatchObject({
      full_name: 'Someone else',
      address: 'Their address',
    })
  })

  it('a row whose phone and email belong to two different customers updates neither', async () => {
    db.seed('customers', [
      {
        id: fakeId('customer'),
        workspace_id: SHOP,
        full_name: 'Bilal',
        phone: '',
        email: 'b@example.com',
      },
    ])
    const { dry } = await run(
      ['Full Name,Phone,Email', 'Mixed Up,0700111222,b@example.com'].join('\n'),
      'customer',
    )
    expect(codesOf(dry)).toContain('EXISTING_MATCH_AMBIGUOUS')
    expect(
      mine('customers')
        .map((row) => row.full_name)
        .sort(),
    ).toEqual(['Ahmad', 'Bilal'])
  })

  it('⚠️ updating a product goes through the product service: its stock figure is not overwritten', async () => {
    const TEA = fakeId('product')
    db.seed('products', [
      {
        id: TEA,
        workspace_id: SHOP,
        name: 'Tea',
        sku: 'P-002',
        barcode: '',
        quantity: 60,
        sell_price: 100,
      },
    ])
    const { dry } = await run(
      ['SKU,Product Name,Warehouse,Stock,Sell Price', 'P-002,Green Tea,Main Warehouse,5,150'].join(
        '\n',
      ),
    )

    expect(dry.dryRun).toMatchObject({ toUpdate: 1 })
    expect(codesOf(dry)).toContain('PRODUCT_ALREADY_STOCKED')
    expect(mine('products').find((row) => row.id === TEA)).toMatchObject({
      name: 'Green Tea',
      sell_price: 150,
      quantity: 60,
    })
    expect(db.rows('stock_movements')).toHaveLength(0)
  })
})
