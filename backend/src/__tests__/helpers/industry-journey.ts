// ============================================
// backend/src/__tests__/helpers/industry-journey.ts
//
// The body of `journey-industries-<n>.pg.test.ts`: the trades are split into SHARDS, each
// with its own real database and server, so they run on separate workers (and each
// database stays small, which keeps the after-change refresh fast).
//
// V64 §2.8 POSTGRES_JOURNEY, for EVERY trade: a shop's first day over the app's own HTTP
// routes, with every write landing on a REAL PostgreSQL that carries the whole `docs/`
// migration set.
//
// Per trade (each in its own workspace, in one database):
//   1. signup → workspace in one function (workspace_create_with_owner), books in AFN,
//      the trade as business type — what the onboarding screen sends;
//   2. onboarding DNA → the trade's own DNA from `inferOperationalDna`, saved through
//      `workspace_set_operational_dna`;
//   3. a warehouse, and the trade's product in the trade's OWN unit (its profile) with an
//      opening stock of 50 at a known cost;
//   4. a customer and a sale of 5 → the stock and the books move;
//   5. the customer pays in full;
//   6. one unit comes back → stock and books move back;
//   7. the trial balance, from the real function — and double entry holds.
//
// ---------------------------------------------------------------------------
// HOW «REAL» IS REAL HERE
//
// The services talk to supabase-js; there is no PostgREST in a test. So the fake client
// runs WRITE-THROUGH (helpers/fake-supabase.ts `mirror`, helpers/pg-mirror.ts):
//   - every insert / upsert / update / delete a service makes runs on the real database
//     with the real column types, constraints and triggers;
//   - every rpc calls the REAL Postgres function, and the service gets the REAL answer —
//     a RAISE fails the route exactly as in production;
//   - after each change the fake is refreshed from the real tables, so the next read
//     sees what the database (and its triggers) actually hold.
// What the fake still does: evaluate a select's filters over those real rows.
// Every assertion below reads the REAL database, never the fake.
//
// What it found on its first runs (14 Nov 2026): credit-concurrency-01 refused every sale
// to a customer with no credit limit (fixed forward in credit-concurrency-02), and
// purchase-variant-binding-01 indexed a column its table does not have.
//
// WHERE IT RUNS: embedded-postgres (CI, Ubuntu). Where that binary cannot start, on PGlite
// (real PostgreSQL compiled to WASM) when PGLITE_DIR names a folder with
// @electric-sql/pglite installed. Neither: SKIPPED with the reason — never passed.
// ============================================

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { INDUSTRY_KEYS, inferOperationalDna, resolveBusinessProfile } from '@hisabche/validation'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './fake-supabase'
import { freePortSync } from './free-port'
import {
  applyFullSchema,
  createPgMirror,
  syncInto,
  type PgRunner,
  type SchemaResult,
} from './pg-mirror'
import { pgTempDir } from './pg-temp-dir'

// ─── Shards ──────────────────────────────────────────────────────────────────

export const JOURNEY_SHARDS = 4

/**
 * Which shard runs a trade: the sum of its key's character codes, modulo the shard count.
 * Order-free, so `scripts/industry/sellable-criteria.mjs` computes the same answer.
 */
export function journeyShardOf(trade: string): number {
  let sum = 0
  for (const character of trade) sum += character.charCodeAt(0)
  return (sum % JOURNEY_SHARDS) + 1
}

// ─── Which real PostgreSQL ────────────────────────────────────────────────────

const localRequire = createRequire(__filename)

/** The embedded binary, if this machine has it (an antivirus may have removed it). */
function embeddedInitdb(): string | null {
  try {
    const entry = createRequire(localRequire.resolve('embedded-postgres')).resolve(
      `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`,
    )
    let dir = dirname(entry)
    for (let i = 0; i < 4 && !existsSync(join(dir, 'native')); i++) dir = dirname(dir)
    const bin = join(dir, 'native', 'bin', process.platform === 'win32' ? 'initdb.exe' : 'initdb')
    return existsSync(bin) ? bin : null
  } catch {
    return null
  }
}

