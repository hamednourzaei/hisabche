// ============================================
// docs/dashboard-stock-value-01-migration.sql — on a real Postgres, TWICE,
// then its VERIFY (QA-DASH-NEG, 9 Nov 2026).
//
// Three products: 3 on the shelf at 1,000, one sold 5 past its stock at
// 40,000, one inactive. Before: 3×1,000 − 5×40,000 = −197,000 «worth of
// stock». After: 3,000, and one product named as below zero.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-stock-value-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/stock_value`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('stock_value')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid, full_name text);
    CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      quantity numeric, min_stock_level numeric, buy_price numeric, category text, is_active boolean DEFAULT true);
    CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      type text, status text, total numeric, paid_amount numeric, currency text,
      exchange_rate numeric, date timestamptz, customer_id uuid);
    CREATE TABLE public.invoice_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid,
      product_id uuid, product_name text, total_price numeric);
  `)
  await setup.unsafe(read('perf-aggregates-analytics-migration.sql'))
  await setup.unsafe(read('dashboard-fx-01-migration.sql'))
  // ⚠️ Twice: re-runnable, or nobody dares run it on a half-migrated database.
  await setup.unsafe(read('dashboard-stock-value-01-migration.sql'))
  await setup.unsafe(read('dashboard-stock-value-01-migration.sql'))
  await setup.unsafe(`
    INSERT INTO products (workspace_id, quantity, min_stock_level, buy_price, is_active) VALUES
      ('${SHOP}', 3, 0, 1000, true),
      ('${SHOP}', -5, 0, 40000, true),
      ('${SHOP}', 100, 0, 9999, false);
  `)
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('dashboard-stock-value-01', () => {
  it('values stock on hand only, and counts the products below zero', async () => {
    const [row] = await sql.unsafe(
      `SELECT public.analytics_dashboard_kpis_v2($1, $2, $3, $4, $5) AS r`,
      [SHOP, '2026-11-09T00:00:00Z', '2026-11-01T00:00:00Z', '2026-10-01T00:00:00Z', 'AFN'],
    )
    const r = row!.r as { warehouse_value: number; negative_stock_products: number }
    expect(Number(r.warehouse_value)).toBe(3000)
    expect(Number(r.negative_stock_products)).toBe(1)
  })

  it('VERIFY: every row ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-dashboard-stock-value-01.sql'))
    expect(rows.length).toBe(4)
    expect(rows.every((r) => r.ok === true)).toBe(true)
  })
})
