// ============================================
// The warehouse map, over REAL HTTP (buildServer + app.inject): the routes, the
// capability guards, the tenant filter and the services are the product's own;
// only the database is the in-memory stand-in.
//
// What can go wrong, and what each assertion is here for:
//
//   · a member without `inventory.read` reading the map anyway
//   · a seller being shown what the stock COST (`inventory.cost.read`)
//   · another workspace's warehouse, location or product being reachable
//   · a placement above what the warehouse holds being stored
//   · two shelves carrying the same label
//   · a read that broke coming back as an empty warehouse
//   · a missing migration coming back as an empty warehouse
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: fakeId('owner'), token: 'wmap-token-owner' }
const MANAGER = { id: fakeId('manager'), token: 'wmap-token-manager' }
const SELLER = { id: fakeId('seller'), token: 'wmap-token-seller' }
const SHOP = fakeId('shop')
const OTHER = fakeId('shop')

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [MANAGER.token, { id: MANAGER.id }],
  [SELLER.token, { id: SELLER.id }],
])

vi.mock('../db', async () => (globalThis as any).__warehouseMapFakeDb)

const W1 = fakeId('wh')
const W2 = fakeId('wh')
const BRANCH = fakeId('branch')
const P1 = fakeId('prod')
const P2 = fakeId('prod')
const L1 = fakeId('loc')
const L2 = fakeId('loc')
const FOREIGN_WAREHOUSE = fakeId('wh')
const FOREIGN_LOCATION = fakeId('loc')
const FOREIGN_PRODUCT = fakeId('prod')

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const member = (user: string, role: string, workspace = SHOP) => ({
  id: fakeId('member'),
  workspace_id: workspace,
  user_id: user,
  role,
  has_access: true,
  suspended_at: null,
  joined_at: '2026-01-01T00:00:00Z',
})

/**
 * The stand-in for `storage_place_stock`.
 *
 * It applies the SAME rule the SQL function does — the units recorded for a
 * product in a warehouse may never exceed what that warehouse holds, counted
 * over all of its locations — and raises it the same way, as a SCREAMING_CASE
 * code in the message, because that is what the service parses. The real cap is
 * proven against a real Postgres in `warehouse-map-01.pg.test.ts`.
 */
