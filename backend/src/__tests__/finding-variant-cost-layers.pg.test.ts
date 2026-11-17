// ============================================
// backend/src/__tests__/finding-variant-cost-layers.pg.test.ts
//
// Runs docs/FINDING-variant-cost-layers.sql twice on real Postgres with the
// real column names, and checks it counts what it says it counts. The first
// version read `inventory_cost_layers` and `product_variants.deleted_at`,
// neither of which exists — it would have failed on the live database.
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
  databaseDir: pgTempDir('hisabche-pg-finding-variants-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/findingdb`
let sql: postgres.Sql

const FINDING = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'FINDING-variant-cost-layers.sql'),
  'utf8',
)
const WS = '22222222-2222-4222-8222-222222222222'
const P_MANY = '33333333-3333-4333-8333-333333333331'
const P_ONE = '33333333-3333-4333-8333-333333333332'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('findingdb')
  sql = postgres(url, { max: 1, onnotice: () => {} })
  // The columns these two tables really have (universal-core, inventory-costing) that the FINDING reads.
  await sql.unsafe(`
    CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid NOT NULL);
    CREATE TABLE public.product_variants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL, is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE public.cost_layers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, product_id uuid NOT NULL, remaining_qty numeric(18,4) NOT NULL);
    INSERT INTO public.products VALUES ('${P_MANY}', '${WS}'), ('${P_ONE}', '${WS}');
    INSERT INTO public.product_variants (product_id, is_active) VALUES
      ('${P_MANY}', true), ('${P_MANY}', true), ('${P_MANY}', false), ('${P_ONE}', true);
    INSERT INTO public.cost_layers (workspace_id, product_id, remaining_qty) VALUES
      ('${WS}', '${P_MANY}', 5), ('${WS}', '${P_MANY}', 0), ('${WS}', '${P_ONE}', 3);
  `)
}, 90_000)

afterAll(async () => {
  await sql?.end({ timeout: 5 })
  await pg?.stop()
})

describe('FINDING-variant-cost-layers.sql on Postgres', () => {
  it('runs twice and counts only multi-variant products with open layers', async () => {
    for (let run = 0; run < 2; run += 1) {
      const results = (await sql.unsafe(FINDING).simple()) as unknown as Array<
        Array<Record<string, unknown>>
      >
      const [many, open] = results
      expect(many).toEqual([{ workspace_id: WS, products_with_many_variants: '1' }])
      expect(open).toEqual([
        { workspace_id: WS, multi_variant_products_with_open_layers: '1', open_layers: '1' },
      ])
    }
  })

  it('writes nothing', () => {
    expect(
      /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE)\b/i.test(
        FINDING.replace(/--.*$/gm, ''),
      ),
    ).toBe(false)
  })
})
