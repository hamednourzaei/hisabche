// ============================================
// backend/src/__tests__/production-batch.pg.test.ts
//
// WP-09 — a production run knows what it STARTED and what came out SELLABLE.
// docs/production-batch-01-migration.sql is run unchanged (twice) on a real
// Postgres, on top of docs/manufacturing-01-migration.sql and the real costing
// functions, and then the database is asked the questions only it can answer:
//
//   • does the shelf gain the GOOD units, not the started ones?
//   • is the run's whole cost carried by those good units?
//   • does scrap raise the cost of a sellable unit (the point of the change)?
//   • is a run with nothing sellable refused, leaving nothing behind?
//   • do old payloads (no scrap fields) keep their exact old behaviour?
//   • does the constraint refuse a row whose three figures do not add up?
//
// ⚠️ The numbers are computed by hand beside each assertion. A test that reads
// its expectation from the code it tests proves nothing.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-batch-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/batch`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const manufacturing = read('manufacturing-01-migration.sql')
const productionBatch = read('production-batch-01-migration.sql')
const phaseC = read('phase-c-01-inventory-source-of-truth-migration.sql')
const projectionAt = phaseC.indexOf('CREATE OR REPLACE FUNCTION stock_movements_project()')
const projection = phaseC.slice(
  projectionAt,
  phaseC.indexOf('$project$;', projectionAt) + '$project$;'.length,
)

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const FINISHED = '20000000-0000-4000-8000-000000000001'
const PART_A = '20000000-0000-4000-8000-000000000002'
const WH = '30000000-0000-4000-8000-000000000001'

interface Line {
  kind: 'component' | 'cost'
  product_id?: string
  label: string
  quantity: number
  unit_cost: number
  line_total: number
  position: number
}

/**
 * The service's own payload: 30 of part A + 5 typed + 4 packaging + 6 labour
 * per unit, i.e. 45 per started unit. Every expectation below starts here.
 */
function run(
  key: string,
  options: {
    quantity?: number
    scrap?: number
    rework?: number
    inventory?: boolean
    currency?: string
    total?: number
  } = {},
) {
  const quantity = options.quantity ?? 10
  const lines: Line[] = [
    {
      kind: 'component',
      product_id: PART_A,
      label: 'A',
      quantity: 3,
      unit_cost: 10,
      line_total: 30,
      position: 0,
    },
    {
      kind: 'component',
      label: 'typed by hand',
      quantity: 1,
      unit_cost: 5,
      line_total: 5,
      position: 1,
    },
    { kind: 'cost', label: 'packaging', quantity: 1, unit_cost: 4, line_total: 4, position: 2 },
  ]
  const components = 35
  const other = 4
  const labor = 6
  const unit = components + other + labor
  const calculated = unit * quantity
  const total = options.total ?? calculated
  return {
    idempotency_key: key,
    product_id: FINISHED,
    quantity,
    scrap_quantity: options.scrap ?? 0,
    rework_quantity: options.rework ?? 0,
    currency: options.currency ?? 'AFN',
    columns: [],
    produced_on: '2026-10-01',
    labor: { workers: 2, minutes: 90 },
    components_cost: components,
    labor_cost: labor,
    other_cost: other,
    unit_cost: unit,
    calculated_total: calculated,
    override_total: null,
    override_reason: null,
    total_cost: total,
    add_to_inventory: options.inventory ?? true,
    consume_components: true,
    warehouse_id: WH,
    lines,
  }
}

/** A payload from before this change: it simply has no scrap keys. */
function legacyRun(key: string, quantity: number) {
  const payload = run(key, { quantity }) as Record<string, unknown>
  delete payload.scrap_quantity
  delete payload.rework_quantity
  return payload
}

async function complete(payload: Record<string, unknown>) {
  const [row] = await sql<{ r: Record<string, unknown> }[]>`
    SELECT public.manufacturing_complete(${WS}::uuid, ${USER}::uuid,
      ${sql.json(payload as never)}::jsonb) AS r`
  return row!.r
}

const qty = async (product: string) =>
  Number((await sql`SELECT quantity FROM products WHERE id = ${product}`)[0]!.quantity)