function placeStockRpc(): void {
  db.rpc('storage_place_stock', (args) => {
    const quantity = Number(args.p_quantity)
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('STORAGE_PLACEMENT_NEGATIVE')
    }
    const location = db.rows('storage_locations').find((row) => row.id === args.p_location)
    if (!location || location.workspace_id !== args.p_workspace) {
      throw new Error('STORAGE_LOCATION_NOT_FOUND')
    }
    if (location.is_active === false) throw new Error('STORAGE_LOCATION_INACTIVE')
    const product = db
      .rows('products')
      .find((row) => row.id === args.p_product && row.workspace_id === args.p_workspace)
    if (!product) throw new Error('STORAGE_PLACEMENT_PRODUCT_NOT_FOUND')

    const held = db
      .rows('warehouse_stock')
      .filter(
        (row) => row.warehouse_id === location.warehouse_id && row.product_id === args.p_product,
      )
      .reduce((total, row) => total + Number(row.quantity), 0)

    const mine = db
      .rows('storage_location_placements')
      .filter((row) => row.product_id === args.p_product && row.workspace_id === args.p_workspace)
    const locationIds = new Set(
      db
        .rows('storage_locations')
        .filter((row) => row.warehouse_id === location.warehouse_id)
        .map((row) => row.id),
    )
    const elsewhere = mine
      .filter((row) => locationIds.has(row.location_id) && row.location_id !== args.p_location)
      .reduce((total, row) => total + Number(row.quantity), 0)
    const free = Math.max(held, 0) - elsewhere

    if (quantity > free + 1e-6) {
      throw new Error(`STORAGE_PLACEMENT_EXCEEDS_STOCK:${quantity}:${free}`)
    }

    const existing = mine.find((row) => row.location_id === args.p_location)
    if (existing) existing.quantity = quantity
    else
      db.rows('storage_location_placements').push({
        id: fakeId('placement'),
        workspace_id: args.p_workspace,
        location_id: args.p_location,
        product_id: args.p_product,
        quantity,
      })
    return { locationId: args.p_location, productId: args.p_product, quantity, available: free }
  })
}

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.queries.length = 0
  db.uniques.length = 0
  db.rpcs.clear()
  db.maxRows = null

  db.seed('workspace_members', [
    member(OWNER.id, 'owner'),
    member(MANAGER.id, 'manager'),
    member(SELLER.id, 'seller'),
    member(OWNER.id, 'owner', OTHER),
  ])
  db.seed('workspaces', [
    { id: SHOP, base_currency: 'AFN' },
    { id: OTHER, base_currency: 'USD' },
  ])
  db.seed('branches', [{ id: BRANCH, workspace_id: SHOP, name: 'کابل', deleted_at: null }])
  db.seed('warehouses', [
    {
      id: W1,
      workspace_id: SHOP,
      name: 'گدام مرکزی',
      branch_id: BRANCH,
      location: 'کابل',
      is_active: true,
      deleted_at: null,
    },
    {
      id: W2,
      workspace_id: SHOP,
      name: 'گدام دوم',
      branch_id: null,
      location: null,
      is_active: true,
      deleted_at: null,
    },
    {
      id: FOREIGN_WAREHOUSE,
      workspace_id: OTHER,
      name: 'گدام دیگری',
      branch_id: null,
      location: null,
      is_active: true,
      deleted_at: null,
    },
  ])
  db.seed('products', [
    {
      id: P1,
      workspace_id: SHOP,
      name: 'برنج',
      sku: 'A-1',
      unit: 'kg',
      buy_price: 100,
      is_active: true,
    },
    {
      id: P2,
      workspace_id: SHOP,
      name: 'چای',
      sku: null,
      unit: 'kg',
      buy_price: 0,
      is_active: true,
    },
    {
      id: FOREIGN_PRODUCT,
      workspace_id: OTHER,
      name: 'جنس دیگری',
      sku: null,
      unit: 'kg',
      buy_price: 7,
      is_active: true,
    },
  ])
  db.seed('warehouse_stock', [
    { id: fakeId('ws'), workspace_id: SHOP, warehouse_id: W1, product_id: P1, quantity: 10 },
    { id: fakeId('ws'), workspace_id: SHOP, warehouse_id: W1, product_id: P2, quantity: 4 },
  ])
  db.seed('storage_locations', [
    {
      id: L1,
      workspace_id: SHOP,
      warehouse_id: W1,
      parent_id: null,
      code: 'Z01',
      name: 'منطقه A',
      kind: 'zone',
      position_x: 0,
      position_y: 0,
      width: 10,
      height: 6,
      capacity: 100,
      is_active: true,
    },
    {
      id: L2,
      workspace_id: SHOP,
      warehouse_id: W1,
      parent_id: L1,
      code: 'R01',
      name: null,
      kind: 'rack',
      position_x: 1,
      position_y: 1,
      width: 2,
      height: 2,
      capacity: null,
      is_active: true,
    },
    {
      id: FOREIGN_LOCATION,
      workspace_id: OTHER,
      warehouse_id: FOREIGN_WAREHOUSE,
      parent_id: null,
      code: 'X01',
      name: null,
      kind: 'bin',
      position_x: 0,
      position_y: 0,
      width: 1,
      height: 1,
      capacity: null,
      is_active: true,
    },
  ])
  db.seed('storage_location_placements', [
    {
      id: fakeId('placement'),
      workspace_id: SHOP,
      location_id: L2,
      product_id: P1,
      quantity: 6,
    },
  ])
  db.seed('stock_movements', [
    {
      id: fakeId('mv'),
      workspace_id: SHOP,
      product_id: P1,
      type: 'sale',
      quantity: -2,
      from_warehouse_id: W1,
      created_at: day(94),
    },
    {
      id: fakeId('mv'),
      workspace_id: SHOP,
      product_id: P2,
      type: 'sale',
      quantity: -3,
      from_warehouse_id: W1,
      created_at: day(3),
    },
    // Another warehouse sold a lot of P1 yesterday: it must NOT colour this
    // floor as «moving».
    {
      id: fakeId('mv'),
      workspace_id: SHOP,
      product_id: P1,
      type: 'sale',
      quantity: -50,
      from_warehouse_id: W2,
      created_at: day(1),
    },
    {
      id: fakeId('mv'),
      workspace_id: SHOP,
      product_id: P1,
      type: 'purchase',
      quantity: 5,
      from_warehouse_id: null,
      created_at: day(2),
    },
  ])
  db.unique('storage_locations', ['warehouse_id', 'code'])
  db.unique('storage_location_placements', ['location_id', 'product_id'])
  placeStockRpc()
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__warehouseMapFakeDb = createFakeDb(db, users)
  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => resetWorld())

