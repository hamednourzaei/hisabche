// ============================================
// backend/src/__tests__/purchase-variant-binding-01.pg.test.ts
//
// docs/purchase-variant-binding-01-migration.sql on a REAL Postgres, TWICE:
// a purchase line may name the variant it buys. The column accepts it, the FK
// refuses a variant of another product, a legacy line without a variant stays
// NULL, and the `document_write_rows` path the backend actually inserts
// through lands `variant_id` in its column.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-purchase-variant-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/pvb`
let sql: postgres.Sql

const W = '22222222-2222-4222-8222-222222222222'
const P = '33333333-3333-4333-8333-333333333333'
const P2 = '33333333-3333-4333-8333-333333333332'
const V = '44444444-4444-4444-8444-444444444441'
const O = '55555555-5555-4555-8555-555555555551'
const L = '55555555-5555-4555-8555-555555555552'

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

// The minimum the migration needs, plus the two rows the write path uses.
const BASE = `
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
  CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.product_variants (id uuid PRIMARY KEY, workspace_id uuid, template_product_id uuid);
  CREATE TABLE public.purchase_orders (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.purchase_order_items (
    id uuid PRIMARY KEY, purchase_order_id uuid NOT NULL, product_id uuid NOT NULL,
    quantity numeric NOT NULL DEFAULT 0, unit_price numeric NOT NULL DEFAULT 0, total_price numeric,
    workspace_id uuid, user_id uuid
  );
`

// The generic writer `purchase_order_write` inserts lines through
// (docs/invoice-write-document-migration.sql) — copied verbatim so the test
// exercises the REAL insert path, not a hand-shaped INSERT.
const DOCUMENT_WRITE_ROWS = `
  CREATE OR REPLACE FUNCTION public.document_write_rows(p_table text, p_rows jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_cols text;
  BEGIN
    IF p_table NOT IN ('invoices', 'invoice_items', 'invoice_item_details', 'stock_movements',
                       'purchase_orders', 'purchase_order_items') THEN
      RAISE EXCEPTION 'document_write_rows: table % is not a document table', p_table
        USING ERRCODE = '22023';
    END IF;
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
      RETURN;
    END IF;

    SELECT string_agg(quote_ident(k), ', ' ORDER BY k)
      INTO v_cols
      FROM (SELECT DISTINCT jsonb_object_keys(r) AS k FROM jsonb_array_elements(p_rows) r) keys;

    EXECUTE format(
      'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1)',
      p_table, v_cols, v_cols, p_table
    ) USING p_rows;
  END;
  $fn$;
`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('pvb')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(BASE)
  await setup.unsafe(DOCUMENT_WRITE_ROWS)
  for (let i = 0; i < 2; i += 1) {
    // ⚠️ Twice: re-runnable, or nobody dares run it on a half-migrated database.
    await setup.unsafe(read('purchase-variant-binding-01-migration.sql'))
  }
  await setup.unsafe(`
    INSERT INTO public.workspaces VALUES ('${W}');
    INSERT INTO public.products (id, workspace_id) VALUES ('${P}', '${W}'), ('${P2}', '${W}');
    INSERT INTO public.product_variants (id, workspace_id, template_product_id)
      VALUES ('${V}', '${W}', '${P}');
    INSERT INTO public.purchase_orders (id, workspace_id) VALUES ('${O}', '${W}');
  `)
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('purchase-variant-binding-01', () => {
  it('VERIFY is all true', async () => {
    const rows = await sql.unsafe(read('VERIFY-purchase-variant-binding-01.sql'))
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check_name)).toEqual([])
    expect(rows.length).toBeGreaterThanOrEqual(5)
  })

  it('a line names its variant through the real write path, and a legacy line stays NULL', async () => {
    // ⚠️ The parameter is the JS ARRAY, not a JSON string: postgres.js
    // JSON-encodes a string AGAIN, and the function would see a jsonb STRING,
    // not an array, and return without inserting a row.
    await sql.unsafe(`SELECT public.document_write_rows('purchase_order_items', $1::jsonb)`, [
      [
        {
          id: L,
          purchase_order_id: O,
          product_id: P,
          variant_id: V,
          quantity: 4,
          unit_price: 1000,
          total_price: 4000,
          workspace_id: W,
        },
        {
          id: crypto.randomUUID(),
          purchase_order_id: O,
          product_id: P2,
          quantity: 2,
          unit_price: 500,
          total_price: 1000,
          workspace_id: W,
        },
      ],
    ])

    const named = await sql`SELECT variant_id FROM public.purchase_order_items WHERE id = ${L}`
    expect(named[0]!.variant_id).toBe(V)

    const legacy = await sql`
      SELECT variant_id FROM public.purchase_order_items
       WHERE product_id = ${P2} AND variant_id IS NULL`
    expect(legacy.length).toBe(1)
  })

  it('a line naming a variant that does not EXIST is refused by the FK (same-product binding is the service rule)', async () => {
    const ghost = '66666666-6666-4666-8666-666666666661'
    await expect(
      sql`INSERT INTO public.purchase_order_items
            (id, purchase_order_id, product_id, variant_id, quantity, unit_price, workspace_id)
           VALUES (${crypto.randomUUID()}, ${O}, ${P}, ${ghost}, 1, 100, ${W})`,
    ).rejects.toThrow()
  })
})
