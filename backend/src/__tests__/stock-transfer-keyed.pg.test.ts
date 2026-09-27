// ============================================
// docs/stock-transfer-idempotency-migration.sql in a real Postgres, with the
// REAL projection trigger (phase-c-01). A retried transfer moves the goods
// ONCE; a new request moves them again; the unkeyed entry point is the same
// implementation.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { sourceIdOf } from '../utils/deterministic-id'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-transfer-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/transfer`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'stock-transfer-idempotency-migration.sql'), 'utf8')
const phaseC = readFileSync(
  join(DOCS, 'phase-c-01-inventory-source-of-truth-migration.sql'),
  'utf8',
)
const projectionAt = phaseC.indexOf('CREATE OR REPLACE FUNCTION stock_movements_project()')
const projection = phaseC.slice(
  projectionAt,
  phaseC.indexOf('$project$;', projectionAt) + '$project$;'.length,
)

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '22222222-2222-4222-8222-222222222222'
const A = '33333333-3333-4333-8333-333333333333'
const B = '44444444-4444-4444-8444-444444444444'

const payload = (qty: number) => ({
  product_id: PRODUCT,
  from_warehouse_id: A,
  to_warehouse_id: B,
  quantity: qty,
})

async function keyed(key: string, qty: number, workspace = WS) {
  const [r] = await sql<{ r: Record<string, unknown> }[]>`
    SELECT public.warehouse_transfer_stock_keyed(
      ${workspace}::uuid, ${USER}::uuid, ${sql.json(payload(qty) as never)}::jsonb,
      ${sourceIdOf(WS, 'stock_transfer', key)}::uuid) AS r`
  return r!.r
}
async function stock() {
  const rows = await sql<{ warehouse_id: string; quantity: string }[]>`
    SELECT warehouse_id, quantity FROM warehouse_stock WHERE product_id = ${PRODUCT} ORDER BY warehouse_id`
  return Object.fromEntries(rows.map((r) => [r.warehouse_id === A ? 'A' : 'B', Number(r.quantity)]))
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('transfer')
  sql = postgres(url, { max: 2, onnotice: () => {} })
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid, quantity numeric DEFAULT 0);
    CREATE TABLE warehouses (id uuid PRIMARY KEY, workspace_id uuid NOT NULL);
    CREATE TABLE warehouse_stock (
      warehouse_id uuid, product_id uuid, quantity numeric DEFAULT 0, workspace_id uuid, user_id uuid,
      updated_at timestamptz DEFAULT now(), PRIMARY KEY (warehouse_id, product_id));
    CREATE TABLE stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL, type text NOT NULL,
      quantity numeric NOT NULL DEFAULT 0, reference_type text, reference_id uuid, notes text,
      created_at timestamptz DEFAULT now(), user_id uuid NOT NULL,
      from_warehouse_id uuid, to_warehouse_id uuid, workspace_id uuid);`)
  await sql.unsafe(projection)
  await sql.unsafe(`CREATE TRIGGER stock_movements_project_trg AFTER INSERT OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION stock_movements_project();`)
  await sql.unsafe(migration)
  await sql.unsafe(migration)
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql.unsafe(`
    TRUNCATE stock_movements, warehouse_stock, warehouses, products;
    INSERT INTO products VALUES ('${PRODUCT}', '${WS}', 0);
    INSERT INTO warehouses VALUES ('${A}', '${WS}'), ('${B}', '${WS}');
    INSERT INTO stock_movements (product_id, type, quantity, user_id, to_warehouse_id, workspace_id)
      VALUES ('${PRODUCT}', 'purchase', 10, '${USER}', '${A}', '${WS}');`)
})

describe('warehouse_transfer_stock_keyed', () => {
  it('⚠️ the same request twice moves the goods ONCE', async () => {
    await keyed('req-00000001', 4)
    const second = await keyed('req-00000001', 4)
    expect(second.replayed).toBe(true)
    expect(await stock()).toEqual({ A: 6, B: 4 })
  })

  it('a new request moves them again', async () => {
    await keyed('req-00000001', 4)
    await keyed('req-00000002', 4)
    expect(await stock()).toEqual({ A: 2, B: 8 })
  })

  it('two copies at the same moment: one moves, the other is a replay', async () => {
    const results = await Promise.all([keyed('req-concurrent', 3), keyed('req-concurrent', 3)])
    expect(results.filter((r) => r.replayed === true)).toHaveLength(1)
    expect(await stock()).toEqual({ A: 7, B: 3 })
  })

  it('the same id from another workspace is refused, not replayed', async () => {
    await keyed('req-00000001', 1)
    await expect(keyed('req-00000001', 1, OTHER)).rejects.toThrow(/WAREHOUSE_TRANSFER_ID_CONFLICT/)
  })

  it('the rules are unchanged: not enough stock is refused and nothing moves', async () => {
    await expect(keyed('req-too-much', 11)).rejects.toThrow(/WAREHOUSE_INSUFFICIENT_STOCK/)
    expect(await stock()).toEqual({ A: 10 })
  })

  it('the unkeyed entry point is the same implementation', async () => {
    await sql`SELECT public.warehouse_transfer_stock(${WS}::uuid, ${USER}::uuid, ${sql.json(payload(2) as never)}::jsonb)`
    expect(await stock()).toEqual({ A: 8, B: 2 })
  })

  it('clients cannot call either function', async () => {
    const [r] = await sql<{ k: boolean; u: boolean }[]>`
      SELECT has_function_privilege('authenticated', 'public.warehouse_transfer_stock_keyed(uuid, uuid, jsonb, uuid)', 'EXECUTE') AS k,
             has_function_privilege('anon', 'public.warehouse_transfer_stock(uuid, uuid, jsonb)', 'EXECUTE') AS u`
    expect(r).toEqual({ k: false, u: false })
  })
})
