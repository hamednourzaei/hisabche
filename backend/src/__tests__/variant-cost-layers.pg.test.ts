// ============================================
// backend/src/__tests__/variant-cost-layers.pg.test.ts
//
// WP-01 on real Postgres: docs/variant-cost-layers-migration.sql runs TWICE,
// then the rule is exercised with the writes it must refuse and the writes it
// must allow.
//
// The decision under test (owner, 17 Nov 2026): STRICT, NO BRIDGE. A sale of a
// variant consumes only layers of that same variant. An unassigned (NULL) layer
// is not a shared pool; it becomes usable only through the explicit
// `inventory_assign_layer_variant` act.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const pg = new EmbeddedPostgres({
  databaseDir: pgTempDir('hisabche-pg-variant-cost-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/variantcostdb`
let sql: postgres.Sql

const MIGRATION = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'variant-cost-layers-migration.sql'),
  'utf8',
)
const VERIFY = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'VERIFY-variant-cost-layers.sql'),
  'utf8',
)

const WS = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '22222222-2222-4222-8222-222222222221'
const OTHER_PRODUCT = '22222222-2222-4222-8222-222222222222'
const VARIANT_A = '33333333-3333-4333-8333-333333333331'
const VARIANT_B = '33333333-3333-4333-8333-333333333332'
const VARIANT_OTHER = '33333333-3333-4333-8333-333333333333'

const USER = '44444444-4444-4444-8444-444444444441'

type Json = Record<string, unknown>

async function receive(payload: postgres.JSONValue): Promise<string> {
  const rows = await sql<{ inventory_receive_layer: string }[]>`
    SELECT public.inventory_receive_layer(${WS}::uuid, ${USER}::uuid, ${sql.json(payload)})`
  return rows[0]!.inventory_receive_layer
}

async function consume(payload: postgres.JSONValue): Promise<Json> {
  const rows = await sql<{ inventory_consume_layers: Json }[]>`
    SELECT public.inventory_consume_layers(${WS}::uuid, ${USER}::uuid, ${sql.json(payload)})`
  return rows[0]!.inventory_consume_layers
}

function receiptLine(
  name: string,
  variantId: string | null,
  qty: number,
  cost: number,
): postgres.JSONValue {
  return {
    product_id: PRODUCT,
    variant_id: variantId,
    quantity: qty,
    unit_cost: cost,
    entry_date: '2026-11-01',
    source_type: 'opening',
    source_id: '55555555-5555-4555-8555-555555555551',
    source_line: name,
  }
}

function issueLine(name: string, variantId: string | null, qty: number): postgres.JSONValue {
  return {
    product_id: PRODUCT,
    variant_id: variantId,
    quantity: qty,
    entry_date: '2026-11-10',
    consumer_type: 'invoice',
    consumer_id: '66666666-6666-4666-8666-666666666666',
    consumer_line: name,
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('variantcostdb')
  sql = postgres(url, { max: 1, onnotice: () => {} })

  // The tables the migration alters, with the real column names it names.
  await sql.unsafe(`
    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      name text NOT NULL DEFAULT ''
    );
    CREATE TABLE public.product_variants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      template_product_id uuid NOT NULL,
      is_active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE public.inventory_settings (
      workspace_id uuid PRIMARY KEY,
      costing_method text NOT NULL DEFAULT 'fifo',
      negative_stock text NOT NULL DEFAULT 'block'
    );
    CREATE TABLE public.cost_layers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      product_id uuid NOT NULL,
      warehouse_id uuid,
      source_type text NOT NULL,
      source_id uuid,
      source_line text,
      received_qty numeric(18,4) NOT NULL,
      remaining_qty numeric(18,4) NOT NULL,
      unit_cost numeric(18,4) NOT NULL,
      currency text NOT NULL DEFAULT 'AFN',
      entry_date date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid
    );
    CREATE UNIQUE INDEX cost_layers_source_key
      ON public.cost_layers (workspace_id, source_type, source_id, source_line)
      WHERE source_id IS NOT NULL;
    CREATE TABLE public.cost_consumptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      layer_id uuid,
      product_id uuid NOT NULL,
      warehouse_id uuid,
      consumer_type text NOT NULL,
      consumer_id uuid,
      consumer_line text,
      quantity numeric(18,4) NOT NULL,
      unit_cost numeric(18,4) NOT NULL,
      amount numeric(18,4) NOT NULL,
      is_estimated boolean NOT NULL DEFAULT false,
      entry_date date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid
    );

    INSERT INTO public.products (id, workspace_id, name)
      VALUES ('${PRODUCT}', '${WS}', 'Shirt'),
             ('${OTHER_PRODUCT}', '${WS}', 'Hat');
    INSERT INTO public.product_variants (id, workspace_id, template_product_id)
      VALUES ('${VARIANT_A}', '${WS}', '${PRODUCT}'),
             ('${VARIANT_B}', '${WS}', '${PRODUCT}'),
             ('${VARIANT_OTHER}', '${WS}', '${OTHER_PRODUCT}');
  `)

  // Twice: the migration must be safe to re-run from the top.
  for (let run = 0; run < 2; run += 1) {
    await sql.unsafe(MIGRATION)
  }
}, 120_000)