const as = (who: { token: string }, workspace = SHOP) => ({
  authorization: `Bearer ${who.token}`,
  'x-workspace-id': workspace,
})

const map = (warehouse = W1, who = OWNER, query = '') =>
  app.inject({
    method: 'GET',
    url: `/api/warehouses/${warehouse}/map${query}`,
    headers: as(who),
  })

const addLocation = (payload: Record<string, unknown>, who = OWNER, warehouse = W1) =>
  app.inject({
    method: 'POST',
    url: `/api/warehouses/${warehouse}/locations`,
    headers: as(who),
    payload,
  })

const patchLocation = (id: string, payload: Record<string, unknown>, who = OWNER) =>
  app.inject({
    method: 'PATCH',
    url: `/api/storage-locations/${id}`,
    headers: as(who),
    payload,
  })

const place = (id: string, payload: Record<string, unknown>, who = MANAGER) =>
  app.inject({
    method: 'POST',
    url: `/api/storage-locations/${id}/place`,
    headers: as(who),
    payload,
  })

const body = (res: { body: string }) => JSON.parse(res.body)

describe('GET /api/warehouses/:id/map', () => {
  it('draws the warehouse from real rows: bands, the path, and what has no location', async () => {
    const res = await map()
    expect(res.statusCode, res.body).toBe(200)
    const payload = body(res)

    expect(payload.migrated).toBe(true)
    expect(payload.currency).toBe('AFN')
    expect(payload.days).toBe(90)
    expect(payload.demandWindowDays).toBe(30)
    expect(payload.costVisible).toBe(true)
    expect(payload.warehouse).toMatchObject({
      id: W1,
      name: 'گدام مرکزی',
      branchId: BRANCH,
      branchName: 'کابل',
    })

    const zone = payload.locations.find((row: any) => row.code === 'Z01')
    const rack = payload.locations.find((row: any) => row.code === 'R01')
    expect(payload.locations.map((row: any) => row.code)).toEqual(['Z01', 'R01'])
    expect(rack.path).toBe('Z01 › R01')
    expect(rack.depth).toBe(1)
    expect(zone.band).toBe('empty')

    // برنج sold from THIS warehouse 94 days ago → the existing 90-day rule.
    expect(rack.band).toBe('stagnant')
    expect(rack.daysSinceSale).toBe(94)
    expect(rack.products[0]).toMatchObject({
      productId: P1,
      name: 'برنج',
      quantity: 6,
      unitCost: 100,
      value: 600,
      soldInWindow: 0,
      neverSold: false,
    })

    // ⚠️ The unplaced remainder is TWO products, not one: چای is in this
    // warehouse and in no location at all. برنج: 10 held, 6 on the rack → 4.
    // چای: 4 held, none placed → 4, and it contributes NO money because its
    // purchase price was never entered (0) — the count says so instead.
    expect(payload.unplaced).toEqual({ productCount: 2, quantity: 8, value: 400 })
    expect(payload.drift).toEqual({ productCount: 0, quantity: 0, value: 0 })
    expect(payload.totals).toMatchObject({
      locationCount: 2,
      emptyLocationCount: 1,
      placedQuantity: 6,
      placedValue: 600,
      stagnantValue: 600,
      productsWithoutCost: 1,
    })
  })

  it('⚠️ another warehouse’s sales do not colour this floor', async () => {
    const payload = body(await map())
    const rack = payload.locations.find((row: any) => row.code === 'R01')
    // W2 sold 50 units of برنج yesterday; this warehouse has not sold it in 94
    // days, and the map is about THIS warehouse.
    expect(rack.daysSinceSale).toBe(94)
    expect(rack.band).toBe('stagnant')
  })

  it('the window is a query parameter, and a nonsense one is refused', async () => {
    const wide = body(await map(W1, OWNER, '?days=30'))
    expect(wide.days).toBe(30)
    // 94 days of no sales is inside a 30-day threshold too — still dead, and
    // this is the parameter the dead-stock list already takes.
    expect(wide.locations.find((row: any) => row.code === 'R01').band).toBe('stagnant')

    expect((await map(W1, OWNER, '?days=1')).statusCode).toBe(400)
    expect((await map(W1, OWNER, '?days=99999')).statusCode).toBe(400)
  })

  it('⚠️ a seller may read the map and is given NO cost', async () => {
    const res = await map(W1, SELLER)
    expect(res.statusCode, res.body).toBe(200)
    const payload = body(res)

    expect(payload.costVisible).toBe(false)
    const rack = payload.locations.find((row: any) => row.code === 'R01')
    expect(rack.quantity).toBe(6)
    expect(rack.products[0].unitCost).toBeNull()
    expect(rack.products[0].value).toBeNull()
    expect(rack.value).toBeNull()
    expect(rack.valueClass).toBeNull()
    expect(payload.totals.placedValue).toBeNull()
    expect(payload.unplaced.value).toBeNull()
    // …and no statement about prices at all, not even «which ones are missing»:
    // the reader cannot check it and it is a fact about what the shop pays.
    expect(payload.totals.productsWithoutCost).toBe(0)
    // Not zero: «you may not see it» and «it is worth nothing» differ.
    expect(JSON.stringify(payload)).not.toContain('"placedValue":0')
  })

  it('⚠️ another workspace’s warehouse is not found, not empty', async () => {
    const res = await map(FOREIGN_WAREHOUSE)
    expect(res.statusCode).toBe(404)
  })

  it('⚠️ a warehouse of this workspace that the member may not use is a named refusal', async () => {
    // A seller pinned to a DIFFERENT branch. `member_branches` is what
    // `branches.scopeFor` reads, and the warehouse map must obey the same rule
    // the invoice and the transfer already obey — there is no second permission
    // system for warehouses.
    const otherBranch = fakeId('branch')
    db.seed('member_branches', [
      { id: fakeId('mb'), workspace_id: SHOP, user_id: SELLER.id, branch_id: otherBranch },
    ])

    const refused = await map(W1, SELLER)
    expect(refused.statusCode, refused.body).toBe(403)
    expect(refused.body).toContain('WAREHOUSE_NOT_PERMITTED')

    // ⚠️ A warehouse that belongs to NO branch stays usable: restricting one is
    // an act (placing it in a branch), not a default.
    expect((await map(W2, SELLER)).statusCode).toBe(200)
    // The owner is not restricted by anyone's assignment.
    expect((await map(W1, OWNER)).statusCode).toBe(200)
    // And the refusal is not a way in: the same warehouse cannot be written to.
    expect((await addLocation({ code: 'S-01' }, SELLER)).statusCode).toBe(403)
    expect((await addLocation({ code: 'S-01' }, MANAGER)).statusCode).toBe(403)
    expect((await addLocation({ code: 'S-01' }, OWNER)).statusCode).toBe(201)
  })

  it('⚠️ the migration not having run is said in words, not drawn as an empty warehouse', async () => {
    db.fail('storage_locations', {
      code: 'PGRST205',
      message: "Could not find the table 'public.storage_locations' in the schema cache",
    })
    const res = await map()
    expect(res.statusCode, res.body).toBe(200)
    expect(body(res).migrated).toBe(false)
    expect(body(res).locations).toEqual([])
  })

  it('⚠️ a read that BROKE is an error, never an empty warehouse', async () => {
    db.fail('storage_locations', { code: '57014', message: 'canceling statement due to timeout' })
    const res = await map()
    expect(res.statusCode).toBe(500)

    db.failures.clear()
    db.fail('warehouse_stock', { code: '57014', message: 'canceling statement' })
    expect((await map()).statusCode).toBe(500)
  })
})

