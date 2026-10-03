// ============================================
// Manufacturing — docs/manufacturing-01-migration.sql run unchanged (twice) in
// a real Postgres, on top of the REAL costing functions
// (docs/inventory-costing-migration.sql + inventory-consume-concurrency) and
// the real stock projection trigger (phase-c-01).
//
// What only a database can prove: that a production run consumes its
// components exactly once and receives its goods exactly once — under a retry
// and under two simultaneous presses — that a failed run leaves NOTHING behind,
// that yesterday's cost does not change when today's price does, and that one
// workspace cannot produce from another's product.
//
// ⚠️ The fixtures are deliberately not one trade: a part assembled from parts, a
// dish made by weight, and a job that is only labour. The functions never see
// a name — if one of these needed a branch, the model would be wrong.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 56000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-mfg-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/mfg`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const migration = read('manufacturing-01-migration.sql')
const phaseC = read('phase-c-01-inventory-source-of-truth-migration.sql')
const projectionAt = phaseC.indexOf('CREATE OR REPLACE FUNCTION stock_movements_project()')
const projection = phaseC.slice(
  projectionAt,
  phaseC.indexOf('$project$;', projectionAt) + '$project$;'.length,
)

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const FINISHED = '20000000-0000-4000-8000-000000000001'
const PART_A = '20000000-0000-4000-8000-000000000002'
const PART_B = '20000000-0000-4000-8000-000000000003'
const FOREIGN = '20000000-0000-4000-8000-000000000009'
const WH = '30000000-0000-4000-8000-000000000001'
const FOREIGN_WH = '30000000-0000-4000-8000-000000000009'

interface Line {
  kind: 'component' | 'cost'
  product_id?: string
  label: string
  quantity: number
  unit_cost: number
  line_total: number
  position: number
}