afterAll(async () => {
  await sql?.end({ timeout: 5 })
  await pg?.stop()
})

describe('variant-cost-layers migration', () => {
  it('creates the columns, constraints, index and functions', async () => {
    const rows = (await sql.unsafe(VERIFY).simple()) as unknown as Array<
      Array<Record<string, unknown>>
    >
    // The first result set holds every structure/function check.
    for (const row of rows[0]!) {
      expect(row.ok, String(row.check_name)).toBe(true)
    }
    // The integrity result sets must both be 0.
    expect(Number(rows[1]![0]!.bad_rows)).toBe(0)
    expect(Number(rows[1]![1]!.bad_rows)).toBe(0)
    // And the functions themselves must carry the rule.
    for (const row of rows[2]!) {
      expect(row.ok, String(row.check_name)).toBe(true)
    }
  })

  it('prices each variant only from its own layers', async () => {
    const layerA = await receive(receiptLine('a-5', VARIANT_A, 5, 10))
    const layerB = await receive(receiptLine('b-2', VARIANT_B, 2, 30))
    expect(layerA).toBeTruthy()
    expect(layerB).toBeTruthy()

    const saleA = await consume(issueLine('sale-a-2', VARIANT_A, 2))
    expect(Number(saleA.total_cost)).toBe(20)

    const saleB = await consume(issueLine('sale-b-1', VARIANT_B, 1))
    expect(Number(saleB.total_cost)).toBe(30)

    // The layer that was NOT sold from is untouched: 5 − 2 = 3, not 5 − 3.
    const [a] = await sql<{ remaining_qty: string }[]>`
      SELECT remaining_qty FROM public.cost_layers WHERE id = ${layerA}::uuid`
    const [b] = await sql<{ remaining_qty: string }[]>`
      SELECT remaining_qty FROM public.cost_layers WHERE id = ${layerB}::uuid`
    expect(Number(a!.remaining_qty)).toBe(3)
    expect(Number(b!.remaining_qty)).toBe(1)

    // The trail names the variant it drew from.
    const trail = await sql<{ variant_id: string; layer_id: string }[]>`
      SELECT variant_id, layer_id FROM public.cost_consumptions
       WHERE consumer_line = 'sale-a-2'`
    expect(trail).toEqual([{ variant_id: VARIANT_A, layer_id: layerA }])
  })

  it('never borrows another variant or the unassigned pool', async () => {
    // B has 1 left; asking for 3 must be refused, not filled from A's 3.
    await expect(consume(issueLine('sale-b-4', VARIANT_B, 4))).rejects.toThrow(
      /INVENTORY_INSUFFICIENT_STOCK/,
    )

    // A line with no variant has no unassigned layers behind it either.
    await expect(consume(issueLine('sale-null', null, 1))).rejects.toThrow(
      /INVENTORY_INSUFFICIENT_STOCK/,
    )

    const [sums] = await sql<{ variant_a: string; variant_b: string; unassigned: string }[]>`
      SELECT
        COALESCE(SUM(remaining_qty) FILTER (WHERE variant_id = ${VARIANT_A}::uuid), 0) AS variant_a,
        COALESCE(SUM(remaining_qty) FILTER (WHERE variant_id = ${VARIANT_B}::uuid), 0) AS variant_b,
        COALESCE(SUM(remaining_qty) FILTER (WHERE variant_id IS NULL), 0) AS unassigned
      FROM public.cost_layers`
    expect(Number(sums!.variant_a)).toBe(3)
    expect(Number(sums!.variant_b)).toBe(1)
    expect(Number(sums!.unassigned)).toBe(0)
  })

  it('refuses a variant that belongs to a different product', async () => {
    await expect(receive(receiptLine('wrong-variant', VARIANT_OTHER, 1, 5))).rejects.toThrow(
      /INVENTORY_VARIANT_NOT_ON_PRODUCT/,
    )
  })

  it('makes legacy stock usable only through the explicit assignment act', async () => {
    const legacy = await receive(receiptLine('legacy', null, 4, 7))

    // Strict: the variant sale cannot see it yet. A has only 3 open (5 − 2).
    await expect(consume(issueLine('sale-a-legacy', VARIANT_A, 4))).rejects.toThrow(
      /INVENTORY_INSUFFICIENT_STOCK/,
    )

    const assigned = await sql<{ inventory_assign_layer_variant: Json }[]>`
      SELECT public.inventory_assign_layer_variant(
        ${WS}::uuid, ${USER}::uuid, ${legacy}::uuid, ${VARIANT_A}::uuid)`
    expect(assigned[0]!.inventory_assign_layer_variant).toMatchObject({
      moved: true,
      variant_id: VARIANT_A,
    })

    // Now it is this variant's stock, at the price it was received at:
    // FIFO takes the 3 still open at 10 and 1 unit of the assigned layer at 7.
    const sale = await consume(issueLine('sale-a-legacy-2', VARIANT_A, 4))
    expect(Number(sale.total_cost)).toBe(3 * 10 + 1 * 7)

    // A layer already assigned cannot be taken by another variant.
    await expect(
      sql`SELECT public.inventory_assign_layer_variant(
        ${WS}::uuid, ${USER}::uuid, ${legacy}::uuid, ${VARIANT_B}::uuid)`,
    ).rejects.toThrow(/INVENTORY_LAYER_ALREADY_ASSIGNED/)
  })

  it('returns a released quantity to the variant it left from', async () => {
    const [before] = await sql<{ remaining_qty: string }[]>`
      SELECT remaining_qty FROM public.cost_layers
       WHERE variant_id = ${VARIANT_A}::uuid AND source_line = 'a-5'`
    const released = await sql<{ inventory_release_consumption: Json }[]>`
      SELECT public.inventory_release_consumption(
        ${WS}::uuid, ${USER}::uuid, 'invoice', '66666666-6666-4666-8666-666666666666'::uuid)`
    expect(Number(released[0]!.inventory_release_consumption.quantity)).toBeGreaterThan(0)

    const [after] = await sql<{ remaining_qty: string }[]>`
      SELECT remaining_qty FROM public.cost_layers
       WHERE variant_id = ${VARIANT_A}::uuid AND source_line = 'a-5'`
    expect(Number(after!.remaining_qty)).toBeGreaterThan(Number(before!.remaining_qty))

    // The release rows carry the same variant as the consumption they undo.
    const bad = await sql<{ n: string }[]>`
      SELECT COUNT(*) AS n FROM public.cost_consumptions c
        JOIN public.cost_layers l ON l.id = c.layer_id
       WHERE c.variant_id IS DISTINCT FROM l.variant_id`
    expect(Number(bad[0]!.n)).toBe(0)
  })

  it('is idempotent per consumer line', async () => {
    const first = await consume(issueLine('sale-idem', VARIANT_B, 1))
    const again = await consume(issueLine('sale-idem', VARIANT_B, 1))
    expect(Number(first.total_cost)).toBe(30)
    expect(again).toMatchObject({ status: 'already_consumed' })
    expect(Number(again.total_cost)).toBe(30)
  })
})