describe('the plan: adding, renaming and retiring a location', () => {
  it('the owner adds a shelf under a zone, and it lands in the workspace', async () => {
    const res = await addLocation({ code: 'R02', kind: 'rack', parentId: L1, x: 3, y: 1 })
    expect(res.statusCode, res.body).toBe(201)
    const written = db.rows('storage_locations').find((row) => row.code === 'R02')
    expect(written).toMatchObject({
      workspace_id: SHOP,
      warehouse_id: W1,
      parent_id: L1,
      kind: 'rack',
      position_x: 3,
      position_y: 1,
      width: 1,
      height: 1,
      is_active: true,
    })

    const payload = body(await map())
    expect(payload.locations.map((row: any) => row.code)).toEqual(['Z01', 'R01', 'R02'])
  })

  it('⚠️ two shelves cannot share a label in one warehouse', async () => {
    const res = await addLocation({ code: 'Z01', kind: 'zone' })
    expect(res.statusCode).toBe(409)
    expect(res.body).toContain('STORAGE_LOCATION_CODE_TAKEN')
    expect(db.rows('storage_locations').filter((row) => row.code === 'Z01')).toHaveLength(1)
  })

  it('a malformed location is refused before the database sees it', async () => {
    expect((await addLocation({ code: '' })).statusCode).toBe(400)
    expect((await addLocation({ code: 'A-1', kind: 'pallet' })).statusCode).toBe(400)
    expect((await addLocation({ code: 'A-1', width: 0 })).statusCode).toBe(400)
    expect((await addLocation({ code: 'A-1', capacity: -5 })).statusCode).toBe(400)
    // An unknown field is a caller that believes something this route does not
    // do — refused, not silently ignored.
    expect((await addLocation({ code: 'A-1', sortOrder: 3 })).statusCode).toBe(400)
  })

  it('the owner renames, moves and retires; nobody else may', async () => {
    const renamed = await patchLocation(L2, { code: 'R-01', x: 4, y: 2 })
    expect(renamed.statusCode, renamed.body).toBe(200)
    expect(db.rows('storage_locations').find((row) => row.id === L2)).toMatchObject({
      code: 'R-01',
      position_x: 4,
    })

    const retired = await patchLocation(L2, { isActive: false })
    expect(retired.statusCode).toBe(200)
    expect(db.rows('storage_locations').find((row) => row.id === L2)!.is_active).toBe(false)
    // ⚠️ Retired, not deleted: what is recorded in it stays.
    expect(db.rows('storage_locations').some((row) => row.id === L2)).toBe(true)

    expect((await patchLocation(L2, { code: 'R-02' }, MANAGER)).statusCode).toBe(403)
    expect((await addLocation({ code: 'NEW' }, SELLER)).statusCode).toBe(403)
  })

  it('⚠️ a location of another workspace cannot be touched', async () => {
    const res = await patchLocation(FOREIGN_LOCATION, { code: 'HACKED' })
    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('STORAGE_LOCATION_NOT_FOUND')
    expect(db.rows('storage_locations').find((row) => row.id === FOREIGN_LOCATION)!.code).toBe(
      'X01',
    )
  })
})