const count = async (table: string) =>
  Number((await sql.unsafe(`SELECT COUNT(*)::int AS n FROM ${table}`))[0]!.n)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('batch')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE workspace_members (workspace_id uuid, user_id uuid, role text, has_access boolean, suspended_at timestamptz);
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid, name text, quantity numeric DEFAULT 0);
    CREATE TABLE warehouses (id uuid PRIMARY KEY, workspace_id uuid, user_id uuid, name text);
    CREATE TABLE warehouse_stock (
      warehouse_id uuid, product_id uuid, quantity numeric DEFAULT 0, workspace_id uuid, user_id uuid,
      updated_at timestamptz DEFAULT now(), PRIMARY KEY (warehouse_id, product_id));
    CREATE TABLE stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL, type text NOT NULL,
      quantity numeric NOT NULL DEFAULT 0, reference_type text, reference_id uuid, notes text,
      created_at timestamptz DEFAULT now(), user_id uuid NOT NULL,
      from_warehouse_id uuid, to_warehouse_id uuid, workspace_id uuid);
    CREATE TABLE boms (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, product_id uuid, version integer DEFAULT 0,
      is_active boolean DEFAULT true, user_id uuid,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE bom_items (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, bom_id uuid, raw_material_id uuid,
      quantity numeric DEFAULT 0 NOT NULL, unit_cost numeric DEFAULT 0, user_id uuid);
    CREATE TABLE work_orders (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, product_id uuid, quantity integer DEFAULT 0 NOT NULL,
      bom_id uuid, status text, start_date timestamp, end_date timestamp, user_id uuid,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());`)
  await setup.unsafe(projection)
  await setup.unsafe(`CREATE TRIGGER stock_movements_project_trg AFTER INSERT OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION stock_movements_project();`)
  await setup.unsafe(read('inventory-costing-migration.sql'))
  await setup.unsafe(read('inventory-consume-concurrency-migration.sql'))
  await setup.unsafe(manufacturing)
  await setup.unsafe(manufacturing)
  // The file under test, twice — the second run must be a no-op.
  await setup.unsafe(productionBatch)
  await setup.unsafe(productionBatch)
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql.unsafe(`
    TRUNCATE work_order_lines, work_orders, bom_items, boms, cost_consumptions, cost_layers,
             stock_movements, warehouse_stock, warehouses, products, inventory_settings;
    INSERT INTO products (id, workspace_id, name) VALUES
      ('${FINISHED}', '${WS}', 'finished'), ('${PART_A}', '${WS}', 'part a');
    INSERT INTO warehouses (id, workspace_id, name) VALUES ('${WH}', '${WS}', 'main');`)
  await sql`SELECT inventory_receive_layer(${WS}::uuid, ${USER}::uuid, ${sql.json({
    product_id: PART_A,
    warehouse_id: WH,
    quantity: 500,
    unit_cost: 10,
    entry_date: '2026-09-01',
    source_type: 'opening',
    source_id: PART_A,
    source_line: 'seed',
  })}::jsonb)`
  await sql`INSERT INTO stock_movements (product_id, type, quantity, user_id, to_warehouse_id, workspace_id)
            VALUES (${PART_A}, 'opening', 500, ${USER}, ${WH}, ${WS})`
})

describe('production_batch', () => {
  it('receives the good units only, and carries the whole run on them', async () => {
    // 45 per started unit × 10 = 450. One unit spoiled → 9 sellable.
    const result = await complete(run('batch-0001', { scrap: 1 }))

    expect(result.status).toBe('completed')
    expect(Number(result.total_cost)).toBe(450)
    expect(Number(result.good_quantity)).toBe(9)
    expect(Number(result.unit_cost)).toBe(50) // 450 ÷ 9

    // The material was issued for all ten: 3 × 10 = 30 out of part A.
    expect(await qty(PART_A)).toBe(470)
    // The shelf gains nine, not ten.
    expect(await qty(FINISHED)).toBe(9)

    const [layer] = await sql`SELECT received_qty, unit_cost FROM cost_layers
                               WHERE product_id = ${FINISHED}`
    expect(Number(layer!.received_qty)).toBe(9)
    expect(Number(layer!.unit_cost)).toBe(50)

    const [order] = await sql`SELECT quantity, scrap_quantity, rework_quantity,
                                     good_quantity, yield_percent
                                FROM work_orders WHERE idempotency_key = 'batch-0001'`
    expect(Number(order!.quantity)).toBe(10)
    expect(Number(order!.scrap_quantity)).toBe(1)
    expect(Number(order!.rework_quantity)).toBe(0)
    expect(Number(order!.good_quantity)).toBe(9)
    expect(Number(order!.yield_percent)).toBe(90)
  })

  it('treats rework as produced-but-not-sellable too', async () => {
    // 10 started, 2 scrap, 3 rework → 5 good; yield 50%; 450 ÷ 5 = 90.
    const result = await complete(run('batch-0002', { scrap: 2, rework: 3 }))
    expect(Number(result.good_quantity)).toBe(5)
    expect(await qty(FINISHED)).toBe(5)

    const [order] =
      await sql`SELECT yield_percent FROM work_orders WHERE idempotency_key = 'batch-0002'`
    expect(Number(order!.yield_percent)).toBe(50)
  })

  it('keeps the old behaviour for a payload that has no output fields', async () => {
    // Before WP-09 the only figure was `quantity`; so is the answer here.
    const result = await complete(legacyRun('batch-legacy', 4))
    expect(Number(result.good_quantity)).toBe(4)
    expect(await qty(FINISHED)).toBe(4)

    const [order] = await sql`SELECT good_quantity, yield_percent FROM work_orders
                               WHERE idempotency_key = 'batch-legacy'`
    expect(Number(order!.good_quantity)).toBe(4)
    expect(Number(order!.yield_percent)).toBe(100)
  })

  it('refuses a run with nothing sellable when it adds to stock', async () => {
    await expect(complete(run('batch-0003', { quantity: 2, scrap: 2 }))).rejects.toThrow(
      /MANUFACTURING_GOOD_QUANTITY_REQUIRED/,
    )
    // Nothing was left behind: no order, no movement, no layer.
    expect(await count('work_orders')).toBe(0)
    expect(await count('cost_layers')).toBe(1) // the seeded part A layer only
    expect(await count('stock_movements')).toBe(1) // its opening movement only
  })

  it('refuses more loss than the run started', async () => {
    await expect(complete(run('batch-0004', { quantity: 2, scrap: 3 }))).rejects.toThrow(
      /MANUFACTURING_OUTPUT_EXCEEDS_QUANTITY/,
    )
  })

  it('a retry returns the good quantity and never receives twice', async () => {
    const payload = run('batch-0005', { scrap: 1 })
    const first = await complete(payload)
    const second = await complete(payload)

    expect(second.status).toBe('already_completed')
    expect(Number(second.good_quantity)).toBe(Number(first.good_quantity))
    expect(await qty(FINISHED)).toBe(9)
    expect(await count('work_orders')).toBe(1)
  })

  it('scrap raises the cost of a sellable unit', async () => {
    // Same inputs, same total: 450. Without scrap 45/unit; with two spoiled,
    // 450 ÷ 8 = 56.25/unit.
    await complete(run('batch-clean', { scrap: 0 }))
    await complete(run('batch-scrap', { scrap: 2, total: 450 }))

    const layers = await sql`SELECT unit_cost FROM cost_layers
                              WHERE product_id = ${FINISHED} ORDER BY unit_cost`
    expect(layers.map((row) => Number(row.unit_cost))).toEqual([45, 56.25])
  })

  it('receives the layer in the run currency', async () => {
    const result = await complete(run('batch-usd', { quantity: 4, currency: 'USD' }))
    expect(Number(result.total_cost)).toBe(180)

    const [layer] = await sql`SELECT currency, received_qty FROM cost_layers
                               WHERE product_id = ${FINISHED}`
    expect(layer!.currency).toBe('USD')
    expect(Number(layer!.received_qty)).toBe(4)
  })

  it('the report and the history cannot disagree about the unit cost', async () => {
    await complete(run('batch-report', { scrap: 1 }))

    const [row] = await sql<{ r: Record<string, unknown> }[]>`
      SELECT public.manufacturing_report(
        ${WS}::uuid, '2026-09-01'::date, '2026-10-31'::date, NULL) AS r`
    const report = row!.r as {
      totals: Record<string, unknown>
      products: Array<Record<string, unknown>>
    }
    // The started quantity and the run's cost are unchanged…
    expect(Number(report.totals.quantity)).toBe(10)
    expect(Number(report.totals.total_cost)).toBe(450)
    // …but a sellable unit is worth 450 ÷ 9, exactly as the history says.
    expect(Number(report.products[0]!.last_unit_cost)).toBe(50)
    expect(Number(report.products[0]!.first_unit_cost)).toBe(50)
  })

  it('the database itself refuses a row whose figures do not add up', async () => {
    await complete(run('batch-0006', { scrap: 1 })) // 10 − 1 = 9 good
    await expect(sql`UPDATE work_orders SET good_quantity = 3
                      WHERE idempotency_key = 'batch-0006'`).rejects.toThrow(
      /work_orders_output_adds_up/,
    )
  })
})