const PGLITE_DIR = process.env.PGLITE_DIR
const PGLITE_PACKAGE = PGLITE_DIR ? join(PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : ''
const engine: 'embedded' | 'pglite' | null = embeddedInitdb()
  ? 'embedded'
  : PGLITE_PACKAGE && existsSync(PGLITE_PACKAGE)
    ? 'pglite'
    : null
const SKIP_REASON =
  'BLOCKED_EXTERNAL: no embedded-postgres binary on this machine and PGLITE_DIR is not set'

interface RealDatabase {
  runner: PgRunner
  close: () => Promise<void>
}

interface PgliteInstance {
  exec: (text: string) => Promise<unknown>
  query: (text: string, params?: unknown[]) => Promise<{ rows: Row[] }>
  close: () => Promise<void>
}

async function openRealDatabase(): Promise<RealDatabase> {
  if (engine === 'pglite') {
    const { PGlite } = createRequire(join(PGLITE_DIR ?? '', 'noop.js'))('@electric-sql/pglite') as {
      PGlite: new (options: { extensions: Record<string, unknown> }) => PgliteInstance
    }
    // btree_gist ships with PGlite as a contrib module; Supabase and embedded-postgres have it.
    const contrib = (await import(
      pathToFileURL(join(PGLITE_PACKAGE, 'dist', 'contrib', 'btree_gist.js')).href
    )) as { btree_gist: unknown }
    const db = new PGlite({ extensions: { btree_gist: contrib.btree_gist } })
    return {
      runner: {
        exec: async (text) => {
          await db.exec(text)
        },
        query: async (text, params) => (await db.query(text, params ? [...params] : [])).rows,
      },
      close: () => db.close(),
    }
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres')
  const { default: postgres } = await import('postgres')
  const port = freePortSync()
  const pg = new EmbeddedPostgres({
    databaseDir: pgTempDir('hisabche-pg-journey-'),
    port,
    user: 'postgres',
    password: 'test',
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    createPostgresUser: process.getuid?.() === 0,
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('journey')
  const sql = postgres(`postgres://postgres:test@localhost:${port}/journey`, {
    max: 1,
    onnotice: () => {},
  })
  return {
    runner: {
      exec: async (text) => {
        await sql.unsafe(text)
      },
      query: async (text, params) =>
        [...(await sql.unsafe(text, params ? ([...params] as never) : []))] as Row[],
    },
    close: async () => {
      await sql.end({ timeout: 2 })
      await pg.stop()
    },
  }
}

// ─── The world ────────────────────────────────────────────────────────────────

const OWNER = { id: fakeId('owner'), token: 'journey-industries-owner' }
const users = new Map([[OWNER.token, { id: OWNER.id }]])
const db = new FakeDatabase()

let real: RealDatabase | undefined
const realErrors: string[] = []
let schema: SchemaResult | undefined
let app: FastifyInstance | undefined

const q = (text: string, params?: readonly unknown[]) => {
  if (!real) throw new Error('no real database')
  return real.runner.query(text, params)
}
const one = async (text: string, params?: readonly unknown[]) => (await q(text, params))[0] ?? {}
const n = (value: unknown) => Number(value ?? 0)

let currentTrade = ''
const addresses = new Map<string, string>()
function addressOf(key: string): string {
  const known = addresses.get(key)
  if (known) return known
  const next = `10.${Math.floor(addresses.size / 250)}.${addresses.size % 250}.1`
  addresses.set(key, next)
  return next
}

async function call(
  workspaceId: string,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  payload?: Row,
) {
  if (!app) throw new Error('no app')
  const response = await app.inject({
    method,
    url,
    // One address per trade: the rate limiter counts per caller, and 67 shops are 67 callers.
    remoteAddress: addressOf(currentTrade),
    headers: {
      authorization: `Bearer ${OWNER.token}`,
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
    },
    ...(payload ? { payload } : {}),
  })
  const body = response.json() as Row
  // A failed step names what the real database refused, not only the route's summary.
  if (response.statusCode >= 400) body.realErrors = realErrors.slice(-3)
  return { status: response.statusCode, body }
}

/** Stock of one product, from the REAL movement ledger. */
async function stockOf(workspaceId: string, productId: string): Promise<number> {
  const row = await one(
    `SELECT COALESCE(SUM(quantity), 0) AS qty FROM public.stock_movements
      WHERE workspace_id = $1 AND product_id = $2`,
    [workspaceId, productId],
  )
  return n(row.qty)
}

/** Double entry, read from the REAL journal: debits equal credits and something was posted. */
async function expectBooksBalance(workspaceId: string, step: string) {
  const totals = await one(
    `SELECT COALESCE(SUM(l.debit), 0) AS debit, COALESCE(SUM(l.credit), 0) AS credit, count(*) AS lines
       FROM public.journal_lines l
       JOIN public.journal_entries e ON e.id = l.journal_id
      WHERE e.workspace_id = $1`,
    [workspaceId],
  )
  expect(n(totals.lines), `${step}: nothing posted`).toBeGreaterThan(0)
  expect(Math.round(n(totals.debit) * 100), `${step}: books do not balance`).toBe(
    Math.round(n(totals.credit) * 100),
  )
}

/** One trade's first day. Every step names itself in the failure message. */
async function tradeDay(trade: string) {
  currentTrade = trade
  const profile = resolveBusinessProfile([trade])
  const unit = profile.productDefaults.unit

  // 1. Signup → workspace with the trade, books in AFN (what onboarding sends).
  const created = await call('', 'POST', '/api/workspaces', {
    name: `دکان ${trade}`,
    baseCurrency: 'AFN',
    businessTypes: [trade],
  })
  expect(created.status, `1 workspace: ${JSON.stringify(created.body)}`).toBe(201)
  const ws = String(created.body.id)
  const books = await one('SELECT base_currency FROM public.workspaces WHERE id = $1', [ws])
  expect(books.base_currency, '1 books currency').toBe('AFN')
  const member = await one(
    'SELECT role, has_access FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [ws, OWNER.id],
  )
  expect(member, '1 owner membership').toMatchObject({ role: 'owner', has_access: true })

  // 2. Onboarding: the trade's own DNA.
  const dna = inferOperationalDna({ tradeKey: trade })
  const saved = await call(ws, 'PUT', '/api/workspace/operational-profile', {
    dna,
    expectedVersion: 0,
  })
  expect(saved.status, `2 DNA: ${JSON.stringify(saved.body)}`).toBe(200)

  // 3. A warehouse and the trade's product, in the trade's own unit.
  const warehouse = await call(ws, 'POST', '/api/warehouses', { name: 'انبار', isActive: true })
  expect(warehouse.status, `3 warehouse: ${JSON.stringify(warehouse.body)}`).toBe(201)
  const warehouseId = String(warehouse.body.id)
  const product = await call(ws, 'POST', '/api/products', {
    name: `کالای ${trade}`,
    sku: `SKU-${trade}`,
    buyPrice: 1000,
    sellPrice: 1400,
    unit,
    quantity: 50,
    warehouseId,
  })
  expect(product.status, `3 product (${unit}): ${JSON.stringify(product.body)}`).toBe(201)
  const productId = String(product.body.id)
  expect(await stockOf(ws, productId), '3 opening stock').toBe(50)
  const layer = await one(
    `SELECT COALESCE(SUM(remaining_qty), 0) AS qty FROM public.cost_layers
      WHERE workspace_id = $1 AND product_id = $2`,
    [ws, productId],
  )
  expect(n(layer.qty), '3 opening cost layer').toBe(50)

  // 4. A customer and a sale of 5.
  const customer = await call(ws, 'POST', '/api/customers', {
    fullName: 'احمد شاه',
    phone: '0700000001',
  })
  expect(customer.status, `4 customer: ${JSON.stringify(customer.body)}`).toBe(201)
  const customerId = String(customer.body.id)
  const sale = await call(ws, 'POST', '/api/invoices', {
    type: 'sale',
    currency: 'AFN',
    customerId,
    warehouseId,
    items: [{ productId, quantity: 5, unitPrice: 1400, discount: 0 }],
  })
  expect(sale.status, `4 sale: ${JSON.stringify(sale.body)}`).toBe(201)
  const invoiceId = String(sale.body.id)
  const invoice = await one('SELECT total FROM public.invoices WHERE id = $1', [invoiceId])
  expect(n(invoice.total), '4 invoice total').toBe(7000)
  expect(await stockOf(ws, productId), '4 stock after sale').toBe(45)
  await expectBooksBalance(ws, '4 sale')

  // 5. The customer pays in full.
  const paid = await call(ws, 'POST', '/api/payments', {
    direction: 'in',
    partyType: 'customer',
    partyId: customerId,
    amount: 7000,
    currency: 'AFN',
    method: 'cash',
    allocations: [{ invoiceId, amount: 7000 }],
  })
  expect(paid.status, `5 payment: ${JSON.stringify(paid.body)}`).toBe(201)
  const allocated = await one(
    'SELECT COALESCE(SUM(amount), 0) AS amount FROM public.payment_allocations WHERE invoice_id = $1',
    [invoiceId],
  )
  expect(n(allocated.amount), '5 allocated').toBe(7000)
  await expectBooksBalance(ws, '5 payment')

  // 6. One unit comes back to the shelf.
  const item = await one('SELECT id FROM public.invoice_items WHERE invoice_id = $1', [invoiceId])
  const returned = await call(ws, 'POST', `/api/invoices/${invoiceId}/returns`, {
    returnType: 'sale_return',
    returnNumber: `RET-${trade}`,
    returnDate: '2026-11-14',
    lines: [{ originalLineId: String(item.id), returnQuantity: 1, restockChoice: 'restock' }],
  })
  expect(returned.status, `6 return: ${JSON.stringify(returned.body)}`).toBe(201)
  expect(await stockOf(ws, productId), '6 stock after return').toBe(46)
  await expectBooksBalance(ws, '6 return')

  // 7. The trial balance, from the real function.
  const report = await call(ws, 'GET', '/api/accounting/trial-balance')
  expect(report.status, `7 trial balance: ${JSON.stringify(report.body)}`).toBe(200)
  await expectBooksBalance(ws, '7 report')

  // 8. The owner's three questions (V64 §2.5), answered by the app's own report routes and
  //    held against the REAL ledger. Sold 5, one came back: net 4 at 1,400 and 1,000.
  //    Profit says HOW KNOWN its cost is — never a silent zero.
  const profit = await call(
    ws,
    'GET',
    '/api/accounting/profit-report?from=2000-01-01&to=2100-12-31&currency=AFN',
  )
  expect(profit.status, `8 profit: ${JSON.stringify(profit.body)}`).toBe(200)
  const totals = (profit.body.totals ?? {}) as Row
  expect(totals.costStatus, '8 profit: cost status is stated').toBe('known')
  expect(n(totals.revenue), '8 profit: revenue net of the return').toBe(5600)
  expect(n(totals.cost), '8 profit: cost net of the return').toBe(4000)
  expect(n(totals.grossProfit), '8 profit: gross profit').toBe(1600)

  //    What the customer owes, per currency — the figure the customer page shows.
  const summary = await call(ws, 'GET', `/api/payments/summary/customer/${customerId}`)
  expect(summary.status, `8 party balance: ${JSON.stringify(summary.body)}`).toBe(200)
  const receivable = await one(
    `SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS net
       FROM public.journal_lines l
       JOIN public.journal_entries e ON e.id = l.journal_id
       JOIN public.accounts a ON a.id = l.account_id
      WHERE e.workspace_id = $1 AND a.role = 'receivable'`,
    [ws],
  )
  // Paid in full, then one returned: the shop owes the customer 1,400 — in the ledger
  // AND on the customer page.
  expect(n(receivable.net), '8 ledger receivable').toBe(-1400)
  expect(n(summary.body.netBalance), '8 party balance = ledger').toBe(n(receivable.net))
  expect(n(summary.body.weOwe), '8 we owe the return').toBe(1400)

  //    What is on the shelf, per warehouse.
  const shelf = await call(ws, 'GET', `/api/warehouses/${warehouseId}/stock`)
  expect(shelf.status, `8 warehouse stock: ${JSON.stringify(shelf.body)}`).toBe(200)
  const rows = (Array.isArray(shelf.body) ? shelf.body : []) as Row[]
  const onShelf = rows.find((row) => row.product_id === productId)
  expect(n(onShelf?.quantity), '8 warehouse stock').toBe(46)
}

export function industryJourney(shard: number): void {
  const trades = INDUSTRY_KEYS.filter((trade) => journeyShardOf(trade) === shard)
  describe.skipIf(engine === null)(
    `shard ${shard}/${JOURNEY_SHARDS}: ${trades.length} trades, one day each over HTTP on a real PostgreSQL (${engine ?? SKIP_REASON})`,
    () => {
      beforeAll(async () => {
        real = await openRealDatabase()
        schema = await applyFullSchema(real.runner)
        const runner = real.runner
        const mirror = createPgMirror(runner, () => syncInto(runner, db))
        // Every refusal of the REAL database, kept so a failed step can say what was refused.
        db.mirror = {
          write: async (change) => {
            const error = await mirror.write(change)
            if (error) realErrors.push(`${change.kind} ${change.table}: ${error.message}`)
            return error
          },
          rpc: async (name, args) => {
            const result = await mirror.rpc(name, args)
            if (result.error) realErrors.push(`rpc ${name}: ${result.error.message}`)
            return result
          },
        }
        await syncInto(runner, db)
        ;(globalThis as typeof globalThis & Record<string, object>).__journeyDb = createFakeDb(
          db,
          users,
        )
        const { buildServer } = await import('../../index')
        app = await buildServer()
        await app.ready()
      }, 600_000)

      afterAll(async () => {
        await app?.close()
        await real?.close()
      })

      it('every docs/ migration applies to a fresh database, in the run-migrations order', () => {
        expect(schema?.applied.length ?? 0).toBeGreaterThan(250)
        expect(schema?.unapplied ?? []).toEqual([])
      })

      // 120 s each: after every change the fake is refreshed from the real tables, which
      // grow as the trades accumulate in one database (~8 s per trade on PGlite at the end).
      it.each([...trades])(
        '%s: signup → DNA → stock → sale → payment → return → report',
        async (trade) => {
          await tradeDay(trade)
        },
        120_000,
      )
    },
  )
}