describe('recording what is on a shelf', () => {
  it('a manager records goods, and the map shows them', async () => {
    const res = await place(L2, { productId: P2, quantity: 4 })
    expect(res.statusCode, res.body).toBe(200)
    expect(body(res)).toMatchObject({ quantity: 4 })

    const payload = body(await map())
    const rack = payload.locations.find((row: any) => row.code === 'R01')
    expect(rack.products.map((row: any) => row.name)).toEqual(['برنج', 'چای'])
    expect(rack.quantity).toBe(10)

    // ⚠️ چای has no purchase price entered (the column stores that as 0). Its
    // units count, its money does not — and it is NOT valued at zero, which
    // would report the shelf as worth exactly its other product and make the
    // dead-capital figure smaller than the truth.
    const tea = rack.products.find((row: any) => row.name === 'چای')
    expect(tea).toMatchObject({ quantity: 4, unitCost: null, value: null })
    expect(rack.productsWithoutCost).toBe(1)
    expect(rack.value).toBe(600)
    expect(payload.totals.placedValue).toBe(600)
    expect(payload.totals.productsWithoutCost).toBe(1)
  })

  it('⚠️ more than the warehouse holds is refused — the shelf is not a second stock figure', async () => {
    // برنج: 10 held, already 6 on the rack → 4 free.
    const res = await place(L2, { productId: P1, quantity: 11 })
    expect(res.statusCode).toBe(409)
    expect(res.body).toContain('STORAGE_PLACEMENT_EXCEEDS_STOCK')
    expect(
      db.rows('storage_location_placements').find((row) => row.location_id === L2)!.quantity,
    ).toBe(6)
  })

  it('a second shelf cannot claim the units the first one already holds', async () => {
    await addLocation({ code: 'R02', kind: 'rack' })
    const second = db.rows('storage_locations').find((row) => row.code === 'R02')!
    // 4 free (10 held − 6 on R01): 4 fits, 5 does not.
    expect((await place(second.id, { productId: P1, quantity: 4 })).statusCode).toBe(200)
    expect((await place(second.id, { productId: P1, quantity: 5 })).statusCode).toBe(409)
  })

  it('a seller may not record stock; a manager may', async () => {
    expect((await place(L2, { productId: P1, quantity: 1 }, SELLER)).statusCode).toBe(403)
    expect((await place(L2, { productId: P1, quantity: 1 }, MANAGER)).statusCode).toBe(200)
  })

  it('⚠️ another workspace’s location or product is refused by name', async () => {
    expect((await place(FOREIGN_LOCATION, { productId: P1, quantity: 1 })).statusCode).toBe(400)
    expect((await place(L2, { productId: FOREIGN_PRODUCT, quantity: 1 })).statusCode).toBe(400)
    expect((await place(L2, { productId: P1, quantity: -1 })).statusCode).toBe(400)
    expect((await place(L2, { productId: P1, quantity: 1.5 })).statusCode).toBe(200)
  })

  it('a retired shelf may not receive goods', async () => {
    await patchLocation(L2, { isActive: false })
    const res = await place(L2, { productId: P1, quantity: 1 })
    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('STORAGE_LOCATION_INACTIVE')
  })
})