/** A payload whose parts add up, the way the service builds it. */
function run(
  key: string,
  options: {
    quantity?: number
    lines?: Line[]
    labor?: number
    override?: number | null
    reason?: string
    inventory?: boolean
    consume?: boolean
    warehouse?: string | null
    product?: string
    bomId?: string
    day?: string
  } = {},
) {
  const quantity = options.quantity ?? 2
  const lines = options.lines ?? [
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
  const components = lines
    .filter((l) => l.kind === 'component')
    .reduce((s, l) => s + l.line_total, 0)
  const other = lines.filter((l) => l.kind === 'cost').reduce((s, l) => s + l.line_total, 0)
  const labor = options.labor ?? 6
  const unit = components + other + labor
  const calculated = unit * quantity
  const override = options.override ?? null
  return {
    idempotency_key: key,
    product_id: options.product ?? FINISHED,
    bom_id: options.bomId ?? null,
    quantity,
    currency: 'AFN',
    columns: [],
    produced_on: options.day ?? '2026-10-01',
    labor: { workers: 2, minutes: 90 },
    components_cost: components,
    labor_cost: labor,
    other_cost: other,
    unit_cost: unit,
    calculated_total: calculated,
    override_total: override,
    override_reason: options.reason ?? null,
    total_cost: override ?? calculated,
    add_to_inventory: options.inventory ?? true,
    consume_components: options.consume ?? true,
    warehouse_id: options.warehouse === undefined ? WH : options.warehouse,
    lines,
  }
}

async function complete(payload: Record<string, unknown>, workspace = WS) {
  const [row] = await sql<{ r: Record<string, unknown> }[]>`
    SELECT public.manufacturing_complete(${workspace}::uuid, ${USER}::uuid,
      ${sql.json(payload as never)}::jsonb) AS r`
  return row!.r
}

async function saveBom(payload: Record<string, unknown>, workspace = WS) {
  const [row] = await sql<{ r: { bom_id: string; version: number; revised: boolean } }[]>`
    SELECT public.manufacturing_save_bom(${workspace}::uuid, ${USER}::uuid,
      ${sql.json(payload as never)}::jsonb) AS r`
  return row!.r
}

const qty = async (product: string) =>
  Number((await sql`SELECT quantity FROM products WHERE id = ${product}`)[0]!.quantity)
const remaining = async (product: string) =>
  Number(
    (
      await sql`SELECT COALESCE(SUM(remaining_qty), 0) AS q FROM cost_layers WHERE product_id = ${product}`
    )[0]!.q,
  )
const count = async (table: string) =>
  Number((await sql.unsafe(`SELECT COUNT(*)::int AS n FROM ${table}`))[0]!.n)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('mfg')
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
    -- The three manufacturing tables exactly as docs/base-schema-migration.sql
    -- left them: no workspace column, integer quantity, nothing else.
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
  await setup.unsafe(migration)
  await setup.unsafe(migration)
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
      ('${FINISHED}', '${WS}', 'finished'), ('${PART_A}', '${WS}', 'part a'),
      ('${PART_B}', '${WS}', 'part b'), ('${FOREIGN}', '${OTHER}', 'someone else''s');
    INSERT INTO warehouses (id, workspace_id, name) VALUES
      ('${WH}', '${WS}', 'main'), ('${FOREIGN_WH}', '${OTHER}', 'theirs');`)
  // 100 of each part on the shelf at 10, through the real receipt function.
  for (const part of [PART_A, PART_B]) {
    await sql`SELECT inventory_receive_layer(${WS}::uuid, ${USER}::uuid, ${sql.json({
      product_id: part,
      warehouse_id: WH,
      quantity: 100,
      unit_cost: 10,
      entry_date: '2026-09-01',
      source_type: 'opening',
      source_id: part,
      source_line: 'seed',
    })}::jsonb)`
    await sql`INSERT INTO stock_movements (product_id, type, quantity, user_id, to_warehouse_id, workspace_id)
              VALUES (${part}, 'opening', 100, ${USER}, ${WH}, ${WS})`
  }
})

describe('manufacturing_complete', () => {
  it('consumes the stocked components and receives the goods at the recorded cost', async () => {
    const result = await complete(run('key-0001'))
    expect(result.status).toBe('completed')
    // unit = 30 + 5 + 4 + 6 = 45 → two units = 90
    expect(Number(result.total_cost)).toBe(90)

    expect(await qty(PART_A)).toBe(94) // 3 per unit × 2
    expect(await qty(FINISHED)).toBe(2)
    expect(await remaining(PART_A)).toBe(94)

    const [layer] = await sql`SELECT received_qty, unit_cost, warehouse_id FROM cost_layers
                               WHERE product_id = ${FINISHED}`
    expect(Number(layer!.received_qty)).toBe(2)
    expect(Number(layer!.unit_cost)).toBe(45)
    expect(layer!.warehouse_id).toBe(WH)

    // Both movements say which warehouse — an unattributed one is how a
    // product reads 20 while its warehouse reads −10.
    const moves = await sql`SELECT type, quantity, from_warehouse_id, to_warehouse_id
                              FROM stock_movements WHERE reference_type = 'work_order' ORDER BY type`
    expect(moves.map((m) => [m.type, Number(m.quantity)])).toEqual([
      ['consumption', -6],
      ['production', 2],
    ])
    expect(moves[0]!.from_warehouse_id).toBe(WH)
    expect(moves[1]!.to_warehouse_id).toBe(WH)
    const [stock] = await sql`SELECT quantity FROM warehouse_stock WHERE product_id = ${FINISHED}`
    expect(Number(stock!.quantity)).toBe(2)
  })

  it('keeps the snapshot: lines for the run, labour as its own line, actual cost beside entered', async () => {
    const result = await complete(run('key-0002'))
    const lines =
      await sql`SELECT kind, label, quantity_per_unit, quantity, unit_cost, total, actual_cost
                              FROM work_order_lines WHERE work_order_id = ${result.work_order_id as string}
                             ORDER BY position`
    expect(lines.map((l) => l.kind)).toEqual(['component', 'component', 'cost', 'labor'])
    expect(Number(lines[0]!.quantity_per_unit)).toBe(3)
    expect(Number(lines[0]!.quantity)).toBe(6)
    expect(Number(lines[0]!.total)).toBe(60)
    expect(Number(lines[0]!.actual_cost)).toBe(60)
    // A component typed by hand has nothing to consume.
    expect(lines[1]!.actual_cost).toBeNull()
    expect(Number(lines[3]!.total)).toBe(12)

    const [order] = await sql`SELECT status, bom_version, labor_workers, labor_minutes,
                                     actual_material_cost, completed_by
                                FROM work_orders WHERE id = ${result.work_order_id as string}`
    expect(order!.status).toBe('completed')
    expect(Number(order!.labor_minutes)).toBe(90)
    expect(Number(order!.actual_material_cost)).toBe(60)
    expect(order!.completed_by).toBe(USER)
  })

  it('a retry with the same key is the same run — nothing is consumed or received twice', async () => {
    const first = await complete(run('key-retry'))
    const second = await complete(run('key-retry'))
    expect(second.status).toBe('already_completed')
    expect(second.work_order_id).toBe(first.work_order_id)
    expect(await count('work_orders')).toBe(1)
    expect(await qty(PART_A)).toBe(94)
    expect(await qty(FINISHED)).toBe(2)
  })

  it('two simultaneous presses of one key produce ONE run', async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => complete(run('key-race'))))
    expect(results.filter((r) => r.status === 'completed')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'already_completed')).toHaveLength(3)
    expect(await count('work_orders')).toBe(1)
    expect(await qty(PART_A)).toBe(94)
    expect(await qty(FINISHED)).toBe(2)
  })

  it('concurrent DIFFERENT runs cannot take more than the shelf holds', async () => {
    // 100 on the shelf; each run needs 60. Only one can have them.
    const big = (key: string) =>
      run(key, {
        quantity: 1,
        lines: [
          {
            kind: 'component',
            product_id: PART_A,
            label: 'A',
            quantity: 60,
            unit_cost: 10,
            line_total: 600,
            position: 0,
          },
        ],
        labor: 0,
      })
    const settled = await Promise.allSettled([complete(big('race-a1')), complete(big('race-a2'))])
    const failed = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[]
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(String(failed[0]!.reason.message)).toContain('INVENTORY_INSUFFICIENT_STOCK')
    expect(await qty(PART_A)).toBe(40)
    expect(await count('work_orders')).toBe(1)
  })

  it('a run that cannot get its components leaves NOTHING behind', async () => {
    const tooMuch = run('key-fail', {
      lines: [
        {
          kind: 'component',
          product_id: PART_B,
          label: 'B',
          quantity: 1,
          unit_cost: 10,
          line_total: 10,
          position: 0,
        },
        {
          kind: 'component',
          product_id: PART_A,
          label: 'A',
          quantity: 500,
          unit_cost: 10,
          line_total: 5000,
          position: 1,
        },
      ],
      labor: 0,
    })
    await expect(complete(tooMuch)).rejects.toThrow('INVENTORY_INSUFFICIENT_STOCK')
    // PART_B was issued first and must have come back with the rollback.
    expect(await qty(PART_B)).toBe(100)
    expect(await remaining(PART_B)).toBe(100)
    expect(await count('work_orders')).toBe(0)
    expect(await count('work_order_lines')).toBe(0)
    expect(await qty(FINISHED)).toBe(0)
  })

  it('inventory OFF records the cost and moves no stock at all', async () => {
    const result = await complete(run('key-off', { inventory: false }))
    expect(result.status).toBe('completed')
    expect(await qty(PART_A)).toBe(100)
    expect(await qty(FINISHED)).toBe(0)
    expect(
      await sql`SELECT 1 FROM stock_movements WHERE reference_type = 'work_order'`,
    ).toHaveLength(0)
    expect(await sql`SELECT 1 FROM cost_layers WHERE product_id = ${FINISHED}`).toHaveLength(0)
    const [order] = await sql`SELECT add_to_inventory, warehouse_id, total_cost FROM work_orders`
    expect(order!.add_to_inventory).toBe(false)
    expect(order!.warehouse_id).toBeNull()
    expect(Number(order!.total_cost)).toBe(90)
  })

  it('inventory ON without consuming receives the goods and leaves the components', async () => {
    await complete(run('key-noconsume', { consume: false }))
    expect(await qty(PART_A)).toBe(100)
    expect(await qty(FINISHED)).toBe(2)
    const [order] = await sql`SELECT consume_components, actual_material_cost FROM work_orders`
    expect(order!.consume_components).toBe(false)
    expect(order!.actual_material_cost).toBeNull()
  })

  it('an override sits beside the calculated total, with who and why', async () => {
    await complete(run('key-override', { override: 120, reason: 'agreed price with the workshop' }))
    const [order] = await sql`SELECT calculated_total, override_total, total_cost, override_reason,
                                     override_by, override_at FROM work_orders`
    expect(Number(order!.calculated_total)).toBe(90)
    expect(Number(order!.override_total)).toBe(120)
    expect(Number(order!.total_cost)).toBe(120)
    expect(order!.override_reason).toBe('agreed price with the workshop')
    expect(order!.override_by).toBe(USER)
    expect(order!.override_at).not.toBeNull()
    const [layer] = await sql`SELECT unit_cost FROM cost_layers WHERE product_id = ${FINISHED}`
    expect(Number(layer!.unit_cost)).toBe(60)
  })

  it('refuses an override with no reason, and totals whose parts do not add up', async () => {
    await expect(complete(run('key-noreason', { override: 120 }))).rejects.toThrow(
      'MANUFACTURING_OVERRIDE_REASON_REQUIRED',
    )
    const lying = { ...run('key-lie'), total_cost: 1, calculated_total: 1 }
    await expect(complete(lying)).rejects.toThrow('MANUFACTURING_TOTALS_MISMATCH')
    const lyingParts = { ...run('key-lie2'), components_cost: 1 }
    await expect(complete(lyingParts)).rejects.toThrow('MANUFACTURING_TOTALS_MISMATCH')
    expect(await count('work_orders')).toBe(0)
  })

  it('refuses another workspace’s product, component and warehouse', async () => {
    await expect(complete(run('key-x1', { product: FOREIGN }))).rejects.toThrow(
      'MANUFACTURING_PRODUCT_NOT_FOUND',
    )
    await expect(
      complete(
        run('key-x2', {
          lines: [
            {
              kind: 'component',
              product_id: FOREIGN,
              label: 'x',
              quantity: 1,
              unit_cost: 1,
              line_total: 1,
              position: 0,
            },
          ],
          labor: 0,
        }),
      ),
    ).rejects.toThrow('MANUFACTURING_COMPONENT_NOT_FOUND')
    await expect(complete(run('key-x3', { warehouse: FOREIGN_WH }))).rejects.toThrow(
      'MANUFACTURING_WAREHOUSE_NOT_FOUND',
    )
    // The same key in another workspace is another run, not a hit on this one.
    await complete(run('key-shared'))
    await expect(complete(run('key-shared'), OTHER)).rejects.toThrow(
      'MANUFACTURING_PRODUCT_NOT_FOUND',
    )
  })

  it('refuses a product made from itself and a non-positive quantity', async () => {
    await expect(
      complete(
        run('key-self', {
          lines: [
            {
              kind: 'component',
              product_id: FINISHED,
              label: 'me',
              quantity: 1,
              unit_cost: 1,
              line_total: 1,
              position: 0,
            },
          ],
          labor: 0,
        }),
      ),
    ).rejects.toThrow('MANUFACTURING_SELF_COMPONENT')
    await expect(complete({ ...run('key-zero'), quantity: 0 })).rejects.toThrow(
      'MANUFACTURING_QUANTITY_INVALID',
    )
  })

  it('makes a fractional quantity — the column is no longer integer', async () => {
    const result = await complete(run('key-half', { quantity: 0.5 }))
    expect(Number(result.quantity)).toBe(0.5)
    expect(await qty(PART_A)).toBe(98.5)
    expect(await qty(FINISHED)).toBe(0.5)
  })

  it('completes an existing planned order instead of creating a second one', async () => {
    const [planned] =
      await sql`INSERT INTO work_orders (product_id, quantity, status, workspace_id, user_id)
                                VALUES (${FINISHED}, 2, 'planned', ${WS}, ${USER}) RETURNING id`
    const result = await complete({ ...run('key-planned'), work_order_id: planned!.id })
    expect(result.work_order_id).toBe(planned!.id)
    expect(await count('work_orders')).toBe(1)
    await expect(complete({ ...run('key-planned-2'), work_order_id: planned!.id })).rejects.toThrow(
      'WORK_ORDER_ALREADY_COMPLETED',
    )
  })

  it('a job that is only labour — no components at all — is a valid run', async () => {
    const result = await complete(run('key-labour', { lines: [], labor: 250, quantity: 1 }))
    expect(Number(result.total_cost)).toBe(250)
    const lines = await sql`SELECT kind FROM work_order_lines`
    expect(lines.map((l) => l.kind)).toEqual(['labor'])
  })
})

describe('manufacturing_save_bom — revisions', () => {
  const definition = (unitCost: number, bomId?: string) => ({
    product_id: FINISHED,
    bom_id: bomId ?? null,
    currency: 'AFN',
    columns: [{ id: 'description' }],
    labor: { workers: 1, minutes: 30, cost_input: 6 },
    components_cost: unitCost,
    labor_cost: 6,
    other_cost: 0,
    unit_cost: unitCost + 6,
    lines: [
      {
        kind: 'component',
        product_id: PART_A,
        label: 'A',
        quantity: 3,
        unit: 'gram',
        unit_cost: unitCost / 3,
        line_total: unitCost,
        position: 0,
        cells: { quantity: '3' },
      },
    ],
  })

  it('an unused definition is replaced in place', async () => {
    const first = await saveBom(definition(30))
    expect(first).toMatchObject({ version: 1, revised: false })
    const second = await saveBom(definition(45, first.bom_id))
    expect(second).toMatchObject({ bom_id: first.bom_id, version: 1, revised: false })
    expect(await count('boms')).toBe(1)
    const items = await sql`SELECT line_total, unit, cells FROM bom_items`
    expect(items).toHaveLength(1)
    expect(Number(items[0]!.line_total)).toBe(45)
    expect(items[0]!.unit).toBe('gram')
  })

  it('a definition a run has used is never edited: saving writes version 2 and retires 1', async () => {
    const first = await saveBom(definition(30))
    await complete(run('key-uses-bom', { bomId: first.bom_id }))

    const second = await saveBom(definition(90, first.bom_id))
    expect(second.revised).toBe(true)
    expect(second.version).toBe(2)
    expect(second.bom_id).not.toBe(first.bom_id)

    const boms = await sql`SELECT id, version, is_active, components_cost, supersedes_bom_id
                             FROM boms ORDER BY version`
    expect(boms.map((b) => [b.version, b.is_active, Number(b.components_cost)])).toEqual([
      [1, false, 30],
      [2, true, 90],
    ])
    expect(boms[1]!.supersedes_bom_id).toBe(first.bom_id)
    // The old revision still has ITS lines, and the run still points at it.
    const oldItems = await sql`SELECT line_total FROM bom_items WHERE bom_id = ${first.bom_id}`
    expect(Number(oldItems[0]!.line_total)).toBe(30)
    const [order] = await sql`SELECT bom_id FROM work_orders`
    expect(order!.bom_id).toBe(first.bom_id)
  })

  it('two simultaneous first saves do not both become version 1', async () => {
    const results = await Promise.all([saveBom(definition(30)), saveBom(definition(40))])
    expect(results.map((r) => r.version).sort()).toEqual([1, 2])
    const active = await sql`SELECT 1 FROM boms WHERE is_active`
    expect(active).toHaveLength(1)
  })

  it('refuses another workspace’s product and component', async () => {
    await expect(saveBom(definition(30), OTHER)).rejects.toThrow('MANUFACTURING_PRODUCT_NOT_FOUND')
    await expect(
      saveBom({
        ...definition(30),
        lines: [
          {
            kind: 'component',
            product_id: FOREIGN,
            label: 'x',
            quantity: 1,
            unit_cost: 1,
            line_total: 1,
            position: 0,
          },
        ],
      }),
    ).rejects.toThrow('MANUFACTURING_COMPONENT_NOT_FOUND')
  })
})

describe('history and reporting read the snapshot, not today', () => {
  const material = (unitCost: number, day: string, key: string, label = 'A') =>
    run(key, {
      quantity: 1,
      day,
      labor: 0,
      inventory: false,
      lines: [
        {
          kind: 'component',
          product_id: PART_A,
          label,
          quantity: 2,
          unit_cost: unitCost,
          line_total: unitCost * 2,
          position: 0,
        },
        {
          kind: 'component',
          label: 'Hand Typed',
          quantity: 1,
          unit_cost: unitCost / 2,
          line_total: unitCost / 2,
          position: 1,
        },
      ],
    })

  async function report(from: string, to: string, workspace = WS) {
    const [row] = await sql<{ r: any }[]>`
      SELECT public.manufacturing_report(${workspace}::uuid, ${from}::date, ${to}::date) AS r`
    return row!.r
  }

  it('an old run keeps its cost when the same material is dearer later', async () => {
    const old = await complete(material(10, '2026-08-10', 'hist-1'))
    await complete(material(16, '2026-09-20', 'hist-2'))
    const [line] = await sql`SELECT unit_cost, total FROM work_order_lines
                              WHERE work_order_id = ${old.work_order_id as string} AND position = 0`
    expect(Number(line!.unit_cost)).toBe(10)
    expect(Number(line!.total)).toBe(20)
  })

  it('reports each material’s previous and current cost from what was recorded', async () => {
    await complete(material(10, '2026-08-10', 'rep-1')) // before the range
    await complete(material(12, '2026-09-05', 'rep-2'))
    await complete(material(16, '2026-09-20', 'rep-3'))

    const r = await report('2026-09-01', '2026-09-30')
    expect(Number(r.totals.runs)).toBe(2)
    expect(Number(r.totals.total_cost)).toBe(12 * 2 + 6 + 16 * 2 + 8)

    const a = r.materials.find((m: any) => m.product_id === PART_A)
    expect(Number(a.previous_cost)).toBe(10) // the last run BEFORE the range
    expect(Number(a.current_cost)).toBe(16)
    expect(Number(a.change)).toBe(6)
    expect(Number(a.change_percent)).toBe(60)
    expect(Number(a.quantity)).toBe(4)
    expect(Number(a.value)).toBe(56)
    expect(a.name).toBe('part a')

    // A hand-typed material is matched by its label, whatever its case.
    const typed = r.materials.find((m: any) => m.key === 'label:hand typed')
    expect(Number(typed.previous_cost)).toBe(5)
    expect(Number(typed.current_cost)).toBe(8)

    expect(r.products).toHaveLength(1)
    expect(Number(r.products[0].first_unit_cost)).toBe(30)
    expect(Number(r.products[0].last_unit_cost)).toBe(40)
  })

  it('with nothing before the range, «previous» is the first cost inside it', async () => {
    await complete(material(12, '2026-09-05', 'only-1'))
    await complete(material(9, '2026-09-25', 'only-2'))
    const r = await report('2026-09-01', '2026-09-30')
    const a = r.materials.find((m: any) => m.product_id === PART_A)
    expect(Number(a.previous_cost)).toBe(12)
    expect(Number(a.current_cost)).toBe(9)
    expect(Number(a.change_percent)).toBe(-25)
  })

  it('another workspace sees none of it, and an empty range is zeros, not an error', async () => {
    await complete(material(12, '2026-09-05', 'iso-1'))
    const other = await report('2026-09-01', '2026-09-30', OTHER)
    expect(Number(other.totals.runs)).toBe(0)
    expect(other.materials).toEqual([])
    const empty = await report('2020-01-01', '2020-01-31')
    expect(Number(empty.totals.total_cost)).toBe(0)
    expect(empty.products).toEqual([])
  })
})

describe('the schema as a client sees it', () => {
  it('the snapshot table is closed to browser roles and the functions are not executable by them', async () => {
    const [rls] = await sql`SELECT relrowsecurity FROM pg_class WHERE relname = 'work_order_lines'`
    expect(rls!.relrowsecurity).toBe(true)
    const rows = await sql`
      SELECT p.proname,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
        FROM pg_proc p WHERE p.proname LIKE 'manufacturing\\_%'`
    expect(rows).toHaveLength(3)
    for (const row of rows)
      expect([row.proname, row.anon, row.auth]).toEqual([row.proname, false, false])
  })

  it('docs/VERIFY-manufacturing-01.sql runs and every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-manufacturing-01.sql'))
    expect(rows.length).toBeGreaterThan(30)
    expect(rows.filter((r) => r.ok !== true).map((r) => r.check)).toEqual([])
  })
})