describe('GET /api/products/:id/storage-locations (the product page)', () => {
  const productLocations = (product: string, who = OWNER) =>
    app.inject({
      method: 'GET',
      url: `/api/products/${product}/storage-locations`,
      headers: as(who),
    })

  it('names the shelf the product is on, with the units recorded there', async () => {
    const res = await productLocations(P1)
    expect(res.statusCode, res.body).toBe(200)
    const payload = body(res)
    expect(payload.configured).toBe(true)
    const w1 = payload.warehouses.find((row: any) => row.id === W1)
    expect(w1.placed).toEqual([expect.objectContaining({ locationId: L2, quantity: 6 })])
    // The choices a change can go to are this warehouse's active locations.
    expect(w1.choices.map((row: any) => row.id)).toContain(L2)
  })

  it('⚠️ another workspace’s product shows no shelf of ours or theirs', async () => {
    const res = await productLocations(FOREIGN_PRODUCT)
    expect(res.statusCode).toBe(200)
    const payload = body(res)
    for (const warehouse of payload.warehouses) {
      expect(warehouse.placed).toEqual([])
      expect(warehouse.id).not.toBe(FOREIGN_WAREHOUSE)
    }
  })

  it('a malformed id is refused before the database sees it', async () => {
    const res = await productLocations('not-a-uuid')
    expect(res.statusCode).toBe(400)
  })
})
